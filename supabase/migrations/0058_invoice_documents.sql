-- Invoices become documents that reach the payer. Each invoice records who
-- generated it and when it was emailed:
--   * the monthly cron run emails its invoices straight away;
--   * a staff run leaves them unsent until staff review and press Send.
-- The PDF needs the club's contact and EFT details, so they live in one
-- editable settings row instead of being hardcoded. The seeded values are
-- placeholders and must be replaced before real use.
alter table public.invoices
  add column if not exists generated_by text not null default 'staff' check (generated_by in ('staff','schedule')),
  add column if not exists sent_at timestamptz,
  add column if not exists send_claimed_at timestamptz;

-- ============================================================
-- 1. Club billing details
-- ============================================================
create table public.club_billing_settings (
  singleton boolean primary key default true check (singleton),
  club_name text not null check (length(trim(club_name)) between 1 and 120),
  address text not null default '' check (length(address) <= 300),
  email text not null default '' check (length(email) <= 200),
  bank_name text not null default '' check (length(bank_name) <= 120),
  account_name text not null default '' check (length(account_name) <= 120),
  account_number text not null default '' check (length(account_number) <= 40),
  branch_code text not null default '' check (length(branch_code) <= 20),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id)
);
insert into public.club_billing_settings(club_name,address,email,bank_name,account_name,account_number,branch_code)
values ('Cape Fencing Academy','1 Example Street, Cape Town, 8001','accounts@example.com',
  'Example Bank (placeholder)','Cape Fencing Academy','0000 000 000','000000');

alter table public.club_billing_settings enable row level security;
-- Bank details are printed on every invoice, so any signed-in person may read them.
create policy "signed-in users read club billing settings" on public.club_billing_settings
  for select to authenticated using (true);
create policy "staff update club billing settings" on public.club_billing_settings
  for update to authenticated using (public.current_user_is_active_staff()) with check (public.current_user_is_active_staff());
revoke all on public.club_billing_settings from anon;
grant select, update on public.club_billing_settings to authenticated;
grant all on public.club_billing_settings to service_role;

-- ============================================================
-- 2. Record who generated each invoice
-- ============================================================
-- Same as 0043 apart from the source parameter, which is written to every
-- invoice the run creates.
drop function public.generate_monthly_invoices(date);
create function public.generate_monthly_invoices(target_period date, source text default 'staff')
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
    select coalesce(max(i.sequence),0)+1 into next_sequence from public.invoices i
      where i.payer_id=payer_row.payer_id and i.period=target_period;
    insert into public.invoices(payer_id,period,sequence,generated_by) values(payer_row.payer_id,target_period,next_sequence,source)
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
revoke all on function public.generate_monthly_invoices(date,text) from public,anon,authenticated;

create or replace function public.run_scheduled_invoices() returns integer
language sql security definer set search_path=public as $$
  select public.generate_monthly_invoices(date_trunc('month',(now() at time zone 'Africa/Johannesburg'))::date,'schedule');
$$;
revoke all on function public.run_scheduled_invoices() from public,anon,authenticated;
grant execute on function public.run_scheduled_invoices() to service_role;

-- ============================================================
-- 3. Sending invoice emails
-- ============================================================
-- A claim stops two senders (the cron and a staff click) emailing the same
-- invoice at once. A claim older than 15 minutes is treated as abandoned.
-- Staff may resend an invoice that was already sent.
create function public.claim_invoice_email(target_invoice uuid, allow_resend boolean default false)
returns table(invoice_id uuid, recipient_email text, recipient_name text)
language plpgsql security definer set search_path=public as $$
declare v_invoice uuid;
begin
  update public.invoices i set send_claimed_at=now()
  where i.id=target_invoice
    and (allow_resend or i.sent_at is null)
    and (i.send_claimed_at is null or i.send_claimed_at<now()-interval '15 minutes')
  returning i.id into v_invoice;
  if v_invoice is null then return; end if;
  return query select i.id, p.email, coalesce(nullif(trim(p.full_name),''),'CFA member')
    from public.invoices i join public.profiles p on p.id=i.payer_id where i.id=v_invoice;
end $$;

create function public.complete_invoice_email(target_invoice uuid)
returns void language sql security definer set search_path=public as $$
  update public.invoices set sent_at=now(), send_claimed_at=null where id=target_invoice;
$$;

create function public.release_invoice_email(target_invoice uuid)
returns void language sql security definer set search_path=public as $$
  update public.invoices set send_claimed_at=null where id=target_invoice;
$$;

-- Unpaid invoices the cron made that have not gone out yet, including
-- earlier failures, so each run retries them.
create function public.list_unsent_scheduled_invoices()
returns setof uuid language sql stable security definer set search_path=public as $$
  select id from public.invoices where generated_by='schedule' and sent_at is null and status<>'paid' order by issued_at;
$$;

revoke all on function public.claim_invoice_email(uuid,boolean) from public,anon,authenticated;
revoke all on function public.complete_invoice_email(uuid) from public,anon,authenticated;
revoke all on function public.release_invoice_email(uuid) from public,anon,authenticated;
revoke all on function public.list_unsent_scheduled_invoices() from public,anon,authenticated;
grant execute on function public.claim_invoice_email(uuid,boolean) to service_role;
grant execute on function public.complete_invoice_email(uuid) to service_role;
grant execute on function public.release_invoice_email(uuid) to service_role;
grant execute on function public.list_unsent_scheduled_invoices() to service_role;
