-- Issued invoices are immutable. 0041 added late charges to the month's
-- existing invoice and reopened it if it had been paid, so a payer could see
-- an invoice change after it was sent or settled. A run now leaves every
-- existing invoice untouched and puts charges not yet billed on a new,
-- supplementary invoice for the same month (sequence 2, 3, ...).
--
-- The earlier-period catch-up from 0041 is kept: any finalized, unpaid,
-- eligible charge that is on no invoice is billed on the next run.
alter table public.invoices add column if not exists sequence smallint not null default 1;
alter table public.invoices drop constraint if exists invoices_payer_id_period_key;
alter table public.invoices add constraint invoices_payer_period_sequence_key unique (payer_id, period, sequence);

create or replace function public.generate_monthly_invoices(target_period date)
returns integer language plpgsql security definer set search_path=public as $$
declare payer_row record; v_invoice_id uuid; made integer:=0; next_sequence smallint;
begin
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
    select coalesce(max(i.sequence),0)+1 into next_sequence from public.invoices i
      where i.payer_id=payer_row.payer_id and i.period=target_period;
    insert into public.invoices(payer_id,period,sequence) values(payer_row.payer_id,target_period,next_sequence)
      returning id into v_invoice_id;
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
revoke all on function public.generate_monthly_invoices(date) from public,anon,authenticated;
