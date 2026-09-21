-- Preserve contractual lesson terms and keep holds inside the existing slot lock.
-- These ledger primitives are defined here because the lifecycle functions
-- below depend on them during a clean, forward-only migration run.
alter table public.charges add column if not exists amount_cents bigint;
update public.charges set amount_cents=round(amount * 100)::bigint where amount_cents is null;
alter table public.ledger_credits add column if not exists amount_cents bigint;
update public.ledger_credits set amount_cents=round(amount * 100)::bigint where amount_cents is null;
create table if not exists public.payment_allocations (
  id uuid primary key default gen_random_uuid(),
  payment_attempt_id uuid not null references public.payment_attempts(id) on delete restrict,
  charge_id uuid not null references public.charges(id) on delete restrict,
  amount_cents bigint not null check (amount_cents > 0),
  created_at timestamptz not null default now(),
  unique(payment_attempt_id, charge_id)
);
create table if not exists public.credit_consumptions (
  id uuid primary key default gen_random_uuid(),
  ledger_credit_id uuid not null references public.ledger_credits(id) on delete restrict,
  charge_id uuid not null references public.charges(id) on delete restrict,
  amount_cents bigint not null check (amount_cents > 0),
  created_at timestamptz not null default now(),
  unique(ledger_credit_id, charge_id)
);
create table if not exists public.invoice_adjustments (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid references public.invoices(id) on delete restrict,
  charge_id uuid not null unique references public.charges(id) on delete restrict,
  amount_cents bigint not null check (amount_cents > 0),
  reason text not null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.lesson_booking_settings add column hold_expiry_minutes integer not null default 30 check (hold_expiry_minutes between 1 and 1440);
alter table public.bookings
  add column booked_unit_price_cents bigint,
  add column booked_cancellation_window_hours integer,
  add column booked_late_fee_multiplier numeric(6,2),
  add column booked_no_show_multiplier numeric(6,2),
  add column payment_state text not null default 'unpaid' check (payment_state in ('unpaid','held','paid','expired')),
  add column hold_expires_at timestamptz;
alter table public.booking_participants
  add column attendance_outcome text check (attendance_outcome in ('attended','no_show')),
  add column outcome_recorded_at timestamptz,
  add column outcome_recorded_by uuid references public.profiles(id);

-- Historical policy was not stored. Backfill the current provisional policy, but retain actual booked prices.
update public.bookings b set booked_unit_price_cents=round(s.price*100)::bigint,
  booked_cancellation_window_hours=settings.cancellation_window_hours,
  booked_late_fee_multiplier=settings.late_cancellation_fee_multiplier,
  booked_no_show_multiplier=settings.no_show_fee_multiplier
from public.lesson_slots s cross join public.lesson_booking_settings settings
where b.lesson_slot_id=s.id and b.booking_model='lesson_v2';
update public.booking_participants p set attendance_outcome=b.status,
  outcome_recorded_at=b.outcome_recorded_at,outcome_recorded_by=b.outcome_recorded_by
from public.bookings b where p.booking_id=b.id and b.status in ('attended','no_show');

create function public.snapshot_lesson_terms() returns trigger language plpgsql security definer set search_path=public as $$
begin
  if new.booking_model='lesson_v2' then
    select single_lesson_price_cents,cancellation_window_hours,late_cancellation_fee_multiplier,no_show_fee_multiplier
      into new.booked_unit_price_cents,new.booked_cancellation_window_hours,new.booked_late_fee_multiplier,new.booked_no_show_multiplier
      from public.lesson_booking_settings where singleton;
  end if;
  return new;
end $$;
create trigger snapshot_lesson_terms before insert on public.bookings for each row execute function public.snapshot_lesson_terms();

create function public.expire_lesson_holds() returns integer language plpgsql security definer set search_path=public as $$
declare b record; expired_count integer:=0;
begin
  for b in select id from public.bookings where payment_state='held' and hold_expires_at<=now() order by id for update skip locked loop
    update public.bookings set payment_state='expired',status='cancelled',cancelled_at=now(),
      cancellation_actor_type='system',cancellation_reason='Payment hold expired',updated_at=now() where id=b.id;
    update public.charges set lifecycle_state='voided',voided_at=now(),updated_at=now()
      where booking_id=b.id and lifecycle_state='provisional';
    insert into public.audit_events(event_type,entity_type,entity_id,metadata)
      values('lesson.hold_expired','booking',b.id,'{}');
    expired_count:=expired_count+1;
  end loop;
  return expired_count;
end $$;
revoke all on function public.expire_lesson_holds() from public,anon,authenticated;
grant execute on function public.expire_lesson_holds() to service_role;

create or replace function public.create_lesson_booking_v2(
  target_coach uuid,target_starts_at timestamptz,target_participant_ids uuid[],target_weapon text
) returns uuid language plpgsql security definer set search_path=public as $$
declare v_actor public.profiles; v_count integer; v_payer uuid; v_booking uuid; v_slot uuid;
declare v_duration integer; v_price numeric(10,2); v_participant uuid; v_first uuid; v_ordinal integer:=0;
begin
  select * into v_actor from public.profiles where id=auth.uid() and is_active;
  if v_actor.id is null then raise exception using message='not_authenticated',errcode='P0001'; end if;
  if not public.current_user_is_admin() and v_actor.profile_completed_at is null
  then raise exception using message='account_incomplete',errcode='P0001'; end if;
  v_count:=coalesce(array_length(target_participant_ids,1),0);
  if v_count not in (1,2) or (select count(distinct x) from unnest(target_participant_ids) x)<>v_count
  then raise exception using message='invalid_participants',errcode='P0001'; end if;
  foreach v_participant in array target_participant_ids loop
    if not exists(select 1 from public.profiles where id=v_participant and is_active and profile_completed_at is not null)
      or not public.lesson_actor_can_manage_participant(v_participant)
    then raise exception using message='participant_unauthorized',errcode='P0001'; end if;
    if v_payer is null then v_payer:=public.active_billing_payer(v_participant);
    elsif v_payer<>public.active_billing_payer(v_participant) then
      raise exception using message='mixed_payers',errcode='P0001';
    end if;
  end loop;
  if not public.current_user_is_admin() and public.active_billing_payer(auth.uid())<>auth.uid()
    and (v_count<>1 or target_participant_ids[1]<>auth.uid())
  then raise exception using message='participant_unauthorized',errcode='P0001'; end if;
  select lesson_duration_minutes,single_lesson_price_cents/100.0 into v_duration,v_price
    from public.lesson_booking_settings where singleton;
  -- Serialize all candidate intervals for a coach, then revalidate overlap in-database.
  perform pg_advisory_xact_lock(hashtextextended('lesson-coach/'||target_coach::text,0));
  perform public.expire_lesson_holds();
  if not public.lesson_time_is_available(target_coach,target_starts_at,target_weapon,null)
  then raise exception using message='slot_taken',errcode='P0001'; end if;
  insert into public.lesson_slots(starts_at,ends_at,coach_id,capacity,price,is_open,access_rule,created_by)
  values(target_starts_at,target_starts_at+make_interval(mins => v_duration),target_coach,1,v_price,true,'guest_allowed',auth.uid())
  returning id into v_slot;
  v_first:=target_participant_ids[1];
  insert into public.bookings(lesson_slot_id,booked_by_id,fencer_id,payment_option,status,booking_model,
    coach_id,starts_at,ends_at,weapon)
  values(v_slot,auth.uid(),v_first,'pay_later','scheduled','lesson_v2',target_coach,target_starts_at,
    target_starts_at+make_interval(mins => v_duration),target_weapon) returning id into v_booking;
  foreach v_participant in array target_participant_ids loop
    v_ordinal:=v_ordinal+1;
    insert into public.booking_participants(booking_id,participant_id,ordinal) values(v_booking,v_participant,v_ordinal);
    insert into public.charges(fencer_id,payer_id,booking_id,type,amount,status,period,description,lifecycle_state)
    values(v_participant,v_payer,v_booking,'lesson',v_price,'unpaid',
      date_trunc('month',target_starts_at at time zone 'Africa/Johannesburg')::date,'Individual lesson','provisional');
  end loop;
  if auth.uid()=v_first and v_payer<>auth.uid() then
    insert into public.lesson_notifications(recipient_id,booking_id,notification_type,message)
    values(v_payer,v_booking,'dependent_self_booked','A dependent booked a CFA lesson.');
  end if;
  insert into public.audit_events(event_type,actor_id,subject_profile_id,entity_type,entity_id,metadata)
  values('lesson.booking_created',auth.uid(),v_first,'booking',v_booking,
    jsonb_build_object('coach_id',target_coach,'starts_at',target_starts_at,'participant_count',v_count));
  return v_booking;
exception when unique_violation then
  raise exception using message='slot_taken',errcode='P0001';
end $$;

-- A policy event is applied once under the booking lock. Issued amounts remain
-- unchanged; reductions use adjustment documents and settled excess becomes credit.
alter table public.invoice_adjustments alter column invoice_id drop not null;
alter table public.charges drop constraint charges_type_check;
alter table public.charges add constraint charges_type_check check(type in ('lesson','rental','membership','joining_fee','lesson_adjustment'));
create function public.apply_lesson_charge_policy(target_charge uuid,target_due bigint,target_reason text)
returns void language plpgsql security definer set search_path=public as $$
declare c public.charges; paid bigint; adjustment bigint; credit bigint; inv uuid;
begin
  select * into c from public.charges where id=target_charge for update;
  if not found or target_due<0 then raise exception 'invalid_input'; end if;
  select coalesce(sum(amount_cents),0) into paid from (
    select amount_cents from public.payment_allocations where charge_id=c.id
    union all select amount_cents from public.credit_consumptions where charge_id=c.id
  ) payments;
  if c.lifecycle_state='provisional' then
    update public.charges set amount_cents=case when target_due=0 then c.amount_cents else target_due end,lifecycle_state=case when target_due=0 then 'voided' else 'finalized' end,
      voided_at=case when target_due=0 then now() end,finalized_at=case when target_due>0 then now() end,updated_at=now() where id=c.id;
    return;
  end if;
  adjustment:=greatest(0,c.amount_cents-target_due);
  credit:=greatest(0,paid-target_due);
  if adjustment>0 then
    select invoice_id into inv from public.invoice_lines where charge_id=c.id;
    insert into public.invoice_adjustments(invoice_id,charge_id,amount_cents,reason,created_by)
      values(inv,c.id,adjustment,target_reason,auth.uid()) on conflict(charge_id) do nothing;
  elsif target_due>c.amount_cents then
    insert into public.charges(fencer_id,payer_id,booking_id,type,amount_cents,period,description,lifecycle_state,finalized_at)
      values(c.fencer_id,c.payer_id,c.booking_id,'lesson_adjustment',target_due-c.amount_cents,c.period,target_reason,'finalized',now());
  end if;
  if credit>0 then
    insert into public.ledger_credits(payer_id,participant_id,booking_id,charge_id,amount_cents,reason,created_by)
      values(c.payer_id,c.fencer_id,c.booking_id,c.id,credit,target_reason,auth.uid()) on conflict(charge_id) do nothing;
  end if;
end $$;
revoke all on function public.apply_lesson_charge_policy(uuid,bigint,text) from public,anon,authenticated;

create or replace function public.cancel_lesson_booking_v2(
  target_booking uuid,target_reason text default null,target_actor_type text default 'member'
) returns void language plpgsql security definer set search_path=public as $$
declare b public.bookings; cutoff integer; late_fee numeric; no_charge boolean; c public.charges;
begin
  select * into b from public.bookings where id=target_booking and booking_model='lesson_v2' for update;
  if not found or b.status<>'scheduled' then raise exception using message='booking_not_scheduled',errcode='P0001'; end if;
  if b.starts_at<=now() then raise exception using message='booking_already_started',errcode='P0001'; end if;
  if target_actor_type not in ('member','payer','coach','admin','closure','system')
  then raise exception using message='invalid_actor_type',errcode='P0001'; end if;
  if target_actor_type='coach' then
    if not (b.coach_id=auth.uid() or public.current_user_is_admin()) then raise exception using message='forbidden',errcode='P0001'; end if;
  elsif target_actor_type in ('admin','closure','system') then
    if not public.current_user_is_admin() then raise exception using message='forbidden',errcode='P0001'; end if;
  elsif not public.lesson_actor_can_manage_booking(target_booking) then
    raise exception using message='forbidden',errcode='P0001';
  end if;
  cutoff:=b.booked_cancellation_window_hours; late_fee:=b.booked_late_fee_multiplier;
  no_charge:=target_actor_type in ('coach','admin','closure','system') or b.payment_state='held' or b.starts_at>=now()+make_interval(hours => cutoff);
  update public.bookings set status='cancelled',cancellation_actor_id=auth.uid(),
    cancellation_actor_type=target_actor_type,cancellation_reason=nullif(trim(target_reason),''),cancelled_at=now(),updated_at=now()
    where id=b.id;
  for c in select * from public.charges where booking_id=b.id and type='lesson' and lifecycle_state not in ('voided','waived') loop
    perform public.apply_lesson_charge_policy(c.id,case when no_charge then 0 else round(b.booked_unit_price_cents*late_fee)::bigint end,'Lesson cancellation');
  end loop;
  insert into public.audit_events(event_type,actor_id,subject_profile_id,entity_type,entity_id,metadata)
  values('lesson.booking_cancelled',auth.uid(),b.fencer_id,'booking',b.id,
    jsonb_build_object('actor_type',target_actor_type,'charged',not no_charge));
end $$;

create or replace function public.reschedule_lesson_booking_v2(
  target_booking uuid,target_starts_at timestamptz
) returns uuid language plpgsql security definer set search_path=public as $$
declare old_b public.bookings; new_booking uuid; participant_ids uuid[]; cutoff integer; late boolean; c public.charges;
begin
  select * into old_b from public.bookings where id=target_booking and booking_model='lesson_v2' for update;
  if not found or old_b.status<>'scheduled' then raise exception using message='booking_not_scheduled',errcode='P0001'; end if;
  if old_b.starts_at<=now() then raise exception using message='booking_already_started',errcode='P0001'; end if;
  if not public.lesson_actor_can_manage_booking(target_booking) then raise exception using message='forbidden',errcode='P0001'; end if;
  select array_agg(participant_id order by ordinal) into participant_ids from public.booking_participants where booking_id=old_b.id;
  cutoff:=old_b.booked_cancellation_window_hours;
  if old_b.payment_state='held' then raise exception using message='booking_not_scheduled',errcode='P0001'; end if;
  late:=old_b.starts_at<now()+make_interval(hours => cutoff);
  new_booking:=public.create_lesson_booking_v2(old_b.coach_id,target_starts_at,participant_ids,old_b.weapon);
  update public.bookings set status='rescheduled',rescheduled_to_booking_id=new_booking,updated_at=now() where id=old_b.id;
  update public.bookings set rescheduled_from_booking_id=old_b.id,booked_unit_price_cents=old_b.booked_unit_price_cents,
    booked_cancellation_window_hours=old_b.booked_cancellation_window_hours,
    booked_late_fee_multiplier=old_b.booked_late_fee_multiplier,booked_no_show_multiplier=old_b.booked_no_show_multiplier,updated_at=now() where id=new_booking;
  update public.charges new_charge set replaced_charge_id=old_charge.id,payer_id=old_charge.payer_id,amount_cents=old_b.booked_unit_price_cents,updated_at=now()
    from public.charges old_charge where new_charge.booking_id=new_booking
      and old_charge.booking_id=old_b.id and old_charge.fencer_id=new_charge.fencer_id;
  for c in select * from public.charges where booking_id=old_b.id and type='lesson' and lifecycle_state not in ('voided','waived') loop
    perform public.apply_lesson_charge_policy(c.id,case when late then round(old_b.booked_unit_price_cents*old_b.booked_late_fee_multiplier)::bigint else 0 end,'Lesson reschedule');
  end loop;
  insert into public.audit_events(event_type,actor_id,subject_profile_id,entity_type,entity_id,metadata)
  values('lesson.booking_rescheduled',auth.uid(),old_b.fencer_id,'booking',new_booking,
    jsonb_build_object('from_booking_id',old_b.id,'late',late));
  return new_booking;
end $$;

create or replace function public.list_my_lesson_bookings()
returns table(
  booking_id uuid,coach_id uuid,coach_name text,starts_at timestamptz,ends_at timestamptz,
  weapon text,status text,participant_names text[],cancelled_at timestamptz,cancellation_reason text,cancellation_deadline timestamptz,
  rescheduled_from_booking_id uuid,rescheduled_to_booking_id uuid
) language plpgsql stable security definer set search_path=public as $$
declare cancellation_hours integer;
begin
  if auth.uid() is null
  then raise exception using message='forbidden',errcode='P0001'; end if;
  select cancellation_window_hours into cancellation_hours
    from public.lesson_booking_settings where singleton;
  return query
  select b.id,b.coach_id,coach.full_name,b.starts_at,b.ends_at,b.weapon,b.status,
    array_agg(participant.full_name order by bp.ordinal),
    b.cancelled_at,b.cancellation_reason,
    b.starts_at-make_interval(hours => b.booked_cancellation_window_hours),
    b.rescheduled_from_booking_id,b.rescheduled_to_booking_id
  from public.bookings b join public.booking_participants bp on bp.booking_id=b.id
  join public.profiles participant on participant.id=bp.participant_id
  join public.profiles coach on coach.id=b.coach_id
  where b.booking_model='lesson_v2' and public.lesson_actor_can_manage_booking(b.id)
  group by b.id,coach.full_name order by b.starts_at;
end $$;

-- Explicit payment choice is authorized independently from staff duties.
create function public.create_lesson_booking_v3(
  target_coach uuid,target_starts_at timestamptz,target_participant_ids uuid[],target_weapon text,target_payment_option text default 'pay_later'
) returns uuid language plpgsql security definer set search_path=public as $$
declare booking uuid; expiry integer;
begin
  if target_payment_option not in ('pay_now','pay_later') then raise exception 'invalid_input'; end if;
  if target_payment_option='pay_now' and public.active_billing_payer(auth.uid())<>auth.uid() then raise exception 'forbidden'; end if;
  booking:=public.create_lesson_booking_v2(target_coach,target_starts_at,target_participant_ids,target_weapon);
  if target_payment_option='pay_now' then
    select hold_expiry_minutes into expiry from public.lesson_booking_settings where singleton;
    update public.bookings set payment_option='pay_now',payment_state='held',hold_expires_at=now()+make_interval(mins=>expiry) where id=booking;
    insert into public.audit_events(event_type,actor_id,entity_type,entity_id,metadata)
      values('lesson.hold_created',auth.uid(),'booking',booking,jsonb_build_object('expiry_minutes',expiry));
  end if;
  return booking;
end $$;
revoke all on function public.create_lesson_booking_v3(uuid,timestamptz,uuid[],text,text) from public,anon;
grant execute on function public.create_lesson_booking_v3(uuid,timestamptz,uuid[],text,text) to authenticated;

-- Called inside the payment transaction while the attempt is locked. Never resurrect an expired slot.
create function public.settle_booking_hold(target_attempt uuid) returns boolean language plpgsql security definer set search_path=public as $$
declare booking uuid; b public.bookings;
begin
  select booking_id into booking from public.payment_attempts where id=target_attempt;
  if not found then raise exception 'not_found'; end if;
  if booking is null then return true; end if;
  select * into b from public.bookings where id=booking for update;
  if b.payment_state='expired' or b.status in ('cancelled','rescheduled') then return false; end if;
  if b.payment_state='held' and b.hold_expires_at<=now() then
    update public.bookings set payment_state='expired',status='cancelled',cancelled_at=now(),
      cancellation_actor_type='system',cancellation_reason='Payment received after hold expiry',updated_at=now() where id=b.id;
    update public.charges set lifecycle_state='voided',voided_at=now(),updated_at=now()
      where booking_id=b.id and lifecycle_state='provisional';
    insert into public.audit_events(event_type,entity_type,entity_id,metadata)
      values('lesson.late_payment','booking',b.id,jsonb_build_object('attempt_id',target_attempt));
    return false;
  end if;
  update public.bookings set payment_state='paid',updated_at=now() where id=b.id;
  update public.charges set lifecycle_state='finalized',finalized_at=now(),updated_at=now()
    where booking_id=b.id and lifecycle_state='provisional';
  return true;
end $$;
revoke all on function public.settle_booking_hold(uuid) from public,anon,authenticated;
grant execute on function public.settle_booking_hold(uuid) to service_role;

create function public.record_lesson_participant_outcome(target_booking uuid,target_participant uuid,target_outcome text)
returns void language plpgsql security definer set search_path=public as $$
declare b public.bookings; previous text; c public.charges;
begin
  if target_outcome not in ('attended','no_show') then raise exception 'invalid_outcome'; end if;
  select * into b from public.bookings where id=target_booking and booking_model='lesson_v2' for update;
  if not found or b.status not in ('scheduled','attended','no_show') or b.ends_at>now() or b.payment_state in ('held','expired')
    then raise exception 'outcome_not_allowed'; end if;
  if not (public.current_user_is_admin() or b.coach_id=auth.uid()) then raise exception 'forbidden'; end if;
  select attendance_outcome into previous from public.booking_participants where booking_id=b.id and participant_id=target_participant;
  if not found then raise exception 'invalid_participants'; end if;
  if previous=target_outcome then return; end if;
  if previous is not null then raise exception 'outcome_not_allowed'; end if;
  update public.booking_participants set attendance_outcome=target_outcome,outcome_recorded_at=now(),outcome_recorded_by=auth.uid()
    where booking_id=b.id and participant_id=target_participant;
  for c in select * from public.charges where booking_id=b.id and fencer_id=target_participant and type='lesson' and lifecycle_state not in ('voided','waived') loop
    perform public.apply_lesson_charge_policy(c.id,round(b.booked_unit_price_cents*case when target_outcome='no_show' then b.booked_no_show_multiplier else 1 end)::bigint,'Lesson attendance outcome');
  end loop;
  if not exists(select 1 from public.booking_participants where booking_id=b.id and attendance_outcome is null) then
    update public.bookings set status=case when exists(select 1 from public.booking_participants where booking_id=b.id and attendance_outcome='attended')
      then 'attended' else 'no_show' end,outcome_recorded_at=now(),outcome_recorded_by=auth.uid(),updated_at=now() where id=b.id;
  end if;
  insert into public.audit_events(event_type,actor_id,subject_profile_id,entity_type,entity_id,metadata)
    values('lesson.participant_'||target_outcome,auth.uid(),target_participant,'booking',b.id,'{}');
end $$;
revoke all on function public.record_lesson_participant_outcome(uuid,uuid,text) from public,anon;
grant execute on function public.record_lesson_participant_outcome(uuid,uuid,text) to authenticated;

-- Compatibility for old callers is intentionally limited to a single participant.
create or replace function public.record_lesson_outcome(target_booking uuid,target_outcome text)
returns void language plpgsql security definer set search_path=public as $$
declare participant uuid;
begin
  if (select count(*) from public.booking_participants where booking_id=target_booking)<>1 then raise exception 'invalid_participants'; end if;
  select participant_id into participant from public.booking_participants where booking_id=target_booking;
  perform public.record_lesson_participant_outcome(target_booking,participant,target_outcome);
end $$;

create function public.list_lesson_participant_outcomes(target_booking_ids uuid[])
returns table(booking_id uuid,participant_id uuid,attendance_outcome text) language sql stable security definer set search_path=public as $$
  select bp.booking_id,bp.participant_id,bp.attendance_outcome from public.booking_participants bp join public.bookings b on b.id=bp.booking_id
  where b.id=any(target_booking_ids) and (public.lesson_actor_can_manage_booking(b.id) or b.coach_id=auth.uid());
$$;
revoke all on function public.list_lesson_participant_outcomes(uuid[]) from public,anon;
grant execute on function public.list_lesson_participant_outcomes(uuid[]) to authenticated;

-- Safe operations DTO includes identities/outcomes, but no financial state or amounts.
create function public.list_coach_lesson_agenda_v3(target_coach uuid default null)
returns table(booking_id uuid,coach_id uuid,starts_at timestamptz,ends_at timestamptz,weapon text,status text,
  participant_names text[],participant_ids uuid[],participant_outcomes text[])
language plpgsql stable security definer set search_path=public as $$
declare requested_coach uuid:=coalesce(target_coach,auth.uid());
begin
  if not public.current_user_is_admin() and (requested_coach is distinct from auth.uid() or not exists(
    select 1 from public.profiles where id=auth.uid() and is_active and is_staff and staff_type='coach'
  )) then raise exception 'forbidden'; end if;
  return query select b.id,b.coach_id,b.starts_at,b.ends_at,b.weapon,b.status,array_agg(p.full_name order by bp.ordinal),
    array_agg(bp.participant_id order by bp.ordinal),array_agg(bp.attendance_outcome order by bp.ordinal)
  from public.bookings b join public.booking_participants bp on bp.booking_id=b.id join public.profiles p on p.id=bp.participant_id
  where b.booking_model='lesson_v2' and b.coach_id=requested_coach and b.payment_state not in ('held','expired')
  group by b.id order by b.starts_at;
end $$;
revoke all on function public.list_coach_lesson_agenda_v3(uuid) from public,anon;
grant execute on function public.list_coach_lesson_agenda_v3(uuid) to authenticated;

create or replace function public.get_lesson_quote_v3(target_participant_ids uuid[])
returns table(participant_count integer,total_cents text,currency text) language plpgsql stable security definer set search_path=public as $$
declare v_count integer; v_payer uuid;
begin
  if coalesce(array_length(target_participant_ids,1),0) not in (1,2)
    or (select count(distinct x) from unnest(target_participant_ids) x)<>array_length(target_participant_ids,1)
  then raise exception using message='invalid_participants',errcode='P0001'; end if;
  if exists(select 1 from unnest(target_participant_ids) p where not public.lesson_actor_can_manage_participant(p))
  then raise exception using message='participant_unauthorized',errcode='P0001'; end if;
  v_count:=array_length(target_participant_ids,1);
  v_payer:=public.active_billing_payer(target_participant_ids[1]);
  if exists(select 1 from unnest(target_participant_ids) p where public.active_billing_payer(p)<>v_payer)
  then raise exception using message='mixed_payers',errcode='P0001'; end if;
  if not public.current_user_is_admin() and (
    v_payer<>auth.uid()
  ) then raise exception using message='forbidden',errcode='P0001'; end if;
  return query select v_count,(s.single_lesson_price_cents*v_count)::text,'ZAR'::text
    from public.lesson_booking_settings s where s.singleton;
end $$;

revoke all on function public.get_lesson_quote_v3(uuid[]) from public,anon;
grant execute on function public.get_lesson_quote_v3(uuid[]) to authenticated;
