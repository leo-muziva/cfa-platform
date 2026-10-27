-- Account credit (ledger_credits) was recorded but never used. Billing took
-- it off "Amount outstanding", but invoice checkout still charged the full
-- invoice, so the two numbers disagreed and the credit was never spent.
-- credit_consumptions already existed for this and payment_charge_outstanding
-- already subtracts it; nothing ever wrote to it.
--
-- Credit is now applied to an invoice when its checkout starts, or when staff
-- record a manual payment for it. Oldest credit first, oldest line first.

create function public.apply_payer_credit_to_invoice(target_invoice uuid) returns bigint
language plpgsql security definer set search_path=public as $$
declare i public.invoices; ch record; cr record; due bigint; used bigint; applied bigint:=0;
begin
  select * into i from public.invoices where id=target_invoice for update;
  if not found or i.status='paid' then return 0; end if;
  -- lock this payer's credit so two checkouts can't spend the same credit
  perform 1 from public.ledger_credits where payer_id=i.payer_id for update;
  for ch in select c.id from public.invoice_lines l join public.charges c on c.id=l.charge_id
    where l.invoice_id=i.id and c.payer_id=i.payer_id order by c.created_at, c.id loop
    due:=public.payment_charge_outstanding(ch.id);
    continue when due<=0;
    for cr in select lc.id, coalesce(lc.amount_cents,round(lc.amount*100)::bigint)
        -coalesce((select sum(cc.amount_cents) from public.credit_consumptions cc where cc.ledger_credit_id=lc.id),0) as left_cents
      from public.ledger_credits lc where lc.payer_id=i.payer_id order by lc.created_at, lc.id loop
      exit when due<=0;
      continue when cr.left_cents<=0;
      used:=least(due,cr.left_cents);
      insert into public.credit_consumptions(ledger_credit_id,charge_id,amount_cents) values(cr.id,ch.id,used)
        on conflict(ledger_credit_id,charge_id) do update set amount_cents=public.credit_consumptions.amount_cents+excluded.amount_cents;
      due:=due-used;
      applied:=applied+used;
    end loop;
    if public.payment_charge_outstanding(ch.id)=0 then
      update public.charges set status='paid',paid_at=coalesce(paid_at,now()),updated_at=now() where id=ch.id;
    end if;
  end loop;
  if applied>0 then
    -- credit can cover the whole invoice
    if not exists(select 1 from public.invoice_lines l where l.invoice_id=i.id and public.payment_charge_outstanding(l.charge_id)>0) then
      update public.invoices set status='paid',paid_at=coalesce(paid_at,now()) where id=i.id;
    end if;
    insert into public.audit_events(event_type,actor_id,subject_profile_id,entity_type,entity_id,metadata)
      values('invoice.credit_applied',auth.uid(),i.payer_id,'invoice',i.id,jsonb_build_object('amount_cents',applied::text));
  end if;
  return applied;
end $$;
revoke all on function public.apply_payer_credit_to_invoice(uuid) from public,anon,authenticated;

-- Same as 0025, plus: an invoice checkout applies credit first. When credit
-- covers the whole invoice there is nothing to pay, so no row comes back
-- (raising would undo the credit).
create or replace function public.prepare_payment_checkout(target_booking uuid default null,target_invoice uuid default null,
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
    if exists(select 1 from public.invoice_lines l join public.charges c on c.id=l.charge_id
      where l.invoice_id=i.id and c.payer_id<>i.payer_id) then raise exception 'forbidden'; end if;
    perform public.apply_payer_credit_to_invoice(i.id);
    select sum(public.payment_charge_outstanding(c.id)) into total from public.invoice_lines l
      join public.charges c on c.id=l.charge_id where l.invoice_id=i.id;
    if coalesce(total,0)<=0 and exists(select 1 from public.invoices where id=i.id and status='paid') then return; end if;
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

-- Same as 0025, plus: credit is applied before staff record what was paid.
create or replace function public.record_manual_invoice_payment(target_invoice uuid) returns boolean
language plpgsql security definer set search_path=public as $$
declare i public.invoices; c public.charges; total bigint:=0; due bigint; attempt uuid;
begin
  if not exists(select 1 from public.profiles where id=auth.uid() and is_active and is_staff)
    then raise exception 'forbidden'; end if;
  select * into i from public.invoices where id=target_invoice for update;
  if not found then raise exception 'invoice_not_found'; end if;
  if i.status='paid' then return false; end if;
  perform public.apply_payer_credit_to_invoice(i.id);
  -- credit covered all of it
  if exists(select 1 from public.invoices where id=i.id and status='paid') then return true; end if;
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

-- Credit the payer has not used yet. Payers can't read credit_consumptions
-- directly, so billing asks for this.
create function public.get_my_available_credit() returns text
language plpgsql stable security definer set search_path=public as $$
begin
  if not public.payment_actor_is_payer() then raise exception 'forbidden'; end if;
  return coalesce((select sum(greatest(0,coalesce(lc.amount_cents,round(lc.amount*100)::bigint)
    -coalesce((select sum(cc.amount_cents) from public.credit_consumptions cc where cc.ledger_credit_id=lc.id),0)))
    from public.ledger_credits lc where lc.payer_id=auth.uid()),0)::text;
end $$;
revoke all on function public.get_my_available_credit() from public,anon;
grant execute on function public.get_my_available_credit() to authenticated;
