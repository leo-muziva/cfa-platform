-- Members-only lesson availability. The old lesson_slots table had an
-- access_rule, but the coach-availability booking model (0011+) dropped it,
-- so every time was open to guests. Coaches can now mark standing hours as
-- members-only. Extra one-off hours stay open to everyone.

alter table public.coach_availability_rules
  add column access_rule text not null default 'guest_allowed'
  check (access_rule in ('guest_allowed','active_members_only'));

-- A time is members-only when every standing rule covering it is
-- members-only and no extra hours open it to everyone.
create or replace function public.lesson_time_is_members_only(target_coach uuid, target_starts_at timestamptz)
returns boolean language sql stable security definer set search_path=public as $$
  with cfg as (select lesson_duration_minutes from public.lesson_booking_settings where singleton),
  l as (
    select target_starts_at at time zone 'Africa/Johannesburg' as local_start,
      (target_starts_at + make_interval(mins => cfg.lesson_duration_minutes)) at time zone 'Africa/Johannesburg' as local_end,
      cfg.lesson_duration_minutes from cfg
  ), covering as (
    select r.access_rule from l join public.coach_availability_rules r on r.coach_id=target_coach and r.is_active
      and r.iso_weekday=extract(isodow from l.local_start)::smallint
      and l.local_start::time>=r.starts_at_local and l.local_end::time<=r.ends_at_local
  )
  select exists(select 1 from covering where access_rule='active_members_only')
    and not exists(select 1 from covering where access_rule='guest_allowed')
    and not exists(select 1 from l join public.coach_availability_exceptions e on e.coach_id=target_coach
      and e.exception_type='extra' and e.starts_at<=target_starts_at
      and e.ends_at>=target_starts_at+make_interval(mins => l.lesson_duration_minutes));
$$;
revoke all on function public.lesson_time_is_members_only(uuid,timestamptz) from public;
grant execute on function public.lesson_time_is_members_only(uuid,timestamptz) to anon,authenticated;

-- Time options report the members-only flag and use the same calendar-month
-- horizon that lesson_time_is_available enforces (it previously listed only
-- booking_horizon_days, so later bookable times never appeared).
drop function public.list_lesson_time_options(uuid,text,date,date);
create function public.list_lesson_time_options(
  target_coach uuid,target_weapon text,range_start date default null,range_end date default null
) returns table(starts_at timestamptz,ends_at timestamptz,is_available boolean,members_only boolean)
language sql stable security definer set search_path=public as $$
  with cfg as (select * from public.lesson_booking_settings where singleton),
  bounds as (
    select greatest(coalesce(range_start,(now() at time zone 'Africa/Johannesburg')::date),
        (now() at time zone 'Africa/Johannesburg')::date) as first_day,
      least(coalesce(range_end,horizon.last_day),horizon.last_day) as last_day,
      cfg.lesson_duration_minutes
    from cfg cross join lateral (
      select (date_trunc('month', now() at time zone 'Africa/Johannesburg')::date
        + (cfg.booking_horizon_calendar_months || ' months')::interval)::date - 1 as last_day
    ) horizon
  ), standing as (
    select ((d.day::date+r.starts_at_local+g.slot_number*b.lesson_duration_minutes*interval '1 minute') at time zone 'Africa/Johannesburg') as slot_start,
      b.lesson_duration_minutes
    from bounds b cross join lateral generate_series(b.first_day,b.last_day,interval '1 day') d(day)
    join public.coach_availability_rules r on r.coach_id=target_coach and r.is_active
      and r.iso_weekday=extract(isodow from d.day)::smallint
    cross join lateral generate_series(0,
      floor(extract(epoch from (r.ends_at_local-r.starts_at_local))/60/b.lesson_duration_minutes)::integer-1) g(slot_number)
  ), extras as (
    select e.starts_at+g.slot_number*b.lesson_duration_minutes*interval '1 minute' as slot_start,b.lesson_duration_minutes
    from bounds b join public.coach_availability_exceptions e
      on e.coach_id=target_coach and e.exception_type='extra'
    cross join lateral generate_series(0,
      floor(extract(epoch from (e.ends_at-e.starts_at))/60/b.lesson_duration_minutes)::integer-1) g(slot_number)
    where (e.starts_at at time zone 'Africa/Johannesburg')::date between b.first_day and b.last_day
  ), candidates as (
    select distinct slot_start,lesson_duration_minutes from (select * from standing union all select * from extras) occurrences
  )
  select c.slot_start,c.slot_start+make_interval(mins => c.lesson_duration_minutes),
    public.lesson_time_is_available(target_coach,c.slot_start,target_weapon,null),
    public.lesson_time_is_members_only(target_coach,c.slot_start)
  from candidates c
  where target_weapon in ('foil','epee','sabre')
    and exists(select 1 from public.coach_lesson_profiles cp where cp.coach_id=target_coach and cp.is_active)
    and exists(select 1 from public.profiles p where p.id=target_coach and p.is_active and p.is_staff and p.staff_type='coach')
    and exists(select 1 from public.coach_lesson_weapons cw where cw.coach_id=target_coach and cw.weapon=target_weapon)
  order by c.slot_start;
$$;
revoke all on function public.list_lesson_time_options(uuid,text,date,date) from public;
grant execute on function public.list_lesson_time_options(uuid,text,date,date) to anon,authenticated;

-- Every booking path (create and reschedule) goes through v2, so enforce
-- the rule there, after the coach lock. The rule is about the participants,
-- not the actor, so admins booking for a guest are refused too.
create or replace function public.create_lesson_booking_v2(
  target_coach uuid,target_starts_at timestamptz,target_participant_ids uuid[],target_weapon text
) returns uuid language plpgsql security definer set search_path=public as $$
declare v_actor public.profiles; v_count integer; v_payer uuid; v_booking uuid; v_slot uuid;
declare v_duration integer; v_price numeric(10,2); v_participant uuid; v_first uuid; v_ordinal integer:=0;
declare v_members_only boolean;
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
  v_members_only:=public.lesson_time_is_members_only(target_coach,target_starts_at);
  if v_members_only and exists(select 1 from unnest(target_participant_ids) participant
    join public.profiles p on p.id=participant where p.membership_status<>'member')
  then raise exception using message='members_only',errcode='P0001'; end if;
  insert into public.lesson_slots(starts_at,ends_at,coach_id,capacity,price,is_open,access_rule,created_by)
  values(target_starts_at,target_starts_at+make_interval(mins => v_duration),target_coach,1,v_price,true,
    case when v_members_only then 'active_members_only' else 'guest_allowed' end,auth.uid())
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
