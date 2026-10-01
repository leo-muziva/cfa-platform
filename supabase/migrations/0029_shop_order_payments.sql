-- Shop orders are always pay-now. CFA keeps no stock: a paid order is held
-- until the collecting bulk order reaches its threshold, then placed with
-- the supplier. Orders reach a bulk order only after a verified payment.
--
-- Lifecycle: draft (editable cart) -> pending_payment (locked, checkout
-- started) -> paid (verified provider event). pending_payment can return to
-- draft through reopen_order_cart. 'submitted' remains for historical,
-- unpaid orders created before this migration.

-- ============================================================
-- 1. Order status and one open cart per customer
-- ============================================================
alter table public.orders drop constraint orders_status_check;
alter table public.orders add constraint orders_status_check
  check (status in ('draft', 'pending_payment', 'paid', 'submitted', 'cancelled'));

drop index public.orders_one_draft_per_user;
create unique index orders_one_open_cart_per_user
  on public.orders (user_id)
  where status in ('draft', 'pending_payment');

-- ============================================================
-- 2. Customer and admin policies
-- ============================================================
-- Customers may only create and edit plain drafts. pending_payment and paid
-- are set by the security-definer checkout and settlement routines, so the
-- API can no longer skip payment or attach an order to a bulk order.
drop policy "Users can create own orders" on public.orders;
create policy "Users can create own orders"
  on public.orders for insert
  with check (auth.uid() = user_id and status = 'draft' and bulk_order_id is null);

drop policy "Users can update own draft orders" on public.orders;
create policy "Users can update own draft orders"
  on public.orders for update
  using (auth.uid() = user_id and status = 'draft')
  with check (auth.uid() = user_id and status in ('draft', 'cancelled') and bulk_order_id is null);

-- Shop policies used the legacy profiles.role column. Staff capability now
-- comes from is_staff/staff_type through current_user_is_admin().
drop policy "Admins can read all orders" on public.orders;
create policy "Admins can read all orders"
  on public.orders for select using (public.current_user_is_admin());

drop policy "Admins can update all orders" on public.orders;
create policy "Admins can update all orders"
  on public.orders for update
  using (public.current_user_is_admin()) with check (public.current_user_is_admin());

drop policy "Admins can read all order items" on public.order_items;
create policy "Admins can read all order items"
  on public.order_items for select using (public.current_user_is_admin());

drop policy "Admins can manage bulk orders" on public.bulk_orders;
create policy "Admins can manage bulk orders"
  on public.bulk_orders for all
  using (public.current_user_is_admin()) with check (public.current_user_is_admin());

drop policy "Admins can manage product images" on public.product_images;
create policy "Admins can manage product images"
  on public.product_images for all
  using (public.current_user_is_admin()) with check (public.current_user_is_admin());

-- No migration ever allowed product writes, so admin create/edit/deactivate
-- failed or silently changed nothing, and inactive products were invisible.
create policy "Admins can read all products"
  on public.products for select using (public.current_user_is_admin());
create policy "Admins can insert products"
  on public.products for insert with check (public.current_user_is_admin());
create policy "Admins can update products"
  on public.products for update
  using (public.current_user_is_admin()) with check (public.current_user_is_admin());
create policy "Admins can delete products"
  on public.products for delete using (public.current_user_is_admin());

-- ============================================================
-- 3. Ledger links
-- ============================================================
-- run_monthly_invoices selects charges by type (membership, joining_fee,
-- pay-later lesson), so 'shop' charges never appear on a monthly invoice.
alter table public.charges drop constraint charges_type_check;
alter table public.charges add constraint charges_type_check
  check (type in ('lesson', 'rental', 'membership', 'joining_fee', 'lesson_adjustment', 'shop'));
alter table public.charges add column order_id uuid references public.orders(id);
create unique index charges_one_open_order_charge
  on public.charges (order_id)
  where order_id is not null and lifecycle_state <> 'voided';

alter table public.payment_attempts add column order_id uuid references public.orders(id);
create index payment_attempts_order_idx on public.payment_attempts (order_id) where order_id is not null;
alter table public.payment_attempts add constraint payment_attempts_single_target
  check (num_nonnulls(booking_id, invoice_id, order_id) <= 1);

-- ============================================================
-- 4. Attach to the collecting bulk order once paid
-- ============================================================
create or replace function public.attach_to_bulk_order()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  open_bulk uuid;
begin
  if new.status = 'paid' and (old.status is distinct from 'paid') and new.bulk_order_id is null then
    select id into open_bulk from public.bulk_orders where status = 'collecting' limit 1;

    -- No bulk order is collecting, so start one.
    if open_bulk is null then
      insert into public.bulk_orders (reference)
      values ('BO-' || to_char(now(), 'YYYYMMDD-HH24MISS'))
      returning id into open_bulk;
    end if;

    new.bulk_order_id = open_bulk;
  end if;
  return new;
end;
$$;

-- Customers can only read their own orders, so the catalogue progress bar
-- needs the pooled paid total without exposing anyone's order rows.
create function public.get_collecting_bulk_progress()
returns table(reference text, threshold numeric, total_cents bigint)
language sql stable security definer set search_path = public as $$
  select b.reference, b.threshold,
    coalesce(sum(round(i.unit_price * 100)::bigint * i.quantity), 0)::bigint
  from public.bulk_orders b
  left join public.orders o on o.bulk_order_id = b.id and o.status = 'paid'
  left join public.order_items i on i.order_id = o.id
  where b.status = 'collecting'
  group by b.id, b.reference, b.threshold;
$$;
revoke all on function public.get_collecting_bulk_progress() from public;
grant execute on function public.get_collecting_bulk_progress() to anon, authenticated;

-- ============================================================
-- 5. Checkout preparation
-- ============================================================
create function public.prepare_order_checkout(target_order uuid,
  target_provider text default 'payfast_sandbox', target_notes text default null)
returns table(attempt_id uuid, provider_reference text, amount_cents text, prices_changed boolean)
language plpgsql security definer set search_path = public as $$
declare o public.orders; ch public.charges; a public.payment_attempts; total bigint; changed boolean := false;
begin
  -- Dependents and minors cannot pay; their guardian is the payer.
  if not public.payment_actor_is_payer() then raise exception 'forbidden'; end if;
  if target_provider is null or target_provider not in ('payfast_sandbox', 'peach_sandbox') then
    raise exception 'invalid_input';
  end if;
  select * into o from public.orders where id = target_order for update;
  if not found or o.user_id <> auth.uid() then raise exception 'forbidden'; end if;
  if o.status not in ('draft', 'pending_payment') then raise exception 'checkout_unavailable'; end if;
  if not exists (select 1 from public.order_items where order_id = o.id) then raise exception 'empty_order'; end if;
  if exists (select 1 from public.order_items i join public.products p on p.id = i.product_id
    where i.order_id = o.id and not p.is_active) then raise exception 'product_unavailable'; end if;

  -- A draft takes current catalogue prices; the API could otherwise write any
  -- unit_price into a draft line. A pending order keeps its checkout snapshot.
  if o.status = 'draft' then
    update public.order_items i set unit_price = p.price
      from public.products p
      where p.id = i.product_id and i.order_id = o.id and i.unit_price <> p.price;
    changed := found;
  end if;

  select sum(round(i.unit_price * 100)::bigint * i.quantity) into total
    from public.order_items i where i.order_id = o.id;
  if coalesce(total, 0) <= 0 then raise exception 'checkout_unavailable'; end if;

  select * into ch from public.charges c
    where c.order_id = o.id and c.lifecycle_state = 'provisional' for update;
  if found and ch.amount_cents <> total then
    update public.charges set lifecycle_state = 'voided', voided_at = now(), updated_at = now() where id = ch.id;
    ch := null;
  end if;
  if ch.id is null then
    insert into public.charges(fencer_id, payer_id, order_id, type, amount_cents, status, period, description, lifecycle_state)
    values (o.user_id, o.user_id, o.id, 'shop', total, 'unpaid', date_trunc('month', now())::date, 'Shop order', 'provisional')
    returning * into ch;
  end if;

  update public.orders set status = 'pending_payment',
    notes = case when target_notes is null then notes else nullif(btrim(target_notes), '') end
    where id = o.id;

  select * into a from public.payment_attempts p
    where p.order_id = o.id and p.provider = target_provider and p.status = 'pending' and p.amount_cents = total
    order by p.created_at desc limit 1;
  if not found then
    insert into public.payment_attempts(payer_id, order_id, provider, provider_reference, amount_cents)
    values (o.user_id, o.id, target_provider, 'cfa' || replace(gen_random_uuid()::text, '-', ''), total)
    returning * into a;
  end if;
  return query select a.id, a.provider_reference, a.amount_cents::text, changed;
end $$;
revoke all on function public.prepare_order_checkout(uuid, text, text) from public, anon;
grant execute on function public.prepare_order_checkout(uuid, text, text) to authenticated;

-- Unlocks a pending order for editing. Open attempts are failed so a payment
-- that still completes is credited instead of settling a changed order.
create function public.reopen_order_cart(target_order uuid) returns boolean
language plpgsql security definer set search_path = public as $$
declare o public.orders;
begin
  select * into o from public.orders where id = target_order for update;
  if not found or o.user_id <> auth.uid() then raise exception 'forbidden'; end if;
  if o.status = 'draft' then return false; end if;
  if o.status <> 'pending_payment' then raise exception 'checkout_unavailable'; end if;
  update public.charges set lifecycle_state = 'voided', voided_at = now(), updated_at = now()
    where order_id = o.id and lifecycle_state = 'provisional';
  update public.payment_attempts set status = 'failed', completed_at = now()
    where order_id = o.id and status = 'pending';
  update public.orders set status = 'draft' where id = o.id;
  return true;
end $$;
revoke all on function public.reopen_order_cart(uuid) from public, anon;
grant execute on function public.reopen_order_cart(uuid) to authenticated;

-- ============================================================
-- 6. Order-aware versions of the shared payment routines (from 0025)
-- ============================================================
create or replace function public.get_payment_checkout(target_attempt uuid)
returns table(attempt_id uuid,provider text,provider_reference text,amount_cents text,currency text,description text)
language plpgsql security definer set search_path=public as $$
declare a public.payment_attempts;
begin
  if not public.payment_actor_is_payer() then raise exception 'forbidden'; end if;
  select * into a from public.payment_attempts p where p.id=target_attempt and p.payer_id=auth.uid();
  if not found then raise exception 'forbidden'; end if;
  if a.status<>'pending' then raise exception 'checkout_unavailable'; end if;
  if a.booking_id is not null and not exists(select 1 from public.bookings b where b.id=a.booking_id
    and b.payment_state='held' and b.status='scheduled' and b.hold_expires_at>now()) then raise exception 'checkout_unavailable'; end if;
  if a.invoice_id is not null and not exists(select 1 from public.invoices i where i.id=a.invoice_id and i.status<>'paid')
    then raise exception 'checkout_unavailable'; end if;
  if a.order_id is not null and not exists(select 1 from public.orders o where o.id=a.order_id and o.status='pending_payment')
    then raise exception 'checkout_unavailable'; end if;
  return query select a.id,a.provider,a.provider_reference,a.amount_cents::text,a.currency,
    case when a.booking_id is not null then 'CFA lesson payment'
      when a.order_id is not null then 'CFA shop order' else 'CFA invoice payment' end;
end $$;

create or replace function public.record_payment_event(target_provider text,target_event_id text,target_payment_id text,
  target_reference text,target_status text,target_amount_cents bigint,target_currency text)
returns boolean language plpgsql security definer set search_path=public as $$
declare a public.payment_attempts; c public.charges; remaining bigint; allocated bigint; settled boolean:=true;
begin
  if target_provider is null or target_provider not in ('payfast_sandbox','peach_sandbox')
    or nullif(target_event_id,'') is null or nullif(target_payment_id,'') is null
    or target_status is null or target_status not in ('pending','succeeded','failed','cancelled') then raise exception 'invalid_input'; end if;
  -- Lock the business object before the attempt, matching preparation/cancellation.
  select * into a from public.payment_attempts p where p.provider=target_provider and p.provider_reference=target_reference;
  if not found then raise exception 'payment_attempt_not_found'; end if;
  if a.booking_id is not null then perform 1 from public.bookings where id=a.booking_id for update;
  elsif a.invoice_id is not null then perform 1 from public.invoices where id=a.invoice_id for update;
  elsif a.order_id is not null then perform 1 from public.orders where id=a.order_id for update;
  else raise exception 'checkout_unavailable'; end if;
  select * into a from public.payment_attempts where id=a.id for update;
  if target_amount_cents is distinct from a.amount_cents or target_currency is distinct from a.currency then raise exception 'payment_mismatch'; end if;
  if a.provider_payment_id is not null and a.provider_payment_id<>target_payment_id then raise exception 'payment_mismatch'; end if;
  insert into public.provider_events(provider,provider_event_id,event_type,payload,processed_at)
  values(target_provider,target_event_id,'payment.'||target_status,
    jsonb_build_object('attempt_id',a.id,'payment_id',target_payment_id,'amount_cents',target_amount_cents::text,'currency',target_currency),now())
  on conflict(provider,provider_event_id) do nothing;
  if not found then return false; end if;
  if a.status='succeeded' then return false; end if;
  update public.payment_attempts set provider_payment_id=target_payment_id where id=a.id;
  if target_status<>'succeeded' then
    update public.payment_attempts set status=case when target_status='pending' then status else 'failed' end,
      completed_at=case when target_status='pending' then completed_at else now() end where id=a.id;
    return true;
  end if;
  if a.booking_id is not null then settled:=public.settle_booking_hold(a.id); end if;
  -- An order settles only if it is still awaiting this exact amount. A reopened
  -- or changed order keeps the money as account credit instead.
  if a.order_id is not null then
    settled:=exists(select 1 from public.orders o join public.charges ch on ch.order_id=o.id
      where o.id=a.order_id and o.status='pending_payment' and ch.lifecycle_state='provisional'
        and ch.amount_cents=a.amount_cents and ch.payer_id=a.payer_id)
      -- A charge voided after this attempt began means the cart was reopened
      -- since; strict > because preparation voids and inserts in one transaction.
      and not exists(select 1 from public.charges v where v.order_id=a.order_id
        and v.lifecycle_state='voided' and v.voided_at>a.created_at);
    if settled then
      update public.charges set lifecycle_state='finalized',finalized_at=now(),updated_at=now()
        where order_id=a.order_id and lifecycle_state='provisional';
    end if;
  end if;
  remaining:=a.amount_cents;
  if settled then
    for c in select ch.* from public.charges ch where
      (a.booking_id is not null and ch.booking_id=a.booking_id and ch.lifecycle_state='finalized') or
      (a.invoice_id is not null and exists(select 1 from public.invoice_lines l where l.invoice_id=a.invoice_id and l.charge_id=ch.id)) or
      (a.order_id is not null and ch.order_id=a.order_id and ch.lifecycle_state='finalized')
      order by ch.id for update loop
      if c.payer_id<>a.payer_id then raise exception 'payment_mismatch'; end if;
      allocated:=least(remaining,public.payment_charge_outstanding(c.id));
      if allocated>0 then
        insert into public.payment_allocations(payment_attempt_id,charge_id,amount_cents) values(a.id,c.id,allocated);
        remaining:=remaining-allocated;
      end if;
      if public.payment_charge_outstanding(c.id)=0 then update public.charges set status='paid',paid_at=coalesce(paid_at,now()),updated_at=now() where id=c.id; end if;
    end loop;
    -- The bulk-order trigger attaches the order on this transition.
    if a.order_id is not null then update public.orders set status='paid' where id=a.order_id; end if;
  end if;
  if remaining>0 then insert into public.ledger_credits(payer_id,booking_id,payment_attempt_id,amount_cents,reason)
    values(a.payer_id,a.booking_id,a.id,remaining,case when settled then 'Online payment excess'
      when a.order_id is not null then 'Payment received for a changed shop order'
      else 'Payment received after lesson hold expiry' end); end if;
  update public.payment_attempts set status='succeeded',completed_at=now() where id=a.id;
  if a.invoice_id is not null and not exists(select 1 from public.invoice_lines l where l.invoice_id=a.invoice_id
    and public.payment_charge_outstanding(l.charge_id)>0) then update public.invoices set status='paid',paid_at=coalesce(paid_at,now()) where id=a.invoice_id; end if;
  insert into public.receipts(payer_id,invoice_id,payment_attempt_id,amount_cents) values(a.payer_id,a.invoice_id,a.id,a.amount_cents);
  insert into public.audit_events(event_type,entity_type,entity_id,metadata) values('payment.succeeded','payment_attempt',a.id,
    jsonb_build_object('provider',target_provider,'credited_cents',remaining::text,'order_id',a.order_id));
  return true;
end $$;

create or replace function public.get_payment_status(target_attempt uuid)
returns table(attempt_id uuid,status text,kind text,credited boolean,amount_cents text)
language plpgsql stable security definer set search_path=public as $$
begin
  if not public.payment_actor_is_payer() then raise exception 'forbidden'; end if;
  return query select a.id,a.status,
    case when a.booking_id is not null then 'booking' when a.order_id is not null then 'order' else 'invoice' end,
    exists(select 1 from public.ledger_credits c where c.payment_attempt_id=a.id),a.amount_cents::text
    from public.payment_attempts a where a.id=target_attempt and a.payer_id=auth.uid();
end $$;

-- create or replace keeps the 0025 grants; restate the webhook restriction.
revoke all on function public.record_payment_event(text,text,text,text,text,bigint,text) from public,anon,authenticated;
grant execute on function public.record_payment_event(text,text,text,text,text,bigint,text) to service_role;
