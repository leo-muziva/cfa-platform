-- Membership is paid after approval and activates only once paid.
--
-- Approval used to activate the membership at once and leave finalized
-- charges for the monthly invoice run. Now approval moves the application to
-- 'awaiting_payment' with provisional charges (which the monthly run never
-- picks up). The payer pays them directly through checkout, or staff record a
-- cash/EFT payment, and only then is the membership activated.
--
-- Memberships approved before this migration stay active and unchanged.

-- ============================================================
-- 1. Application state and ledger links
-- ============================================================
alter table public.membership_applications drop constraint membership_applications_status_check;
alter table public.membership_applications add constraint membership_applications_status_check
  check (status in ('pending','changes_requested','awaiting_payment','rejected','approved'));
alter table public.membership_applications
  add column payment_email_status text check (payment_email_status in ('sent','failed','not_configured')),
  add column payment_email_at timestamptz;

-- An approved application waiting for payment is still open: no second
-- application until it is paid or withdrawn.
drop index public.one_open_membership_application;
create unique index one_open_membership_application
  on public.membership_applications(applicant_id)
  where status in ('pending','changes_requested','awaiting_payment');

alter table public.charges add column membership_application_id uuid references public.membership_applications(id);
create index charges_membership_application_idx on public.charges(membership_application_id)
  where membership_application_id is not null;

alter table public.payment_attempts add column membership_application_id uuid references public.membership_applications(id);
create index payment_attempts_membership_application_idx on public.payment_attempts(membership_application_id)
  where membership_application_id is not null;
alter table public.payment_attempts drop constraint payment_attempts_single_target;
alter table public.payment_attempts add constraint payment_attempts_single_target
  check (num_nonnulls(booking_id, invoice_id, order_id, membership_application_id) <= 1);

-- A withdrawn approval leaves a voided membership charge behind; it must not
-- block approving the same person again in the same month.
drop index public.one_monthly_membership_charge;
create unique index one_monthly_membership_charge
  on public.charges(fencer_id,period) where type='membership' and lifecycle_state<>'voided';

-- ============================================================
-- 2. Applying and reviewing
-- ============================================================
create or replace function public.submit_membership_application(target_type uuid)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_id uuid; v_version integer;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if exists(select 1 from public.memberships where profile_id=auth.uid() and status='active') then
    raise exception 'active membership already exists';
  end if;
  if exists(select 1 from public.membership_applications where applicant_id=auth.uid()
    and status in ('pending','changes_requested','awaiting_payment')) then raise exception 'open application already exists'; end if;
  select coalesce(max(version),0)+1 into v_version from public.membership_applications
    where applicant_id=auth.uid();
  insert into public.membership_applications(applicant_id,membership_type_id,version,submitted_details)
  values(auth.uid(),target_type,v_version,jsonb_build_object('membership_type_id',target_type))
  returning id into v_id;
  insert into public.audit_events(event_type,actor_id,subject_profile_id,entity_type,entity_id)
  values('membership.application_submitted',auth.uid(),auth.uid(),'membership_application',v_id);
  return v_id;
end $$;

-- Approval now requests payment instead of activating. The amounts are
-- snapshotted from the product at approval, so a later price change does not
-- alter what this applicant was asked to pay.
create or replace function public.review_membership_application(
  application_id uuid, decision text, visible_response text default null, private_notes text default null
) returns void language plpgsql security definer set search_path=public as $$
declare app public.membership_applications; new_status text; payer uuid; mt public.membership_types;
  billing_period date:=date_trunc('month',(now() at time zone 'Africa/Johannesburg'))::date;
begin
  if not public.current_user_is_admin() then raise exception 'forbidden'; end if;
  if decision not in ('approve','request_changes','reject') then raise exception 'invalid decision'; end if;
  select * into app from public.membership_applications
    where id=$1 and status='pending' for update;
  if not found then raise exception 'pending application not found'; end if;
  new_status:=case decision when 'approve' then 'awaiting_payment'
    when 'request_changes' then 'changes_requested' else 'rejected' end;
  update public.membership_applications set status=new_status,
    visible_response=nullif(trim($3),''),
    reviewer_id=auth.uid(),reviewed_at=now(),updated_at=now() where id=$1;
  insert into public.membership_application_admin_notes(application_id,private_notes,updated_by)
  select $1,trim($4),auth.uid()
  where nullif(trim($4),'') is not null
  on conflict on constraint membership_application_admin_notes_pkey do update set
    private_notes=excluded.private_notes,updated_by=excluded.updated_by,updated_at=now();
  if decision='approve' then
    -- Someone who rejoins in a month whose dues are already charged starts
    -- the new membership from the first month that is not yet charged.
    while exists(select 1 from public.charges c where c.fencer_id=app.applicant_id and c.type='membership'
      and c.period=billing_period and c.lifecycle_state<>'voided') loop
      billing_period:=(billing_period+interval '1 month')::date;
    end loop;
    payer:=public.active_billing_payer(app.applicant_id);
    select * into mt from public.membership_types where id=app.membership_type_id;
    insert into public.charges(fencer_id,payer_id,membership_application_id,type,amount,status,period,description,lifecycle_state)
    values(app.applicant_id,payer,app.id,'membership',mt.price,'unpaid',billing_period,mt.name,'provisional');
    if mt.joining_fee>0 then
      insert into public.charges(fencer_id,payer_id,membership_application_id,type,amount,status,period,description,lifecycle_state)
      values(app.applicant_id,payer,app.id,'joining_fee',mt.joining_fee,'unpaid',billing_period,'First-time joining fee','provisional');
    end if;
  end if;
  insert into public.audit_events(event_type,actor_id,subject_profile_id,entity_type,entity_id,metadata)
  values('membership.application_'||case when decision='approve' then 'approved' else new_status end,auth.uid(),app.applicant_id,
    'membership_application',$1,jsonb_build_object('decision',decision));
end $$;

-- Staff withdraw an approval that will not be paid. A payment that still
-- arrives afterwards is kept as account credit by record_payment_event.
create function public.withdraw_membership_approval(target_application uuid, target_response text default null)
returns void language plpgsql security definer set search_path=public as $$
declare app public.membership_applications;
begin
  if not public.current_user_is_admin() then raise exception 'forbidden'; end if;
  select * into app from public.membership_applications
    where id=target_application and status='awaiting_payment' for update;
  if not found then raise exception 'awaiting_payment application not found'; end if;
  update public.membership_applications set status='rejected',
    visible_response=coalesce(nullif(trim(target_response),''),visible_response),
    reviewer_id=auth.uid(),reviewed_at=now(),updated_at=now() where id=app.id;
  update public.charges set lifecycle_state='voided',voided_at=now(),updated_at=now()
    where membership_application_id=app.id and lifecycle_state='provisional';
  update public.payment_attempts set status='failed',completed_at=now()
    where membership_application_id=app.id and status='pending';
  insert into public.audit_events(event_type,actor_id,subject_profile_id,entity_type,entity_id)
  values('membership.approval_withdrawn',auth.uid(),app.applicant_id,'membership_application',app.id);
end $$;
revoke all on function public.withdraw_membership_approval(uuid,text) from public,anon;
grant execute on function public.withdraw_membership_approval(uuid,text) to authenticated;

-- ============================================================
-- 3. Activation, shared by online and manual payment
-- ============================================================
-- Called inside the payment transaction with the application locked and its
-- charges already paid.
create function public.activate_paid_membership_application(target_application uuid, target_actor uuid)
returns void language plpgsql security definer set search_path=public as $$
declare app public.membership_applications;
  billing_period date:=date_trunc('month',(now() at time zone 'Africa/Johannesburg'))::date;
begin
  select * into app from public.membership_applications where id=target_application;
  insert into public.memberships(profile_id,membership_type_id,status)
  values(app.applicant_id,app.membership_type_id,'active')
  on conflict(profile_id) do update set membership_type_id=excluded.membership_type_id,
    status='active',started_at=now(),status_changed_at=now(),cancelled_at=null,updated_at=now();
  update public.profiles set membership_status='member',membership_type_id=app.membership_type_id
    where id=app.applicant_id;
  update public.membership_applications set status='approved',updated_at=now() where id=app.id;
  -- The first payment covers the month the membership starts. When payment
  -- lands in a later month than approval, move the charge to that month so
  -- the monthly run does not bill month-to-month dues for it a second time.
  update public.charges c set period=billing_period,updated_at=now()
    where c.membership_application_id=app.id and c.lifecycle_state='finalized' and c.period<>billing_period
      and not (c.type='membership' and exists(select 1 from public.charges o where o.fencer_id=c.fencer_id
        and o.type='membership' and o.period=billing_period and o.lifecycle_state<>'voided' and o.id<>c.id));
  insert into public.audit_events(event_type,actor_id,subject_profile_id,entity_type,entity_id)
  values('membership.activated',target_actor,app.applicant_id,'membership_application',app.id);
end $$;
revoke all on function public.activate_paid_membership_application(uuid,uuid) from public,anon,authenticated;

-- ============================================================
-- 4. Paying
-- ============================================================
create function public.prepare_membership_checkout(target_application uuid,
  target_provider text default 'payfast_sandbox')
returns table(attempt_id uuid, provider_reference text, amount_cents text)
language plpgsql security definer set search_path=public as $$
declare app public.membership_applications; a public.payment_attempts; total bigint;
begin
  -- Dependents and minors cannot pay; their guardian is the payer.
  if not public.payment_actor_is_payer() then raise exception 'forbidden'; end if;
  if target_provider is null or target_provider not in ('payfast_sandbox','peach_sandbox') then
    raise exception 'invalid_input';
  end if;
  select * into app from public.membership_applications where id=target_application for update;
  if not found then raise exception 'checkout_unavailable'; end if;
  if not exists(select 1 from public.charges c where c.membership_application_id=app.id
      and c.lifecycle_state='provisional' and c.payer_id=auth.uid())
    or exists(select 1 from public.charges c where c.membership_application_id=app.id
      and c.lifecycle_state='provisional' and c.payer_id<>auth.uid()) then raise exception 'forbidden'; end if;
  if app.status<>'awaiting_payment' then raise exception 'checkout_unavailable'; end if;
  select sum(public.payment_charge_outstanding(c.id)) into total from public.charges c
    where c.membership_application_id=app.id and c.lifecycle_state='provisional';
  if coalesce(total,0)<=0 then raise exception 'checkout_unavailable'; end if;
  select * into a from public.payment_attempts p where p.membership_application_id=app.id
    and p.payer_id=auth.uid() and p.provider=target_provider and p.status='pending' and p.amount_cents=total
    order by p.created_at desc limit 1;
  if not found then
    insert into public.payment_attempts(payer_id,membership_application_id,provider,provider_reference,amount_cents)
    values(auth.uid(),app.id,target_provider,'cfa'||replace(gen_random_uuid()::text,'-',''),total)
    returning * into a;
  end if;
  return query select a.id,a.provider_reference,a.amount_cents::text;
end $$;
revoke all on function public.prepare_membership_checkout(uuid,text) from public,anon;
grant execute on function public.prepare_membership_checkout(uuid,text) to authenticated;

-- Staff record a cash or EFT payment for an approved application.
create function public.record_manual_membership_payment(target_application uuid) returns boolean
language plpgsql security definer set search_path=public as $$
declare app public.membership_applications; c public.charges; total bigint:=0; due bigint; attempt uuid; payer uuid;
begin
  if not public.current_user_is_active_staff() then raise exception 'forbidden'; end if;
  select * into app from public.membership_applications where id=target_application for update;
  if not found then raise exception 'awaiting_payment application not found'; end if;
  if app.status='approved' then return false; end if;
  if app.status<>'awaiting_payment' then raise exception 'awaiting_payment application not found'; end if;
  for c in select ch.* from public.charges ch where ch.membership_application_id=app.id
    and ch.lifecycle_state='provisional' order by ch.id for update loop
    total:=total+public.payment_charge_outstanding(c.id);
    payer:=c.payer_id;
  end loop;
  if total<=0 then raise exception 'checkout_unavailable'; end if;
  -- Any online checkout still open would otherwise settle a paid application.
  update public.payment_attempts set status='failed',completed_at=now()
    where membership_application_id=app.id and status='pending';
  insert into public.payment_attempts(payer_id,membership_application_id,provider,amount_cents,status,completed_at)
    values(payer,app.id,'manual',total,'succeeded',now()) returning id into attempt;
  update public.charges set lifecycle_state='finalized',finalized_at=now(),updated_at=now()
    where membership_application_id=app.id and lifecycle_state='provisional';
  for c in select ch.* from public.charges ch where ch.membership_application_id=app.id
    and ch.lifecycle_state='finalized' order by ch.id loop
    due:=public.payment_charge_outstanding(c.id);
    if due>0 then insert into public.payment_allocations(payment_attempt_id,charge_id,amount_cents) values(attempt,c.id,due); end if;
    update public.charges set status='paid',paid_at=coalesce(paid_at,now()),updated_at=now() where id=c.id;
  end loop;
  insert into public.receipts(payer_id,payment_attempt_id,amount_cents) values(payer,attempt,total);
  insert into public.audit_events(event_type,actor_id,entity_type,entity_id,metadata)
    values('payment.manual_recorded',auth.uid(),'payment_attempt',attempt,
      jsonb_build_object('membership_application_id',app.id));
  perform public.activate_paid_membership_application(app.id,auth.uid());
  return true;
end $$;
revoke all on function public.record_manual_membership_payment(uuid) from public,anon;
grant execute on function public.record_manual_membership_payment(uuid) to authenticated;

-- ============================================================
-- 5. Read models
-- ============================================================
-- Approved applications this payer still has to pay, including dependents'.
-- Dependents are not payers and get 'forbidden', so they never see amounts.
create function public.list_my_membership_payments_due()
returns table(application_id uuid, applicant_id uuid, applicant_name text, membership_name text,
  membership_cents text, joining_fee_cents text, total_cents text, approved_at timestamptz)
language plpgsql stable security definer set search_path=public as $$
begin
  if not public.payment_actor_is_payer() then raise exception 'forbidden'; end if;
  return query select app.id, app.applicant_id, coalesce(nullif(p.full_name,''),p.email), mt.name,
    coalesce(sum(public.payment_charge_outstanding(c.id)) filter (where c.type='membership'),0)::text,
    coalesce(sum(public.payment_charge_outstanding(c.id)) filter (where c.type='joining_fee'),0)::text,
    coalesce(sum(public.payment_charge_outstanding(c.id)),0)::text,
    app.reviewed_at
    from public.membership_applications app
    join public.charges c on c.membership_application_id=app.id and c.lifecycle_state='provisional'
    join public.profiles p on p.id=app.applicant_id
    join public.membership_types mt on mt.id=app.membership_type_id
    where app.status='awaiting_payment' and c.payer_id=auth.uid()
    group by app.id, app.applicant_id, p.full_name, p.email, mt.name, app.reviewed_at
    order by app.reviewed_at;
end $$;
revoke all on function public.list_my_membership_payments_due() from public,anon;
grant execute on function public.list_my_membership_payments_due() to authenticated;

-- What the approval email needs. Admin-only, because it reads another
-- person's contact details.
create function public.get_membership_payment_notice(target_application uuid)
returns table(application_id uuid, applicant_id uuid, applicant_name text, payer_id uuid,
  payer_name text, payer_email text, membership_name text, total_cents text)
language plpgsql stable security definer set search_path=public as $$
begin
  if not public.current_user_is_admin() then raise exception 'forbidden'; end if;
  return query select app.id, app.applicant_id, coalesce(nullif(ap.full_name,''),ap.email),
    pp.id, coalesce(nullif(pp.full_name,''),pp.email), pp.email, mt.name,
    coalesce(sum(public.payment_charge_outstanding(c.id)),0)::text
    from public.membership_applications app
    join public.charges c on c.membership_application_id=app.id and c.lifecycle_state='provisional'
    join public.profiles ap on ap.id=app.applicant_id
    join public.profiles pp on pp.id=c.payer_id
    join public.membership_types mt on mt.id=app.membership_type_id
    where app.id=target_application and app.status='awaiting_payment'
    group by app.id, app.applicant_id, ap.full_name, ap.email, pp.id, pp.full_name, pp.email, mt.name;
end $$;
revoke all on function public.get_membership_payment_notice(uuid) from public,anon;
grant execute on function public.get_membership_payment_notice(uuid) to authenticated;

create function public.record_membership_payment_email(target_application uuid, target_outcome text)
returns void language plpgsql security definer set search_path=public as $$
declare app public.membership_applications;
begin
  if not public.current_user_is_admin() then raise exception 'forbidden'; end if;
  if target_outcome is null or target_outcome not in ('sent','failed','not_configured') then raise exception 'invalid_input'; end if;
  update public.membership_applications set payment_email_status=target_outcome,payment_email_at=now()
    where id=target_application returning * into app;
  if not found then raise exception 'application not found'; end if;
  insert into public.audit_events(event_type,actor_id,subject_profile_id,entity_type,entity_id)
  values('membership.payment_email_'||target_outcome,auth.uid(),app.applicant_id,'membership_application',app.id);
end $$;
revoke all on function public.record_membership_payment_email(uuid,text) from public,anon;
grant execute on function public.record_membership_payment_email(uuid,text) to authenticated;

-- ============================================================
-- 6. Membership-aware versions of the shared payment routines (from 0029)
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
  if a.membership_application_id is not null and not exists(select 1 from public.membership_applications m
    where m.id=a.membership_application_id and m.status='awaiting_payment') then raise exception 'checkout_unavailable'; end if;
  return query select a.id,a.provider,a.provider_reference,a.amount_cents::text,a.currency,
    case when a.booking_id is not null then 'CFA lesson payment'
      when a.order_id is not null then 'CFA shop order'
      when a.membership_application_id is not null then 'CFA membership' else 'CFA invoice payment' end;
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
  elsif a.membership_application_id is not null then perform 1 from public.membership_applications where id=a.membership_application_id for update;
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
  -- A membership settles only while its approval still awaits this exact
  -- amount from this payer. A withdrawn or already-paid approval keeps the
  -- money as account credit instead.
  if a.membership_application_id is not null then
    settled:=exists(select 1 from public.membership_applications m where m.id=a.membership_application_id
        and m.status='awaiting_payment')
      and (select coalesce(sum(public.payment_charge_outstanding(ch.id)),0) from public.charges ch
        where ch.membership_application_id=a.membership_application_id and ch.lifecycle_state='provisional')=a.amount_cents
      and not exists(select 1 from public.charges ch where ch.membership_application_id=a.membership_application_id
        and ch.lifecycle_state='provisional' and ch.payer_id<>a.payer_id);
    if settled then
      update public.charges set lifecycle_state='finalized',finalized_at=now(),updated_at=now()
        where membership_application_id=a.membership_application_id and lifecycle_state='provisional';
    end if;
  end if;
  remaining:=a.amount_cents;
  if settled then
    for c in select ch.* from public.charges ch where
      (a.booking_id is not null and ch.booking_id=a.booking_id and ch.lifecycle_state='finalized') or
      (a.invoice_id is not null and exists(select 1 from public.invoice_lines l where l.invoice_id=a.invoice_id and l.charge_id=ch.id)) or
      (a.order_id is not null and ch.order_id=a.order_id and ch.lifecycle_state='finalized') or
      (a.membership_application_id is not null and ch.membership_application_id=a.membership_application_id and ch.lifecycle_state='finalized')
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
    if a.membership_application_id is not null then
      perform public.activate_paid_membership_application(a.membership_application_id,a.payer_id);
    end if;
  end if;
  if remaining>0 then insert into public.ledger_credits(payer_id,booking_id,payment_attempt_id,amount_cents,reason)
    values(a.payer_id,a.booking_id,a.id,remaining,case when settled then 'Online payment excess'
      when a.order_id is not null then 'Payment received for a changed shop order'
      when a.membership_application_id is not null then 'Payment received for a withdrawn membership approval'
      else 'Payment received after lesson hold expiry' end); end if;
  update public.payment_attempts set status='succeeded',completed_at=now() where id=a.id;
  if a.invoice_id is not null and not exists(select 1 from public.invoice_lines l where l.invoice_id=a.invoice_id
    and public.payment_charge_outstanding(l.charge_id)>0) then update public.invoices set status='paid',paid_at=coalesce(paid_at,now()) where id=a.invoice_id; end if;
  insert into public.receipts(payer_id,invoice_id,payment_attempt_id,amount_cents) values(a.payer_id,a.invoice_id,a.id,a.amount_cents);
  insert into public.audit_events(event_type,entity_type,entity_id,metadata) values('payment.succeeded','payment_attempt',a.id,
    jsonb_build_object('provider',target_provider,'credited_cents',remaining::text,'order_id',a.order_id,
      'membership_application_id',a.membership_application_id));
  return true;
end $$;

create or replace function public.get_payment_status(target_attempt uuid)
returns table(attempt_id uuid,status text,kind text,credited boolean,amount_cents text)
language plpgsql stable security definer set search_path=public as $$
begin
  if not public.payment_actor_is_payer() then raise exception 'forbidden'; end if;
  return query select a.id,a.status,
    case when a.booking_id is not null then 'booking' when a.order_id is not null then 'order'
      when a.membership_application_id is not null then 'membership' else 'invoice' end,
    exists(select 1 from public.ledger_credits c where c.payment_attempt_id=a.id),a.amount_cents::text
    from public.payment_attempts a where a.id=target_attempt and a.payer_id=auth.uid();
end $$;

-- create or replace keeps earlier grants; restate the webhook restriction.
revoke all on function public.record_payment_event(text,text,text,text,text,bigint,text) from public,anon,authenticated;
grant execute on function public.record_payment_event(text,text,text,text,text,bigint,text) to service_role;

-- ============================================================
-- 7. Refund read models name membership payments (from 0031)
-- ============================================================
-- create or replace keeps the 0031 grants.
create or replace function public.list_refundable_payments()
returns table(attempt_id uuid, payer_id uuid, payer_name text, kind text, provider text,
  amount_cents text, refundable_cents text, completed_at timestamptz, receipt_number text,
  order_id uuid, invoice_number text)
language plpgsql stable security definer set search_path = public as $$
declare staff boolean := public.current_user_is_active_staff();
begin
  if not staff and not public.payment_actor_is_payer() then raise exception 'forbidden'; end if;
  return query select a.id, a.payer_id, coalesce(nullif(p.full_name, ''), p.email),
    case when a.booking_id is not null then 'booking' when a.order_id is not null then 'order'
      when a.membership_application_id is not null then 'membership' else 'invoice' end,
    a.provider, a.amount_cents::text, public.payment_refundable_cents(a.id)::text, a.completed_at,
    rc.receipt_number, a.order_id, i.invoice_number
    from public.payment_attempts a
    join public.profiles p on p.id = a.payer_id
    left join public.receipts rc on rc.payment_attempt_id = a.id
    left join public.invoices i on i.id = a.invoice_id
    where a.status = 'succeeded' and (staff or a.payer_id = auth.uid())
    order by a.completed_at desc nulls last;
end $$;

create or replace function public.list_refund_requests()
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
    case when a.booking_id is not null then 'booking' when a.order_id is not null then 'order'
      when a.membership_application_id is not null then 'membership' else 'invoice' end,
    a.amount_cents::text, public.payment_refundable_cents(a.id)::text, r.amount_cents::text, r.reason, r.status,
    r.method, r.decision_note, r.external_reference, r.failure_reason, a.provider,
    a.provider_payment_id is not null, r.created_at, r.decided_at, r.processed_at
    from public.refund_requests r
    join public.payment_attempts a on a.id = r.payment_attempt_id
    join public.profiles p on p.id = r.payer_id
    where staff or r.payer_id = auth.uid()
    order by r.created_at desc;
end $$;
