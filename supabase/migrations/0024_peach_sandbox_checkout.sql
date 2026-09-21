-- Sandbox checkout is deliberately opt-in at the application boundary. These
-- routines are service-role only, except the payer-owned preparation RPC.

alter table public.payment_attempts
  add column if not exists booking_id uuid references public.bookings(id) on delete restrict,
  add column if not exists amount_cents bigint,
  add column if not exists idempotency_key text;
update public.payment_attempts set amount_cents=round(amount * 100)::bigint where amount_cents is null;
create unique index if not exists payment_attempts_idempotency_key_key
  on public.payment_attempts(idempotency_key) where idempotency_key is not null;
create unique index if not exists payment_attempts_provider_reference_key
  on public.payment_attempts(provider, provider_reference) where provider_reference is not null;

alter table public.payment_allocations enable row level security;

create or replace function public.prepare_peach_sandbox_checkout(target_booking uuid)
returns table(attempt_id uuid, provider_reference text, amount_cents bigint)
language plpgsql security definer set search_path=public as $$
declare b public.bookings; payer uuid; total bigint; attempt public.payment_attempts;
begin
  if auth.uid() is null then raise exception using message='not_authenticated', errcode='P0001'; end if;
  select * into b from public.bookings where id=target_booking for update;
  if not found or b.payment_option<>'pay_now' or b.payment_state<>'held' or b.hold_expires_at<=now()
  then raise exception using message='checkout_unavailable', errcode='P0001'; end if;
  select public.active_billing_payer(b.fencer_id) into payer;
  if payer<>auth.uid() then raise exception using message='forbidden', errcode='P0001'; end if;
  select coalesce(sum(amount_cents),0) into total from public.charges
    where booking_id=b.id and lifecycle_state='provisional';
  if total<=0 then raise exception using message='checkout_unavailable', errcode='P0001'; end if;
  insert into public.payment_attempts(payer_id,booking_id,provider,provider_reference,status,amount,amount_cents,idempotency_key)
  values(payer,b.id,'peach_sandbox','cfa'||substring(md5(b.id::text) from 1 for 13),'pending',total/100.0,total,'peach-sandbox:'||b.id)
  on conflict (idempotency_key) where idempotency_key is not null do update set provider_reference=excluded.provider_reference
  returning * into attempt;
  if attempt.status='succeeded' then raise exception using message='checkout_unavailable', errcode='P0001'; end if;
  return query select attempt.id, attempt.provider_reference, attempt.amount_cents;
end $$;
revoke all on function public.prepare_peach_sandbox_checkout(uuid) from public, anon;
grant execute on function public.prepare_peach_sandbox_checkout(uuid) to authenticated;

create or replace function public.record_peach_sandbox_webhook(
  target_event_id text, target_provider_reference text, target_succeeded boolean, target_payload jsonb
) returns boolean language plpgsql security definer set search_path=public as $$
declare attempt public.payment_attempts; settled boolean; charge_row record;
begin
  insert into public.provider_events(provider,provider_event_id,event_type,payload,processed_at)
    values('peach_sandbox',target_event_id,case when target_succeeded then 'payment.succeeded' else 'payment.failed' end,target_payload,now())
    on conflict(provider,provider_event_id) do nothing;
  if not found then return false; end if;
  select * into attempt from public.payment_attempts
    where provider='peach_sandbox' and provider_reference=target_provider_reference for update;
  if not found then raise exception using message='payment_attempt_not_found', errcode='P0001'; end if;
  if attempt.status='succeeded' then return false; end if;
  if not target_succeeded then
    update public.payment_attempts set status='failed',completed_at=now() where id=attempt.id and status='pending';
    return true;
  end if;
  update public.payment_attempts set status='succeeded',completed_at=now() where id=attempt.id and status='pending';
  select public.settle_booking_hold(attempt.id) into settled;
  if settled then
    for charge_row in select id,amount_cents from public.charges where booking_id=attempt.booking_id and lifecycle_state='finalized' loop
      insert into public.payment_allocations(payment_attempt_id,charge_id,amount_cents)
        values(attempt.id,charge_row.id,charge_row.amount_cents)
        on conflict(payment_attempt_id,charge_id) do nothing;
      update public.charges set status='paid',paid_at=now(),updated_at=now() where id=charge_row.id;
    end loop;
  else
    select id into charge_row from public.charges where booking_id=attempt.booking_id order by created_at limit 1;
    if charge_row.id is not null then
      insert into public.ledger_credits(payer_id,participant_id,booking_id,charge_id,amount,reason,created_by)
        select attempt.payer_id,b.fencer_id,b.id,charge_row.id,attempt.amount_cents/100.0,'Payment received after lesson hold expiry',null
        from public.bookings b where b.id=attempt.booking_id
        on conflict(charge_id) do nothing;
    end if;
  end if;
  return true;
end $$;
revoke all on function public.record_peach_sandbox_webhook(text,text,boolean,jsonb) from public, anon, authenticated;
grant execute on function public.record_peach_sandbox_webhook(text,text,boolean,jsonb) to service_role;
