-- A provider refund whose API call timed out stays 'processing' because the
-- outcome is unknown (PayFast refunds have no idempotency key). Staff check
-- the PayFast dashboard, then record what actually happened here instead of
-- sending the refund again.
create function public.resolve_processing_refund(target_refund uuid, target_processed boolean,
  target_reference text, target_note text)
returns boolean language plpgsql security definer set search_path = public as $$
declare r public.refund_requests;
begin
  if not public.current_user_is_active_staff() then raise exception 'forbidden'; end if;
  if length(btrim(coalesce(target_note, ''))) not between 1 and 500 then raise exception 'note_required'; end if;
  if target_processed and length(btrim(coalesce(target_reference, ''))) not between 1 and 200 then
    raise exception 'reference_required';
  end if;
  select * into r from public.refund_requests where id = target_refund for update;
  if not found then raise exception 'refund_not_found'; end if;
  if r.status <> 'processing' then raise exception 'refund_not_ready'; end if;
  if target_processed then
    update public.refund_requests set status = 'processed', processed_at = now(), processed_by = auth.uid(),
      external_reference = btrim(target_reference),
      decision_note = concat_ws(' | ', decision_note, 'Resolved: ' || btrim(target_note)) where id = r.id;
    perform public.sync_order_refund_state(r.payment_attempt_id);
  else
    -- Failed releases the amount so it can be refunded again, manually or via PayFast.
    update public.refund_requests set status = 'failed', failure_reason = left(btrim(target_note), 500)
      where id = r.id;
  end if;
  insert into public.audit_events(event_type, actor_id, subject_profile_id, entity_type, entity_id, metadata)
    values (case when target_processed then 'refund.processed' else 'refund.failed' end, auth.uid(), r.payer_id,
      'refund_request', r.id, jsonb_build_object('method', r.method, 'resolved_manually', true,
        'amount_cents', r.amount_cents::text));
  return true;
end $$;
revoke all on function public.resolve_processing_refund(uuid, boolean, text, text) from public, anon;
grant execute on function public.resolve_processing_refund(uuid, boolean, text, text) to authenticated;

-- Anonymous visitors never see refunds or allocations. Without the grant the
-- denial is a clean privilege error rather than a policy-helper failure.
revoke select on public.refund_requests, public.payment_allocations from anon;

-- Bulk references were second-resolution timestamps, so a bulk order opened
-- in the same second (or transaction) as another collided on the unique key.
create function public.next_bulk_order_reference() returns text
language sql volatile set search_path = public as $$
  select 'BO-' || to_char(clock_timestamp(), 'YYYYMMDD-HH24MISS') || '-'
    || substr(replace(gen_random_uuid()::text, '-', ''), 1, 4);
$$;
revoke all on function public.next_bulk_order_reference() from public, anon, authenticated;

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
    if open_bulk is null then
      insert into public.bulk_orders (reference) values (public.next_bulk_order_reference())
      returning id into open_bulk;
    end if;
    new.bulk_order_id = open_bulk;
  end if;
  return new;
end;
$$;

-- Same behaviour as 0031, plus a unique reference and one refund.requested
-- audit row per raised request.
create or replace function public.cancel_bulk_order(target_bulk uuid) returns integer
language plpgsql security definer set search_path = public as $$
declare b public.bulk_orders; a record; raised integer := 0; due bigint; refund uuid;
begin
  if not public.current_user_is_active_staff() then raise exception 'forbidden'; end if;
  select * into b from public.bulk_orders where id = target_bulk for update;
  if not found then raise exception 'bulk_order_not_found'; end if;
  if b.status in ('distributed', 'cancelled') then raise exception 'bulk_order_closed'; end if;
  update public.bulk_orders set status = 'cancelled' where id = b.id;
  if b.status = 'collecting' then
    insert into public.bulk_orders (reference) values (public.next_bulk_order_reference());
  end if;
  for a in select p.* from public.payment_attempts p join public.orders o on o.id = p.order_id
    where o.bulk_order_id = b.id and o.status = 'paid' and p.status = 'succeeded'
    order by p.id for update of p loop
    due := public.payment_refundable_cents(a.id);
    if due > 0 then
      insert into public.refund_requests(payment_attempt_id, payer_id, requested_by, amount_cents, reason)
        values (a.id, a.payer_id, auth.uid(), due, 'Bulk order cancelled') returning id into refund;
      insert into public.audit_events(event_type, actor_id, subject_profile_id, entity_type, entity_id, metadata)
        values ('refund.requested', auth.uid(), a.payer_id, 'refund_request', refund,
          jsonb_build_object('payment_attempt_id', a.id, 'amount_cents', due::text, 'bulk_order_id', b.id));
      raised := raised + 1;
    end if;
  end loop;
  insert into public.audit_events(event_type, actor_id, entity_type, entity_id, metadata)
    values ('bulk_order.cancelled', auth.uid(), 'bulk_order', b.id, jsonb_build_object('refunds_requested', raised));
  return raised;
end $$;
