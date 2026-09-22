-- Provider protocols terminate at the service boundary. Ledger settlement is shared.
alter table public.payment_attempts add column currency text not null default 'ZAR',
  add column provider_payment_id text;
create unique index payment_attempt_provider_payment_key on public.payment_attempts(provider,provider_payment_id)
  where provider_payment_id is not null;
alter table public.receipts add column payment_attempt_id uuid unique references public.payment_attempts(id),
  add column amount_cents bigint;
update public.receipts set amount_cents=round(amount*100)::bigint;
alter table public.ledger_credits alter column charge_id drop not null,
  alter column participant_id drop not null,
  add column payment_attempt_id uuid unique references public.payment_attempts(id);

-- Existing callers still write rands; newer ledger callers write cents. Keep both exact.
create function public.sync_payment_money() returns trigger language plpgsql set search_path=public as $$
begin
  if TG_OP='INSERT' then
    if new.amount_cents is null then new.amount_cents:=round(new.amount*100)::bigint;
    else new.amount:=new.amount_cents/100.0; end if;
  elsif new.amount_cents is distinct from old.amount_cents then new.amount:=new.amount_cents/100.0;
  elsif new.amount is distinct from old.amount then new.amount_cents:=round(new.amount*100)::bigint;
  end if;
  return new;
end $$;
create trigger sync_charge_money before insert or update on public.charges for each row execute function public.sync_payment_money();
create trigger sync_credit_money before insert or update on public.ledger_credits for each row execute function public.sync_payment_money();
create trigger sync_attempt_money before insert or update on public.payment_attempts for each row execute function public.sync_payment_money();
create trigger sync_receipt_money before insert or update on public.receipts for each row execute function public.sync_payment_money();

create function public.payment_actor_is_payer() returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.profiles p where p.id=auth.uid() and p.is_active
    and (p.date_of_birth is null or p.date_of_birth<=current_date-interval '18 years')
    and public.active_billing_payer(p.id)=p.id);
$$;
revoke all on function public.payment_actor_is_payer() from public,anon;
grant execute on function public.payment_actor_is_payer() to authenticated;

create function public.payment_charge_outstanding(target_charge uuid) returns bigint
language sql stable security definer set search_path=public as $$
  select case when c.status='paid' or c.lifecycle_state in ('voided','waived') then 0::bigint else greatest(0,
    coalesce(c.amount_cents,round(c.amount*100)::bigint)
    -coalesce((select sum(a.amount_cents) from public.invoice_adjustments a where a.charge_id=c.id),0)
    -coalesce((select sum(a.amount_cents) from public.payment_allocations a where a.charge_id=c.id),0)
    -coalesce((select sum(a.amount_cents) from public.credit_consumptions a where a.charge_id=c.id),0))::bigint end
  from public.charges c where c.id=target_charge;
$$;
revoke all on function public.payment_charge_outstanding(uuid) from public,anon,authenticated;

create function public.prepare_payment_checkout(target_booking uuid default null,target_invoice uuid default null,
  target_provider text default 'payfast_sandbox')
returns table(attempt_id uuid,provider_reference text,amount_cents text)
language plpgsql security definer set search_path=public as $$
declare b public.bookings; i public.invoices; a public.payment_attempts; total bigint; payer uuid;
begin
  if not public.payment_actor_is_payer() then raise exception 'forbidden'; end if;
  if (target_booking is null)=(target_invoice is null) or target_provider not in ('payfast_sandbox','peach_sandbox')
    or target_provider is null then raise exception 'invalid_input'; end if;
  if target_booking is not null then
    select * into b from public.bookings where id=target_booking for update;
    if not found or b.payment_option<>'pay_now' or b.status<>'scheduled' or b.payment_state<>'held'
      or b.hold_expires_at is null or b.hold_expires_at<=now() then raise exception 'checkout_unavailable'; end if;
    if not exists(select 1 from public.charges c where c.booking_id=b.id and c.payer_id=auth.uid())
      or exists(select 1 from public.charges c where c.booking_id=b.id and c.payer_id<>auth.uid()) then raise exception 'forbidden'; end if;
    select sum(public.payment_charge_outstanding(c.id)) into total from public.charges c
      where c.booking_id=b.id and c.lifecycle_state='provisional';
    payer:=auth.uid();
  else
    select * into i from public.invoices where id=target_invoice for update;
    if not found then raise exception 'checkout_unavailable'; end if;
    if i.payer_id<>auth.uid() then raise exception 'forbidden'; end if;
    if i.status='paid' then raise exception 'checkout_unavailable'; end if;
    select sum(public.payment_charge_outstanding(c.id)) into total from public.invoice_lines l
      join public.charges c on c.id=l.charge_id where l.invoice_id=i.id;
    if exists(select 1 from public.invoice_lines l join public.charges c on c.id=l.charge_id
      where l.invoice_id=i.id and c.payer_id<>i.payer_id) then raise exception 'forbidden'; end if;
    payer:=i.payer_id;
  end if;
  if coalesce(total,0)<=0 then raise exception 'checkout_unavailable'; end if;
  select * into a from public.payment_attempts p where p.payer_id=payer and p.provider=target_provider
    and p.booking_id is not distinct from target_booking and p.invoice_id is not distinct from target_invoice
    and p.status='pending' and p.amount_cents=total order by p.created_at desc limit 1;
  if not found then
    insert into public.payment_attempts(payer_id,booking_id,invoice_id,provider,provider_reference,amount_cents)
    values(payer,target_booking,target_invoice,target_provider,'cfa'||replace(gen_random_uuid()::text,'-',''),total) returning * into a;
  end if;
  return query select a.id,a.provider_reference,a.amount_cents::text;
end $$;
revoke all on function public.prepare_payment_checkout(uuid,uuid,text) from public,anon;
grant execute on function public.prepare_payment_checkout(uuid,uuid,text) to authenticated;

create function public.get_payment_checkout(target_attempt uuid)
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
  return query select a.id,a.provider,a.provider_reference,a.amount_cents::text,a.currency,
    case when a.booking_id is not null then 'CFA lesson payment' else 'CFA invoice payment' end;
end $$;
revoke all on function public.get_payment_checkout(uuid) from public,anon;
grant execute on function public.get_payment_checkout(uuid) to authenticated;

create function public.record_payment_event(target_provider text,target_event_id text,target_payment_id text,
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
  remaining:=a.amount_cents;
  if settled then
    for c in select ch.* from public.charges ch where
      (a.booking_id is not null and ch.booking_id=a.booking_id and ch.lifecycle_state='finalized') or
      (a.invoice_id is not null and exists(select 1 from public.invoice_lines l where l.invoice_id=a.invoice_id and l.charge_id=ch.id))
      order by ch.id for update loop
      if c.payer_id<>a.payer_id then raise exception 'payment_mismatch'; end if;
      allocated:=least(remaining,public.payment_charge_outstanding(c.id));
      if allocated>0 then
        insert into public.payment_allocations(payment_attempt_id,charge_id,amount_cents) values(a.id,c.id,allocated);
        remaining:=remaining-allocated;
      end if;
      if public.payment_charge_outstanding(c.id)=0 then update public.charges set status='paid',paid_at=coalesce(paid_at,now()),updated_at=now() where id=c.id; end if;
    end loop;
  end if;
  if remaining>0 then insert into public.ledger_credits(payer_id,booking_id,payment_attempt_id,amount_cents,reason)
    values(a.payer_id,a.booking_id,a.id,remaining,case when settled then 'Online payment excess' else 'Payment received after lesson hold expiry' end); end if;
  update public.payment_attempts set status='succeeded',completed_at=now() where id=a.id;
  if a.invoice_id is not null and not exists(select 1 from public.invoice_lines l where l.invoice_id=a.invoice_id
    and public.payment_charge_outstanding(l.charge_id)>0) then update public.invoices set status='paid',paid_at=coalesce(paid_at,now()) where id=a.invoice_id; end if;
  insert into public.receipts(payer_id,invoice_id,payment_attempt_id,amount_cents) values(a.payer_id,a.invoice_id,a.id,a.amount_cents);
  insert into public.audit_events(event_type,entity_type,entity_id,metadata) values('payment.succeeded','payment_attempt',a.id,
    jsonb_build_object('provider',target_provider,'credited_cents',remaining::text));
  return true;
end $$;
revoke all on function public.record_payment_event(text,text,text,text,text,bigint,text) from public,anon,authenticated;
grant execute on function public.record_payment_event(text,text,text,text,text,bigint,text) to service_role;

create function public.get_payment_status(target_attempt uuid)
returns table(attempt_id uuid,status text,kind text,credited boolean,amount_cents text)
language plpgsql stable security definer set search_path=public as $$
begin
  if not public.payment_actor_is_payer() then raise exception 'forbidden'; end if;
  return query select a.id,a.status,case when a.booking_id is not null then 'booking' else 'invoice' end,
    exists(select 1 from public.ledger_credits c where c.payment_attempt_id=a.id),a.amount_cents::text
    from public.payment_attempts a where a.id=target_attempt and a.payer_id=auth.uid();
end $$;
revoke all on function public.get_payment_status(uuid) from public,anon;
grant execute on function public.get_payment_status(uuid) to authenticated;

create function public.get_invoice_payment_balances() returns table(invoice_id uuid,outstanding_cents text)
language plpgsql stable security definer set search_path=public as $$
begin
  if not public.payment_actor_is_payer() then raise exception 'forbidden'; end if;
  return query select i.id,case when i.status='paid' then '0' else coalesce(sum(public.payment_charge_outstanding(l.charge_id)),0)::text end
    from public.invoices i left join public.invoice_lines l on l.invoice_id=i.id where i.payer_id=auth.uid() group by i.id;
end $$;
revoke all on function public.get_invoice_payment_balances() from public,anon;
grant execute on function public.get_invoice_payment_balances() to authenticated;

create function public.get_payer_payment_balances() returns table(charge_id uuid,outstanding_cents text)
language plpgsql stable security definer set search_path=public as $$
begin
  if not public.payment_actor_is_payer() then raise exception 'forbidden'; end if;
  return query select c.id,public.payment_charge_outstanding(c.id)::text from public.charges c where c.payer_id=auth.uid();
end $$;
revoke all on function public.get_payer_payment_balances() from public,anon;
grant execute on function public.get_payer_payment_balances() to authenticated;

create function public.record_manual_invoice_payment(target_invoice uuid) returns boolean
language plpgsql security definer set search_path=public as $$
declare i public.invoices; c public.charges; total bigint:=0; due bigint; attempt uuid;
begin
  if not exists(select 1 from public.profiles where id=auth.uid() and is_active and is_staff)
    then raise exception 'forbidden'; end if;
  select * into i from public.invoices where id=target_invoice for update;
  if not found then raise exception 'invoice_not_found'; end if;
  if i.status='paid' then return false; end if;
  for c in select ch.* from public.charges ch join public.invoice_lines l on l.charge_id=ch.id
    where l.invoice_id=i.id order by ch.id for update of ch loop
    total:=total+public.payment_charge_outstanding(c.id);
  end loop;
  if total<=0 then raise exception 'checkout_unavailable'; end if;
  insert into public.payment_attempts(payer_id,invoice_id,provider,amount_cents,status,completed_at)
    values(i.payer_id,i.id,'manual',total,'succeeded',now()) returning id into attempt;
  for c in select ch.* from public.charges ch join public.invoice_lines l on l.charge_id=ch.id where l.invoice_id=i.id loop
    due:=public.payment_charge_outstanding(c.id);
    if due>0 then insert into public.payment_allocations(payment_attempt_id,charge_id,amount_cents) values(attempt,c.id,due); end if;
    update public.charges set status='paid',paid_at=coalesce(paid_at,now()),updated_at=now() where id=c.id;
  end loop;
  update public.invoices set status='paid',paid_at=now() where id=i.id;
  insert into public.receipts(payer_id,invoice_id,payment_attempt_id,amount_cents) values(i.payer_id,i.id,attempt,total);
  insert into public.audit_events(event_type,actor_id,entity_type,entity_id,metadata)
    values('payment.manual_recorded',auth.uid(),'payment_attempt',attempt,jsonb_build_object('invoice_id',i.id));
  return true;
end $$;
revoke all on function public.record_manual_invoice_payment(uuid) from public,anon;
grant execute on function public.record_manual_invoice_payment(uuid) to authenticated;

-- All authenticated roles, including staff, use validated RPCs for online records.
revoke insert,update,delete on public.payment_attempts,public.provider_events,public.payment_allocations,public.ledger_credits,public.receipts from anon,authenticated;
revoke all on function public.prepare_peach_sandbox_checkout(uuid) from public,anon,authenticated,service_role;
revoke all on function public.record_peach_sandbox_webhook(text,text,boolean,jsonb) from public,anon,authenticated,service_role;
