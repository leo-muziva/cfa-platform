-- Refunds: payers (or staff) request, staff approve or reject with a note,
-- then staff process the money back either by manual bank transfer or
-- through the provider's refund API. Refunds are recorded against the
-- settled payment attempt; the charges it paid stay settled, so
-- net paid = payment - processed refunds.
--
-- Also gives payment_allocations a read policy and stops anonymous reads of
-- bulk orders. 0030 enabled RLS on the other tables that lacked it.

-- ============================================================
-- 1. Staff helper
-- ============================================================
-- Financial operations are open to all active staff, matching
-- record_manual_invoice_payment (0025).
create function public.current_user_is_active_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select is_staff and is_active from public.profiles where id = auth.uid()), false);
$$;
revoke all on function public.current_user_is_active_staff() from public, anon;
grant execute on function public.current_user_is_active_staff() to authenticated;

-- ============================================================
-- 2. Refund requests
-- ============================================================
create table public.refund_requests (
  id uuid primary key default gen_random_uuid(),
  refund_number text not null unique
    default ('RFD-' || lpad(nextval('public.invoice_number_seq')::text, 6, '0')),
  payment_attempt_id uuid not null references public.payment_attempts(id) on delete restrict,
  payer_id uuid not null references public.profiles(id),
  requested_by uuid not null references public.profiles(id),
  amount_cents bigint not null check (amount_cents > 0),
  reason text not null check (length(btrim(reason)) between 1 and 500),
  status text not null default 'requested'
    check (status in ('requested', 'approved', 'rejected', 'processing', 'processed', 'failed')),
  method text check (method in ('manual_bank', 'provider')),
  decision_note text,
  decided_by uuid references public.profiles(id),
  decided_at timestamptz,
  processed_by uuid references public.profiles(id),
  processed_at timestamptz,
  external_reference text,
  failure_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- An approved or later refund always has a method.
  check (status in ('requested', 'rejected') or method is not null),
  check (status <> 'rejected' or length(btrim(coalesce(decision_note, ''))) > 0)
);
create index refund_requests_attempt_idx on public.refund_requests (payment_attempt_id);
create index refund_requests_payer_idx on public.refund_requests (payer_id);
create index refund_requests_status_idx on public.refund_requests (status);

create trigger refund_requests_updated_at
  before update on public.refund_requests
  for each row execute function public.set_updated_at();

alter table public.refund_requests enable row level security;
create policy "Payers read own refund requests"
  on public.refund_requests for select
  using (payer_id = auth.uid() and public.payment_actor_is_payer());
create policy "Staff read all refund requests"
  on public.refund_requests for select
  using (public.current_user_is_active_staff());
revoke insert, update, delete, truncate on public.refund_requests from anon, authenticated;

-- A fully refunded shop order.
alter table public.orders drop constraint orders_status_check;
alter table public.orders add constraint orders_status_check
  check (status in ('draft', 'pending_payment', 'paid', 'submitted', 'cancelled', 'refunded'));

-- ============================================================
-- 3. Refundable amount
-- ============================================================
-- Payment minus refunds still in play (anything not rejected or failed)
-- minus account credit already issued for the same money. The credit term
-- stops a lesson that was credited on cancellation from also being
-- refunded in cash.
create function public.payment_refundable_cents(target_attempt uuid) returns bigint
language sql stable security definer set search_path = public as $$
  select case when a.status <> 'succeeded' then 0::bigint else greatest(0,
    a.amount_cents
    - coalesce((select sum(r.amount_cents) from public.refund_requests r
        where r.payment_attempt_id = a.id and r.status not in ('rejected', 'failed')), 0)
    - coalesce((select sum(c.amount_cents) from public.ledger_credits c
        where c.payment_attempt_id = a.id
          or (a.booking_id is not null and c.booking_id = a.booking_id)
          or c.charge_id in (select pa.charge_id from public.payment_allocations pa where pa.payment_attempt_id = a.id)), 0)
  )::bigint end
  from public.payment_attempts a where a.id = target_attempt;
$$;
revoke all on function public.payment_refundable_cents(uuid) from public, anon, authenticated;

-- Marks a shop order refunded once processed refunds cover its payment,
-- and pulls it out of a bulk order that has not been placed yet.
create function public.sync_order_refund_state(target_attempt uuid) returns void
language plpgsql security definer set search_path = public as $$
declare a public.payment_attempts; refunded bigint;
begin
  select * into a from public.payment_attempts where id = target_attempt;
  if a.order_id is null then return; end if;
  select coalesce(sum(amount_cents), 0) into refunded from public.refund_requests
    where payment_attempt_id = a.id and status = 'processed';
  if refunded >= a.amount_cents then
    update public.orders o set status = 'refunded',
      bulk_order_id = case when exists(select 1 from public.bulk_orders b
        where b.id = o.bulk_order_id and b.status = 'collecting') then null else o.bulk_order_id end
      where o.id = a.order_id and o.status = 'paid';
  end if;
end $$;
revoke all on function public.sync_order_refund_state(uuid) from public, anon, authenticated;

-- ============================================================
-- 4. Refund lifecycle
-- ============================================================
create function public.request_refund(target_attempt uuid, target_amount_cents bigint, target_reason text)
returns uuid language plpgsql security definer set search_path = public as $$
declare a public.payment_attempts; staff boolean := public.current_user_is_active_staff(); refund uuid;
begin
  if auth.uid() is null then raise exception 'forbidden'; end if;
  if target_amount_cents is null or target_amount_cents <= 0
    or length(btrim(coalesce(target_reason, ''))) not between 1 and 500 then raise exception 'invalid_input'; end if;
  select * into a from public.payment_attempts where id = target_attempt for update;
  if not found then raise exception 'payment_not_found'; end if;
  -- Staff may raise refunds for anyone; otherwise only the payer who paid.
  if not staff and (a.payer_id <> auth.uid() or not public.payment_actor_is_payer()) then
    raise exception 'forbidden';
  end if;
  if a.status <> 'succeeded' then raise exception 'payment_not_refundable'; end if;
  if target_amount_cents > public.payment_refundable_cents(a.id) then raise exception 'amount_exceeds_refundable'; end if;
  insert into public.refund_requests(payment_attempt_id, payer_id, requested_by, amount_cents, reason)
    values (a.id, a.payer_id, auth.uid(), target_amount_cents, btrim(target_reason)) returning id into refund;
  insert into public.audit_events(event_type, actor_id, subject_profile_id, entity_type, entity_id, metadata)
    values ('refund.requested', auth.uid(), a.payer_id, 'refund_request', refund,
      jsonb_build_object('payment_attempt_id', a.id, 'amount_cents', target_amount_cents::text));
  return refund;
end $$;
revoke all on function public.request_refund(uuid, bigint, text) from public, anon;
grant execute on function public.request_refund(uuid, bigint, text) to authenticated;

create function public.decide_refund(target_refund uuid, target_approve boolean, target_method text,
  target_note text, target_amount_cents bigint default null)
returns boolean language plpgsql security definer set search_path = public as $$
declare r public.refund_requests; a public.payment_attempts; new_amount bigint;
begin
  if not public.current_user_is_active_staff() then raise exception 'forbidden'; end if;
  select * into r from public.refund_requests where id = target_refund;
  if not found then raise exception 'refund_not_found'; end if;
  -- Lock the payment first so concurrent requests see a consistent balance.
  select * into a from public.payment_attempts where id = r.payment_attempt_id for update;
  select * into r from public.refund_requests where id = target_refund for update;
  if r.status <> 'requested' then raise exception 'refund_already_decided'; end if;

  if not coalesce(target_approve, false) then
    if length(btrim(coalesce(target_note, ''))) = 0 then raise exception 'note_required'; end if;
    update public.refund_requests set status = 'rejected', decision_note = btrim(target_note),
      decided_by = auth.uid(), decided_at = now() where id = r.id;
    insert into public.audit_events(event_type, actor_id, subject_profile_id, entity_type, entity_id, metadata)
      values ('refund.rejected', auth.uid(), r.payer_id, 'refund_request', r.id, '{}'::jsonb);
    return true;
  end if;

  if target_method is null or target_method not in ('manual_bank', 'provider') then raise exception 'invalid_input'; end if;
  -- Provider refunds need a real provider payment; manual payments are refunded manually.
  if target_method = 'provider' and (a.provider is null or a.provider not in ('payfast_sandbox', 'peach_sandbox')
    or a.provider_payment_id is null) then raise exception 'provider_refund_unavailable'; end if;
  new_amount := coalesce(target_amount_cents, r.amount_cents);
  if new_amount <= 0 or new_amount > r.amount_cents then raise exception 'invalid_amount'; end if;
  -- This request's own amount is part of the in-play total, so add it back.
  if new_amount > public.payment_refundable_cents(a.id) + r.amount_cents then raise exception 'amount_exceeds_refundable'; end if;
  update public.refund_requests set status = 'approved', method = target_method, amount_cents = new_amount,
    decision_note = nullif(btrim(coalesce(target_note, '')), ''), decided_by = auth.uid(), decided_at = now()
    where id = r.id;
  insert into public.audit_events(event_type, actor_id, subject_profile_id, entity_type, entity_id, metadata)
    values ('refund.approved', auth.uid(), r.payer_id, 'refund_request', r.id,
      jsonb_build_object('method', target_method, 'amount_cents', new_amount::text));
  return true;
end $$;
revoke all on function public.decide_refund(uuid, boolean, text, text, bigint) from public, anon;
grant execute on function public.decide_refund(uuid, boolean, text, text, bigint) to authenticated;

create function public.complete_manual_refund(target_refund uuid, target_reference text)
returns boolean language plpgsql security definer set search_path = public as $$
declare r public.refund_requests;
begin
  if not public.current_user_is_active_staff() then raise exception 'forbidden'; end if;
  if length(btrim(coalesce(target_reference, ''))) not between 1 and 200 then raise exception 'reference_required'; end if;
  select * into r from public.refund_requests where id = target_refund for update;
  if not found then raise exception 'refund_not_found'; end if;
  if r.status = 'processed' then return false; end if;
  if r.status <> 'approved' or r.method <> 'manual_bank' then raise exception 'refund_not_ready'; end if;
  update public.refund_requests set status = 'processed', external_reference = btrim(target_reference),
    processed_by = auth.uid(), processed_at = now() where id = r.id;
  perform public.sync_order_refund_state(r.payment_attempt_id);
  insert into public.audit_events(event_type, actor_id, subject_profile_id, entity_type, entity_id, metadata)
    values ('refund.processed', auth.uid(), r.payer_id, 'refund_request', r.id,
      jsonb_build_object('method', 'manual_bank', 'amount_cents', r.amount_cents::text));
  return true;
end $$;
revoke all on function public.complete_manual_refund(uuid, text) from public, anon;
grant execute on function public.complete_manual_refund(uuid, text) to authenticated;

-- Staff claim an approved provider refund before the server calls the
-- provider, so two clicks cannot send the same refund twice.
create function public.start_provider_refund(target_refund uuid)
returns table(refund_id uuid, provider text, provider_payment_id text, amount_cents text, reason text)
language plpgsql security definer set search_path = public as $$
declare r public.refund_requests; a public.payment_attempts;
begin
  if not public.current_user_is_active_staff() then raise exception 'forbidden'; end if;
  select * into r from public.refund_requests where id = target_refund for update;
  if not found then raise exception 'refund_not_found'; end if;
  if r.status <> 'approved' or r.method <> 'provider' then raise exception 'refund_not_ready'; end if;
  select * into a from public.payment_attempts where id = r.payment_attempt_id;
  update public.refund_requests set status = 'processing', processed_by = auth.uid() where id = r.id;
  return query select r.id, a.provider, a.provider_payment_id, r.amount_cents::text, r.reason;
end $$;
revoke all on function public.start_provider_refund(uuid) from public, anon;
grant execute on function public.start_provider_refund(uuid) to authenticated;

-- Server-only: records the provider's answer. A failure releases the amount.
create function public.finish_provider_refund(target_refund uuid, target_success boolean,
  target_provider_reference text, target_failure_reason text)
returns boolean language plpgsql security definer set search_path = public as $$
declare r public.refund_requests;
begin
  select * into r from public.refund_requests where id = target_refund for update;
  if not found then raise exception 'refund_not_found'; end if;
  if r.status in ('processed', 'failed') then return false; end if;
  if r.status <> 'processing' then raise exception 'refund_not_ready'; end if;
  if target_success then
    update public.refund_requests set status = 'processed', processed_at = now(),
      external_reference = nullif(btrim(coalesce(target_provider_reference, '')), '') where id = r.id;
    perform public.sync_order_refund_state(r.payment_attempt_id);
  else
    update public.refund_requests set status = 'failed',
      failure_reason = left(coalesce(nullif(btrim(target_failure_reason), ''), 'Provider refund failed'), 500)
      where id = r.id;
  end if;
  insert into public.audit_events(event_type, actor_id, subject_profile_id, entity_type, entity_id, metadata)
    values (case when target_success then 'refund.processed' else 'refund.failed' end, r.processed_by, r.payer_id,
      'refund_request', r.id, jsonb_build_object('method', 'provider', 'amount_cents', r.amount_cents::text));
  return true;
end $$;
revoke all on function public.finish_provider_refund(uuid, boolean, text, text) from public, anon, authenticated;
grant execute on function public.finish_provider_refund(uuid, boolean, text, text) to service_role;

-- Cancelling a bulk order raises a full refund request for every paid order
-- in it, then opens a fresh collecting bulk order.
create function public.cancel_bulk_order(target_bulk uuid) returns integer
language plpgsql security definer set search_path = public as $$
declare b public.bulk_orders; a record; raised integer := 0; due bigint;
begin
  if not public.current_user_is_active_staff() then raise exception 'forbidden'; end if;
  select * into b from public.bulk_orders where id = target_bulk for update;
  if not found then raise exception 'bulk_order_not_found'; end if;
  if b.status in ('distributed', 'cancelled') then raise exception 'bulk_order_closed'; end if;
  update public.bulk_orders set status = 'cancelled' where id = b.id;
  if b.status = 'collecting' then
    insert into public.bulk_orders (reference) values ('BO-' || to_char(now(), 'YYYYMMDD-HH24MISS'));
  end if;
  for a in select p.* from public.payment_attempts p join public.orders o on o.id = p.order_id
    where o.bulk_order_id = b.id and o.status = 'paid' and p.status = 'succeeded'
    order by p.id for update of p loop
    due := public.payment_refundable_cents(a.id);
    if due > 0 then
      insert into public.refund_requests(payment_attempt_id, payer_id, requested_by, amount_cents, reason)
        values (a.id, a.payer_id, auth.uid(), due, 'Bulk order cancelled');
      raised := raised + 1;
    end if;
  end loop;
  insert into public.audit_events(event_type, actor_id, entity_type, entity_id, metadata)
    values ('bulk_order.cancelled', auth.uid(), 'bulk_order', b.id, jsonb_build_object('refunds_requested', raised));
  return raised;
end $$;
revoke all on function public.cancel_bulk_order(uuid) from public, anon;
grant execute on function public.cancel_bulk_order(uuid) to authenticated;

-- ============================================================
-- 5. Read models
-- ============================================================
-- Settled payments with what can still be refunded. Staff see everyone's;
-- a payer sees their own.
create function public.list_refundable_payments()
returns table(attempt_id uuid, payer_id uuid, payer_name text, kind text, provider text,
  amount_cents text, refundable_cents text, completed_at timestamptz, receipt_number text,
  order_id uuid, invoice_number text)
language plpgsql stable security definer set search_path = public as $$
declare staff boolean := public.current_user_is_active_staff();
begin
  if not staff and not public.payment_actor_is_payer() then raise exception 'forbidden'; end if;
  return query select a.id, a.payer_id, coalesce(nullif(p.full_name, ''), p.email),
    case when a.booking_id is not null then 'booking' when a.order_id is not null then 'order' else 'invoice' end,
    a.provider, a.amount_cents::text, public.payment_refundable_cents(a.id)::text, a.completed_at,
    rc.receipt_number, a.order_id, i.invoice_number
    from public.payment_attempts a
    join public.profiles p on p.id = a.payer_id
    left join public.receipts rc on rc.payment_attempt_id = a.id
    left join public.invoices i on i.id = a.invoice_id
    where a.status = 'succeeded' and (staff or a.payer_id = auth.uid())
    order by a.completed_at desc nulls last;
end $$;
revoke all on function public.list_refundable_payments() from public, anon;
grant execute on function public.list_refundable_payments() to authenticated;

create function public.list_refund_requests()
returns table(id uuid, refund_number text, payment_attempt_id uuid, payer_id uuid, payer_name text,
  kind text, payment_amount_cents text, refundable_cents text, amount_cents text, reason text, status text,
  method text, decision_note text, external_reference text, failure_reason text, provider text,
  has_provider_payment boolean, created_at timestamptz, decided_at timestamptz, processed_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
declare staff boolean := public.current_user_is_active_staff();
begin
  if not staff and not public.payment_actor_is_payer() then raise exception 'forbidden'; end if;
  return query select r.id, r.refund_number, r.payment_attempt_id, r.payer_id,
    coalesce(nullif(p.full_name, ''), p.email),
    case when a.booking_id is not null then 'booking' when a.order_id is not null then 'order' else 'invoice' end,
    a.amount_cents::text, public.payment_refundable_cents(a.id)::text, r.amount_cents::text, r.reason, r.status,
    r.method, r.decision_note, r.external_reference, r.failure_reason, a.provider,
    a.provider_payment_id is not null, r.created_at, r.decided_at, r.processed_at
    from public.refund_requests r
    join public.payment_attempts a on a.id = r.payment_attempt_id
    join public.profiles p on p.id = r.payer_id
    where staff or r.payer_id = auth.uid()
    order by r.created_at desc;
end $$;
revoke all on function public.list_refund_requests() from public, anon;
grant execute on function public.list_refund_requests() to authenticated;

-- ============================================================
-- 6. Remaining RLS gaps (0030 covers the four ledger/lesson tables)
-- ============================================================
-- payment_allocations had RLS with no policy (clients saw nothing); give
-- payers and staff read access to allocations of their own payments.
create policy "Payer or staff read payment allocations"
  on public.payment_allocations for select using (
    public.current_user_is_active_staff() or exists(select 1 from public.payment_attempts a
      where a.id = payment_allocations.payment_attempt_id and a.payer_id = auth.uid())
      and public.current_user_can_view_lesson_finances());
revoke insert, update, delete, truncate on public.payment_allocations from anon, authenticated;

-- Bulk orders were readable by anonymous visitors, including admin notes.
-- The catalogue progress bar uses get_collecting_bulk_progress() instead.
drop policy "Anyone can read bulk orders" on public.bulk_orders;
create policy "Customers read bulk orders holding their orders"
  on public.bulk_orders for select using (exists(select 1 from public.orders o
    where o.bulk_order_id = bulk_orders.id and o.user_id = auth.uid()));
revoke all on public.bulk_orders from anon;
