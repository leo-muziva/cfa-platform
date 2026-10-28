-- One invoice per payer per month. 0043 put every re-run's new charges on a
-- separate supplementary invoice, so a payer could get several emails and PDFs
-- for one month and pay each part separately. Now an invoice stays open until
-- it goes out: a re-run in the same month adds new charges to the month's
-- open invoice. Once an invoice is sent, paid, being sent, or has a payment,
-- receipt or adjustment against it, it is locked and never changes; charges
-- that arrive after that go on the next month's invoice.

-- ============================================================
-- 1. Which invoices may still change
-- ============================================================
create function public.invoice_is_open(target_invoice uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.invoices i where i.id=target_invoice
      and i.sent_at is null and i.send_claimed_at is null and i.status<>'paid')
    and not exists(select 1 from public.payment_attempts a where a.invoice_id=target_invoice)
    and not exists(select 1 from public.receipts r where r.invoice_id=target_invoice)
    and not exists(select 1 from public.invoice_adjustments d where d.invoice_id=target_invoice);
$$;
revoke all on function public.invoice_is_open(uuid) from public,anon,authenticated;

-- ============================================================
-- 2. Runs add to the month's open invoice
-- ============================================================
-- Same eligibility rules as 0058. The returned count is invoices created or
-- added to.
create or replace function public.generate_monthly_invoices(target_period date, source text default 'staff')
returns integer language plpgsql security definer set search_path=public as $$
declare payer_row record; v_invoice_id uuid; made integer:=0; next_sequence smallint;
begin
  if source not in ('staff','schedule') then raise exception 'invalid invoice source'; end if;
  target_period:=date_trunc('month',target_period)::date;
  -- The cron and an admin can run at the same time; one run at a time keeps
  -- sequence numbers and charge assignment consistent.
  perform pg_advisory_xact_lock(hashtext('public.generate_monthly_invoices'));
  insert into public.charges(fencer_id,payer_id,type,amount,status,period,description)
  select m.profile_id,public.active_billing_payer(m.profile_id),'membership',mt.price,'unpaid',target_period,mt.name
  from public.memberships m join public.membership_types mt on mt.id=m.membership_type_id
  where m.status='active' and mt.code='month_to_month' and m.started_at<target_period+interval '1 month'
  on conflict do nothing;
  for payer_row in select distinct c.payer_id from public.charges c left join public.bookings b on b.id=c.booking_id
    where c.status='unpaid' and c.lifecycle_state='finalized' and c.period<=target_period
      and (c.type in ('membership','joining_fee') or (c.type='lesson' and b.payment_option='pay_later'))
      and not exists(select 1 from public.invoice_lines il where il.charge_id=c.id) loop
    -- The row lock waits for a checkout or email claim on the same invoice,
    -- so the open check below sees their result.
    select i.id into v_invoice_id from public.invoices i
      where i.payer_id=payer_row.payer_id and i.period=target_period
      order by i.sequence desc limit 1 for update;
    if v_invoice_id is null or not public.invoice_is_open(v_invoice_id) then
      select coalesce(max(i.sequence),0)+1 into next_sequence from public.invoices i
        where i.payer_id=payer_row.payer_id and i.period=target_period;
      insert into public.invoices(payer_id,period,sequence,generated_by) values(payer_row.payer_id,target_period,next_sequence,source)
        returning id into v_invoice_id;
    elsif source='schedule' then
      -- The 25th run takes over a staff draft so it is emailed with the rest.
      update public.invoices set generated_by='schedule' where id=v_invoice_id;
    end if;
    insert into public.invoice_lines(invoice_id,charge_id,participant_id,description,amount)
    select v_invoice_id,c.id,c.fencer_id,
      case when c.period<target_period then c.description||' ('||to_char(c.period,'FMMonth YYYY')||')' else c.description end,
      c.amount from public.charges c left join public.bookings b on b.id=c.booking_id
    where c.payer_id=payer_row.payer_id and c.period<=target_period and c.status='unpaid'
      and c.lifecycle_state='finalized'
      and (c.type in ('membership','joining_fee') or (c.type='lesson' and b.payment_option='pay_later'))
      and not exists(select 1 from public.invoice_lines il where il.charge_id=c.id)
    on conflict(charge_id) do nothing;
    update public.invoices set total=(select coalesce(sum(amount),0) from public.invoice_lines where invoice_id=v_invoice_id)
      where id=v_invoice_id;
    made:=made+1;
  end loop;
  return made;
end $$;
revoke all on function public.generate_monthly_invoices(date,text) from public,anon,authenticated;

-- ============================================================
-- 3. One-off: combine split months that were never paid
-- ============================================================
-- Before this change a month could already be split across several invoices.
-- Those with no payment, receipt or adjustment are combined into the month's
-- first such invoice. Sent ones are included because only test data exists
-- so far; the combined invoice goes back to "not sent" so the single monthly
-- total can be sent. The emptied invoices are deleted, which leaves gaps in
-- the invoice numbers.
do $$
declare grp record; keeper uuid;
begin
  for grp in
    select i.payer_id, i.period from public.invoices i
    where i.status<>'paid'
      and not exists(select 1 from public.payment_attempts a where a.invoice_id=i.id)
      and not exists(select 1 from public.receipts r where r.invoice_id=i.id)
      and not exists(select 1 from public.invoice_adjustments d where d.invoice_id=i.id)
    group by i.payer_id, i.period having count(*)>1
  loop
    create temp table if not exists merge_candidates(id uuid primary key, sequence smallint) on commit drop;
    truncate merge_candidates;
    insert into merge_candidates
    select i.id, i.sequence from public.invoices i
    where i.payer_id=grp.payer_id and i.period=grp.period and i.status<>'paid'
      and not exists(select 1 from public.payment_attempts a where a.invoice_id=i.id)
      and not exists(select 1 from public.receipts r where r.invoice_id=i.id)
      and not exists(select 1 from public.invoice_adjustments d where d.invoice_id=i.id);
    select id into keeper from merge_candidates order by sequence limit 1;
    update public.invoice_lines set invoice_id=keeper
      where invoice_id in (select id from merge_candidates where id<>keeper);
    update public.invoices set
      total=(select coalesce(sum(amount),0) from public.invoice_lines where invoice_id=keeper),
      sent_at=null, send_claimed_at=null,
      generated_by=case when exists(select 1 from merge_candidates mc join public.invoices x on x.id=mc.id where x.generated_by='schedule')
        then 'schedule' else generated_by end
      where id=keeper;
    delete from public.invoices where id in (select id from merge_candidates where id<>keeper);
  end loop;
end $$;
