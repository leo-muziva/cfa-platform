-- CFA lesson booking demo. Legacy capacity slots and their ledger rows remain intact.
-- New lesson_v2 bookings are 30-minute, invoice-only coach occurrences.

create table public.lesson_booking_settings (
  singleton boolean primary key default true check (singleton),
  cancellation_window_hours integer not null default 24 check (cancellation_window_hours >= 0),
  late_cancellation_action text not null default 'allow' check (late_cancellation_action in ('allow')),
  late_cancellation_fee_multiplier numeric(6,2) not null default 1 check (late_cancellation_fee_multiplier >= 0),
  no_show_fee_multiplier numeric(6,2) not null default 1 check (no_show_fee_multiplier >= 0),
  booking_horizon_days integer not null default 28 check (booking_horizon_days between 1 and 365),
  booking_cutoff_minutes integer not null default 120 check (booking_cutoff_minutes >= 0),
  payment_mode text not null default 'invoice_only' check (payment_mode = 'invoice_only'),
  arrears_blocking_enabled boolean not null default false,
  future_booking_cap_per_fencer integer check (future_booking_cap_per_fencer is null or future_booking_cap_per_fencer > 0),
  coach_assignment_mode text not null default 'any_matching_weapon' check (coach_assignment_mode = 'any_matching_weapon'),
  coach_weapons_mode text not null default 'per_coach' check (coach_weapons_mode = 'per_coach'),
  single_lesson_price_cents integer not null default 30000 check (single_lesson_price_cents >= 0),
  external_reminders_enabled boolean not null default false,
  double_lesson_multiplier integer not null default 2 check (double_lesson_multiplier = 2),
  double_lesson_atomic boolean not null default true check (double_lesson_atomic),
  closure_mode text not null default 'club_wide_date_ranges' check (closure_mode = 'club_wide_date_ranges'),
  lesson_duration_minutes integer not null default 30 check (lesson_duration_minutes = 30),
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);

insert into public.lesson_booking_settings(singleton) values(true);

create table public.coach_lesson_profiles (
  coach_id uuid primary key references public.profiles(id) on delete restrict,
  is_active boolean not null default true,
  deactivated_at timestamptz,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.coach_lesson_weapons (
  coach_id uuid not null references public.coach_lesson_profiles(coach_id) on delete cascade,
  weapon text not null check (weapon in ('foil','epee','sabre')),
  created_at timestamptz not null default now(),
  primary key(coach_id,weapon)
);

create table public.coach_availability_rules (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.coach_lesson_profiles(coach_id) on delete cascade,
  iso_weekday smallint not null check (iso_weekday between 1 and 7),
  starts_at_local time not null,
  ends_at_local time not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at_local > starts_at_local),
  unique(coach_id,iso_weekday,starts_at_local,ends_at_local)
);

create table public.coach_availability_exceptions (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.coach_lesson_profiles(coach_id) on delete cascade,
  exception_type text not null check (exception_type in ('block','extra')),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  reason text,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);
create index coach_availability_exceptions_range_idx
  on public.coach_availability_exceptions(coach_id,starts_at,ends_at);

create table public.club_closures (
  id uuid primary key default gen_random_uuid(),
  starts_on date not null,
  ends_on date not null,
  reason text not null check (length(trim(reason)) > 0),
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  cancelled_at timestamptz,
  check (ends_on >= starts_on)
);

alter table public.bookings drop constraint if exists bookings_status_check;
update public.bookings set status='scheduled' where status='upcoming';
alter table public.bookings add constraint bookings_status_check
  check (status in ('scheduled','attended','no_show','cancelled','rescheduled'));
alter table public.bookings alter column status set default 'scheduled';
alter table public.bookings
  add column booking_model text not null default 'legacy' check (booking_model in ('legacy','lesson_v2')),
  add column coach_id uuid references public.profiles(id) on delete restrict,
  add column starts_at timestamptz,
  add column ends_at timestamptz,
  add column weapon text check (weapon in ('foil','epee','sabre')),
  add column cancellation_actor_id uuid references public.profiles(id) on delete set null,
  add column cancellation_actor_type text check (cancellation_actor_type in ('member','payer','coach','admin','closure','system')),
  add column cancellation_reason text,
  add column cancelled_at timestamptz,
  add column rescheduled_from_booking_id uuid references public.bookings(id) on delete set null,
  add column rescheduled_to_booking_id uuid references public.bookings(id) on delete set null,
  add column outcome_recorded_at timestamptz,
  add column outcome_recorded_by uuid references public.profiles(id) on delete set null,
  add column updated_at timestamptz not null default now();

update public.bookings b set
  coach_id=s.coach_id, starts_at=s.starts_at, ends_at=s.ends_at
from public.lesson_slots s where s.id=b.lesson_slot_id;

create unique index one_active_v2_booking_per_coach_time
  on public.bookings(coach_id,starts_at)
  where booking_model='lesson_v2' and status in ('scheduled','attended','no_show');

create table public.booking_participants (
  booking_id uuid not null references public.bookings(id) on delete cascade,
  participant_id uuid not null references public.profiles(id) on delete restrict,
  ordinal smallint not null check (ordinal in (1,2)),
  created_at timestamptz not null default now(),
  primary key(booking_id,participant_id),
  unique(booking_id,ordinal)
);

insert into public.booking_participants(booking_id,participant_id,ordinal)
select id,fencer_id,1 from public.bookings on conflict do nothing;

create table public.closure_affected_bookings (
  closure_id uuid not null references public.club_closures(id) on delete cascade,
  booking_id uuid not null references public.bookings(id) on delete restrict,
  action text not null default 'previewed' check (action in ('previewed','cancelled')),
  recorded_at timestamptz not null default now(),
  primary key(closure_id,booking_id)
);

create table public.lesson_notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  booking_id uuid references public.bookings(id) on delete cascade,
  notification_type text not null check (notification_type in ('dependent_self_booked','booking_changed','booking_cancelled')),
  message text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.charges drop constraint if exists charges_booking_id_key;
alter table public.charges
  add column lifecycle_state text not null default 'finalized'
    check (lifecycle_state in ('provisional','finalized','voided','waived')),
  add column finalized_at timestamptz,
  add column voided_at timestamptz,
  add column waived_at timestamptz,
  add column waived_by uuid references public.profiles(id) on delete set null,
  add column waiver_reason text,
  add column replaced_charge_id uuid references public.charges(id) on delete set null,
  add column updated_at timestamptz not null default now();
update public.charges set finalized_at=coalesce(paid_at,created_at) where lifecycle_state='finalized';
create unique index one_lesson_charge_per_booking_participant
  on public.charges(booking_id,fencer_id) where type='lesson' and booking_id is not null;

create table public.ledger_credits (
  id uuid primary key default gen_random_uuid(),
  payer_id uuid not null references public.profiles(id) on delete restrict,
  participant_id uuid not null references public.profiles(id) on delete restrict,
  booking_id uuid references public.bookings(id) on delete restrict,
  charge_id uuid not null unique references public.charges(id) on delete restrict,
  amount numeric(10,2) not null check (amount > 0),
  reason text not null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

-- Internal authorization helpers intentionally expose no financial data.
create or replace function public.lesson_actor_can_manage_participant(target_participant uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select auth.uid() is not null and (
    public.current_user_is_admin() or target_participant=auth.uid() or exists(
      select 1 from public.family_links fl
      where fl.guardian_id=auth.uid() and fl.dependent_id=target_participant and fl.status='active'
        and public.active_billing_payer(target_participant)=auth.uid()
    )
  );
$$;

create or replace function public.lesson_time_is_available(
  target_coach uuid, target_starts_at timestamptz, target_weapon text,
  ignored_booking uuid default null
) returns boolean language sql stable security definer set search_path=public as $$
  with cfg as (select * from public.lesson_booking_settings where singleton),
  local_time as (
    select target_starts_at at time zone 'Africa/Johannesburg' as local_start,
      (target_starts_at + make_interval(mins => cfg.lesson_duration_minutes)) at time zone 'Africa/Johannesburg' as local_end,
      (((now() at time zone 'Africa/Johannesburg')::date+cfg.booking_horizon_days)::timestamp
        at time zone 'Africa/Johannesburg') as horizon_end,
      cfg.* from cfg
  )
  select exists(
    select 1 from local_time l
    where target_weapon in ('foil','epee','sabre')
      and target_starts_at >= now()+make_interval(mins => l.booking_cutoff_minutes)
      and target_starts_at < l.horizon_end
      and exists(select 1 from public.coach_lesson_profiles cp
        where cp.coach_id=target_coach and cp.is_active)
      and exists(select 1 from public.profiles p where p.id=target_coach and p.is_active
        and p.is_staff and p.staff_type='coach')
      and exists(select 1 from public.coach_lesson_weapons cw
        where cw.coach_id=target_coach and cw.weapon=target_weapon)
      and (
        exists(select 1 from public.coach_availability_rules r
          where r.coach_id=target_coach and r.is_active
            and r.iso_weekday=extract(isodow from l.local_start)::smallint
            and l.local_start::time>=r.starts_at_local and l.local_end::time<=r.ends_at_local
            and mod(extract(epoch from (l.local_start::time-r.starts_at_local)),l.lesson_duration_minutes*60)=0)
        or exists(select 1 from public.coach_availability_exceptions e
          where e.coach_id=target_coach and e.exception_type='extra'
            and e.starts_at<=target_starts_at
            and e.ends_at>=target_starts_at+make_interval(mins => l.lesson_duration_minutes)
            and mod(extract(epoch from (target_starts_at-e.starts_at)),l.lesson_duration_minutes*60)=0)
      )
      and not exists(select 1 from public.coach_availability_exceptions e
        where e.coach_id=target_coach and e.exception_type='block'
          and e.starts_at<target_starts_at+make_interval(mins => l.lesson_duration_minutes)
          and e.ends_at>target_starts_at)
      and not exists(select 1 from public.club_closures c
        where c.cancelled_at is null and (l.local_start::date between c.starts_on and c.ends_on))
      and not exists(select 1 from public.bookings b
        where b.booking_model='lesson_v2' and b.coach_id=target_coach
          and b.starts_at<target_starts_at+make_interval(mins => l.lesson_duration_minutes)
          and b.ends_at>target_starts_at and b.status in ('scheduled','attended','no_show')
          and (ignored_booking is null or b.id<>ignored_booking))
  );
$$;

create or replace function public.list_lesson_coaches()
returns table(coach_id uuid,full_name text,weapons text[]) language sql stable security definer set search_path=public as $$
  select cp.coach_id,p.full_name,array_agg(cw.weapon order by cw.weapon)
  from public.coach_lesson_profiles cp join public.profiles p on p.id=cp.coach_id
  join public.coach_lesson_weapons cw on cw.coach_id=cp.coach_id
  where cp.is_active and p.is_active and p.is_staff and p.staff_type='coach'
  group by cp.coach_id,p.full_name order by p.full_name;
$$;

create or replace function public.list_available_lesson_times(
  target_coach uuid,target_weapon text,range_start date default null,range_end date default null
) returns table(starts_at timestamptz,ends_at timestamptz) language sql stable security definer set search_path=public as $$
  with cfg as (select * from public.lesson_booking_settings where singleton),
  bounds as (
    select greatest(coalesce(range_start,(now() at time zone 'Africa/Johannesburg')::date),
        (now() at time zone 'Africa/Johannesburg')::date) as first_day,
      least(coalesce(range_end,(now() at time zone 'Africa/Johannesburg')::date+cfg.booking_horizon_days-1),
        (now() at time zone 'Africa/Johannesburg')::date+cfg.booking_horizon_days-1) as last_day,
      cfg.lesson_duration_minutes from cfg
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
  ), candidates as (select * from standing union select * from extras)
  select c.slot_start,c.slot_start+make_interval(mins => c.lesson_duration_minutes)
  from candidates c
  where public.lesson_time_is_available(target_coach,c.slot_start,target_weapon,null)
  order by c.slot_start;
$$;

create or replace function public.get_lesson_quote(target_participant_ids uuid[])
returns table(participant_count integer,total_cents integer,currency text) language plpgsql stable security definer set search_path=public as $$
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
    v_payer<>auth.uid() or exists(select 1 from public.profiles p
      where p.id=auth.uid() and p.is_staff and p.staff_type='coach')
  ) then raise exception using message='forbidden',errcode='P0001'; end if;
  return query select v_count,s.single_lesson_price_cents*v_count,'ZAR'::text
    from public.lesson_booking_settings s where s.singleton;
end $$;

create or replace function public.create_lesson_booking_v2(
  target_coach uuid,target_starts_at timestamptz,target_participant_ids uuid[],target_weapon text
) returns uuid language plpgsql security definer set search_path=public as $$
declare v_actor public.profiles; v_count integer; v_payer uuid; v_booking uuid; v_slot uuid;
declare v_duration integer; v_price numeric(10,2); v_participant uuid; v_first uuid; v_ordinal integer:=0;
begin
  select * into v_actor from public.profiles where id=auth.uid() and is_active;
  if v_actor.id is null then raise exception using message='not_authenticated',errcode='P0001'; end if;
  if not public.current_user_is_admin() and v_actor.is_staff and v_actor.staff_type='coach'
  then raise exception using message='participant_unauthorized',errcode='P0001'; end if;
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

create or replace function public.lesson_actor_can_manage_booking(target_booking uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select public.current_user_is_admin() or exists(
    select 1 from public.booking_participants bp
    where bp.booking_id=b.id and (bp.participant_id=auth.uid() or exists(
      select 1 from public.family_links fl where fl.guardian_id=auth.uid()
        and fl.dependent_id=bp.participant_id and fl.status='active'
        and public.active_billing_payer(bp.participant_id)=auth.uid())))
  from public.bookings b where b.id=target_booking;
$$;

create or replace function public.current_user_can_view_lesson_finances()
returns boolean language sql stable security definer set search_path=public as $$
  select public.current_user_is_admin() or (
    auth.uid() is not null
    and public.active_billing_payer(auth.uid())=auth.uid()
    and not exists(select 1 from public.profiles p
      where p.id=auth.uid() and p.is_staff and p.staff_type='coach')
  );
$$;

create or replace function public.cancel_lesson_booking_v2(
  target_booking uuid,target_reason text default null,target_actor_type text default 'member'
) returns void language plpgsql security definer set search_path=public as $$
declare b public.bookings; cutoff integer; late_fee numeric; no_charge boolean;
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
  select cancellation_window_hours,late_cancellation_fee_multiplier into cutoff,late_fee
    from public.lesson_booking_settings where singleton;
  no_charge:=target_actor_type in ('coach','admin','closure','system') or b.starts_at>now()+make_interval(hours => cutoff);
  update public.bookings set status='cancelled',cancellation_actor_id=auth.uid(),
    cancellation_actor_type=target_actor_type,cancellation_reason=nullif(trim(target_reason),''),cancelled_at=now(),updated_at=now()
    where id=b.id;
  if no_charge then
    update public.charges set lifecycle_state='voided',voided_at=now(),updated_at=now()
      where booking_id=b.id and lifecycle_state='provisional';
  else
    update public.charges set amount=round(amount*late_fee,2),lifecycle_state='finalized',finalized_at=now(),updated_at=now()
      where booking_id=b.id and lifecycle_state='provisional';
  end if;
  insert into public.audit_events(event_type,actor_id,subject_profile_id,entity_type,entity_id,metadata)
  values('lesson.booking_cancelled',auth.uid(),b.fencer_id,'booking',b.id,
    jsonb_build_object('actor_type',target_actor_type,'charged',not no_charge));
end $$;

create or replace function public.reschedule_lesson_booking_v2(
  target_booking uuid,target_starts_at timestamptz
) returns uuid language plpgsql security definer set search_path=public as $$
declare old_b public.bookings; new_booking uuid; participant_ids uuid[]; cutoff integer; late boolean;
begin
  select * into old_b from public.bookings where id=target_booking and booking_model='lesson_v2' for update;
  if not found or old_b.status<>'scheduled' then raise exception using message='booking_not_scheduled',errcode='P0001'; end if;
  if old_b.starts_at<=now() then raise exception using message='booking_already_started',errcode='P0001'; end if;
  if not public.lesson_actor_can_manage_booking(target_booking) then raise exception using message='forbidden',errcode='P0001'; end if;
  select array_agg(participant_id order by ordinal) into participant_ids from public.booking_participants where booking_id=old_b.id;
  select cancellation_window_hours into cutoff from public.lesson_booking_settings where singleton;
  late:=old_b.starts_at<=now()+make_interval(hours => cutoff);
  new_booking:=public.create_lesson_booking_v2(old_b.coach_id,target_starts_at,participant_ids,old_b.weapon);
  update public.bookings set status='rescheduled',rescheduled_to_booking_id=new_booking,updated_at=now() where id=old_b.id;
  update public.bookings set rescheduled_from_booking_id=old_b.id,updated_at=now() where id=new_booking;
  update public.charges new_charge set replaced_charge_id=old_charge.id,updated_at=now()
    from public.charges old_charge where new_charge.booking_id=new_booking
      and old_charge.booking_id=old_b.id and old_charge.fencer_id=new_charge.fencer_id;
  if late then
    update public.charges set lifecycle_state='finalized',finalized_at=now(),updated_at=now()
      where booking_id=old_b.id and lifecycle_state='provisional';
  else
    update public.charges set lifecycle_state='voided',voided_at=now(),updated_at=now()
      where booking_id=old_b.id and lifecycle_state='provisional';
  end if;
  insert into public.audit_events(event_type,actor_id,subject_profile_id,entity_type,entity_id,metadata)
  values('lesson.booking_rescheduled',auth.uid(),old_b.fencer_id,'booking',new_booking,
    jsonb_build_object('from_booking_id',old_b.id,'late',late));
  return new_booking;
end $$;

create or replace function public.record_lesson_outcome(target_booking uuid,target_outcome text)
returns void language plpgsql security definer set search_path=public as $$
declare b public.bookings; multiplier numeric;
begin
  if target_outcome not in ('attended','no_show') then raise exception using message='invalid_outcome',errcode='P0001'; end if;
  select * into b from public.bookings where id=target_booking and booking_model='lesson_v2' for update;
  if not found or b.status<>'scheduled' or b.ends_at>now()
  then raise exception using message='outcome_not_allowed',errcode='P0001'; end if;
  if not (public.current_user_is_admin() or b.coach_id=auth.uid())
  then raise exception using message='forbidden',errcode='P0001'; end if;
  select no_show_fee_multiplier into multiplier from public.lesson_booking_settings where singleton;
  update public.bookings set status=target_outcome,outcome_recorded_at=now(),outcome_recorded_by=auth.uid(),updated_at=now()
    where id=b.id;
  update public.charges set amount=case when target_outcome='no_show' then round(amount*multiplier,2) else amount end,
    lifecycle_state='finalized',finalized_at=now(),updated_at=now()
    where booking_id=b.id and lifecycle_state='provisional';
  insert into public.audit_events(event_type,actor_id,subject_profile_id,entity_type,entity_id,metadata)
  values('lesson.booking_'||target_outcome,auth.uid(),b.fencer_id,'booking',b.id,'{}');
end $$;

create or replace function public.update_lesson_booking_settings(settings_patch jsonb)
returns public.lesson_booking_settings language plpgsql security definer set search_path=public as $$
declare result public.lesson_booking_settings;
begin
  if not public.current_user_is_admin() then raise exception using message='forbidden',errcode='P0001'; end if;
  if settings_patch ?| array['payment_mode','double_lesson_multiplier','double_lesson_atomic','closure_mode',
    'lesson_duration_minutes','arrears_blocking_enabled','future_booking_cap_per_fencer']
  then raise exception using message='locked_setting',errcode='P0001'; end if;
  update public.lesson_booking_settings set
    cancellation_window_hours=coalesce((settings_patch->>'cancellation_window_hours')::integer,cancellation_window_hours),
    late_cancellation_fee_multiplier=coalesce((settings_patch->>'late_cancellation_fee_multiplier')::numeric,late_cancellation_fee_multiplier),
    no_show_fee_multiplier=coalesce((settings_patch->>'no_show_fee_multiplier')::numeric,no_show_fee_multiplier),
    booking_horizon_days=coalesce((settings_patch->>'booking_horizon_days')::integer,booking_horizon_days),
    booking_cutoff_minutes=coalesce((settings_patch->>'booking_cutoff_minutes')::integer,booking_cutoff_minutes),
    single_lesson_price_cents=coalesce((settings_patch->>'single_lesson_price_cents')::integer,single_lesson_price_cents),
    updated_by=auth.uid(),updated_at=now()
  where singleton returning * into result;
  return result;
exception when check_violation or invalid_text_representation then
  raise exception using message='invalid_settings',errcode='P0001';
end $$;

create or replace function public.admin_set_coach_lesson_profile(
  target_coach uuid,target_active boolean,target_weapons text[]
) returns void language plpgsql security definer set search_path=public as $$
begin
  if not public.current_user_is_admin() then raise exception using message='forbidden',errcode='P0001'; end if;
  if not exists(select 1 from public.profiles where id=target_coach and is_staff and staff_type='coach')
  then raise exception using message='invalid_coach',errcode='P0001'; end if;
  if exists(select 1 from unnest(target_weapons) w where w not in ('foil','epee','sabre'))
  then raise exception using message='invalid_weapon',errcode='P0001'; end if;
  insert into public.coach_lesson_profiles(coach_id,is_active,deactivated_at,updated_by)
  values(target_coach,target_active,case when target_active then null else now() end,auth.uid())
  on conflict(coach_id) do update set is_active=excluded.is_active,deactivated_at=excluded.deactivated_at,
    updated_by=auth.uid(),updated_at=now();
  delete from public.coach_lesson_weapons where coach_id=target_coach;
  insert into public.coach_lesson_weapons(coach_id,weapon)
    select target_coach,w from (select distinct unnest(target_weapons) w) x;
end $$;

create or replace function public.admin_create_coach_exception(
  target_coach uuid,target_type text,target_starts_at timestamptz,target_ends_at timestamptz,
  target_reason text default null,cancel_affected boolean default false
) returns uuid language plpgsql security definer set search_path=public as $$
declare v_id uuid; affected record;
begin
  if not public.current_user_is_admin() and auth.uid()<>target_coach
  then raise exception using message='forbidden',errcode='P0001'; end if;
  if target_type not in ('block','extra') or target_ends_at<=target_starts_at
  then raise exception using message='invalid_exception',errcode='P0001'; end if;
  if target_type='block' and not cancel_affected and exists(select 1 from public.bookings
    where booking_model='lesson_v2' and coach_id=target_coach and status='scheduled'
      and starts_at>now() and starts_at<target_ends_at and ends_at>target_starts_at)
  then raise exception using message='affected_bookings_require_confirmation',errcode='P0001'; end if;
  insert into public.coach_availability_exceptions(coach_id,exception_type,starts_at,ends_at,reason,created_by)
  values(target_coach,target_type,target_starts_at,target_ends_at,nullif(trim(target_reason),''),auth.uid()) returning id into v_id;
  if target_type='block' and cancel_affected then
    for affected in select id from public.bookings where booking_model='lesson_v2' and coach_id=target_coach
      and status='scheduled' and starts_at>now() and starts_at<target_ends_at and ends_at>target_starts_at for update
    loop perform public.cancel_lesson_booking_v2(affected.id,target_reason,'coach'); end loop;
  end if;
  return v_id;
end $$;

create or replace function public.admin_create_club_closure(
  target_starts_on date,target_ends_on date,target_reason text,cancel_affected boolean default false
) returns uuid language plpgsql security definer set search_path=public as $$
declare v_id uuid; affected record;
begin
  if not public.current_user_is_admin() then raise exception using message='forbidden',errcode='P0001'; end if;
  if target_ends_on<target_starts_on or nullif(trim(target_reason),'') is null
  then raise exception using message='invalid_closure',errcode='P0001'; end if;
  if not cancel_affected and exists(select 1 from public.bookings b
    where b.booking_model='lesson_v2' and b.status='scheduled'
      and b.starts_at>now() and (b.starts_at at time zone 'Africa/Johannesburg')::date between target_starts_on and target_ends_on)
  then raise exception using message='affected_bookings_require_confirmation',errcode='P0001'; end if;
  insert into public.club_closures(starts_on,ends_on,reason,created_by)
  values(target_starts_on,target_ends_on,trim(target_reason),auth.uid()) returning id into v_id;
  insert into public.closure_affected_bookings(closure_id,booking_id)
  select v_id,b.id from public.bookings b where b.booking_model='lesson_v2' and b.status='scheduled'
    and b.starts_at>now() and (b.starts_at at time zone 'Africa/Johannesburg')::date between target_starts_on and target_ends_on;
  if cancel_affected then
    for affected in select b.id from public.bookings b join public.closure_affected_bookings cab on cab.booking_id=b.id
      where cab.closure_id=v_id and b.status='scheduled' and b.starts_at>now() for update
    loop
      perform public.cancel_lesson_booking_v2(affected.id,target_reason,'closure');
      update public.closure_affected_bookings set action='cancelled' where closure_id=v_id and booking_id=affected.id;
    end loop;
  end if;
  return v_id;
end $$;

create or replace function public.admin_preview_club_closure(target_starts_on date,target_ends_on date)
returns table(booking_id uuid,coach_id uuid,starts_at timestamptz,participant_names text[])
language plpgsql stable security definer set search_path=public as $$
begin
  if not public.current_user_is_admin() then raise exception using message='forbidden',errcode='P0001'; end if;
  if target_ends_on<target_starts_on then raise exception using message='invalid_closure',errcode='P0001'; end if;
  return query select b.id,b.coach_id,b.starts_at,array_agg(p.full_name order by bp.ordinal)
    from public.bookings b join public.booking_participants bp on bp.booking_id=b.id
    join public.profiles p on p.id=bp.participant_id
    where b.booking_model='lesson_v2' and b.status='scheduled'
      and b.starts_at>now() and (b.starts_at at time zone 'Africa/Johannesburg')::date between target_starts_on and target_ends_on
    group by b.id order by b.starts_at;
end $$;

create or replace function public.preview_coach_availability_exception(
  target_coach uuid,target_starts_at timestamptz,target_ends_at timestamptz
) returns table(booking_id uuid,starts_at timestamptz,ends_at timestamptz,participant_names text[])
language plpgsql stable security definer set search_path=public as $$
begin
  if target_ends_at<=target_starts_at then raise exception using message='invalid_exception',errcode='P0001'; end if;
  if not public.current_user_is_admin() and not exists(
    select 1 from public.profiles p where p.id=auth.uid() and p.is_staff and p.staff_type='coach' and p.id=target_coach
  ) then raise exception using message='forbidden',errcode='P0001'; end if;
  return query
  select b.id,b.starts_at,b.ends_at,array_agg(p.full_name order by bp.ordinal)
  from public.bookings b join public.booking_participants bp on bp.booking_id=b.id
  join public.profiles p on p.id=bp.participant_id
  where b.booking_model='lesson_v2' and b.coach_id=target_coach and b.status='scheduled'
    and b.starts_at>now() and b.starts_at<target_ends_at and b.ends_at>target_starts_at
  group by b.id order by b.starts_at;
end $$;

create or replace function public.admin_cancel_coach_future_bookings(target_coach uuid,target_reason text)
returns integer language plpgsql security definer set search_path=public as $$
declare affected record; total integer:=0;
begin
  if not public.current_user_is_admin() then raise exception using message='forbidden',errcode='P0001'; end if;
  for affected in select id from public.bookings where booking_model='lesson_v2' and coach_id=target_coach
    and status='scheduled' and starts_at>now() for update
  loop perform public.cancel_lesson_booking_v2(affected.id,target_reason,'admin'); total:=total+1; end loop;
  return total;
end $$;

create or replace function public.admin_waive_booking_charges(target_booking uuid,target_reason text)
returns void language plpgsql security definer set search_path=public as $$
declare c public.charges; invoice_row uuid;
begin
  if not public.current_user_is_admin() then raise exception using message='forbidden',errcode='P0001'; end if;
  if nullif(trim(target_reason),'') is null then raise exception using message='waiver_reason_required',errcode='P0001'; end if;
  for c in select * from public.charges where booking_id=target_booking and type='lesson'
    and lifecycle_state not in ('voided','waived') for update loop
    if c.status='paid' then
      insert into public.ledger_credits(payer_id,participant_id,booking_id,charge_id,amount,reason,created_by)
      values(c.payer_id,c.fencer_id,target_booking,c.id,c.amount,trim(target_reason),auth.uid()) on conflict(charge_id) do nothing;
    else
      select invoice_id into invoice_row from public.invoice_lines where charge_id=c.id;
      delete from public.invoice_lines where charge_id=c.id;
      if invoice_row is not null then update public.invoices set total=(select coalesce(sum(amount),0)
        from public.invoice_lines where invoice_id=invoice_row) where id=invoice_row; end if;
    end if;
    update public.charges set lifecycle_state='waived',waived_at=now(),waived_by=auth.uid(),
      waiver_reason=trim(target_reason),updated_at=now() where id=c.id;
  end loop;
  insert into public.audit_events(event_type,actor_id,entity_type,entity_id,metadata)
  values('lesson.booking_charges_waived',auth.uid(),'booking',target_booking,jsonb_build_object('reason',trim(target_reason)));
end $$;

-- Only finalized charges enter invoices. Provisional lessons remain pending for the payer.
create or replace function public.run_monthly_invoices(target_period date)
returns integer language plpgsql security definer set search_path=public as $$
declare payer_row record; v_invoice_id uuid; made integer:=0;
begin
  if not public.current_user_is_admin() then raise exception 'forbidden'; end if;
  target_period:=date_trunc('month',target_period)::date;
  insert into public.charges(fencer_id,payer_id,type,amount,status,period,description)
  select m.profile_id,public.active_billing_payer(m.profile_id),'membership',mt.price,'unpaid',target_period,mt.name
  from public.memberships m join public.membership_types mt on mt.id=m.membership_type_id
  where m.status='active' and mt.code='month_to_month' and m.started_at<target_period+interval '1 month'
  on conflict do nothing;
  for payer_row in select distinct c.payer_id from public.charges c left join public.bookings b on b.id=c.booking_id
    where c.status='unpaid' and c.lifecycle_state='finalized' and c.period=target_period
      and (c.type in ('membership','joining_fee') or (c.type='lesson' and b.payment_option='pay_later')) loop
    insert into public.invoices(payer_id,period) values(payer_row.payer_id,target_period)
    on conflict(payer_id,period) do update set payer_id=excluded.payer_id returning id into v_invoice_id;
    insert into public.invoice_lines(invoice_id,charge_id,participant_id,description,amount)
    select v_invoice_id,c.id,c.fencer_id,c.description,c.amount from public.charges c left join public.bookings b on b.id=c.booking_id
    where c.payer_id=payer_row.payer_id and c.period=target_period and c.status='unpaid'
      and c.lifecycle_state='finalized'
      and (c.type in ('membership','joining_fee') or (c.type='lesson' and b.payment_option='pay_later'))
    on conflict(charge_id) do nothing;
    delete from public.invoice_lines il using public.charges c where il.invoice_id=v_invoice_id
      and il.charge_id=c.id and c.status='unpaid' and c.lifecycle_state in ('voided','waived');
    update public.invoices set total=(select coalesce(sum(amount),0) from public.invoice_lines where invoice_id=v_invoice_id)
      where id=v_invoice_id;
    made:=made+1;
  end loop;
  return made;
end $$;

-- Safe coach DTO: no payer, payment, price, charge, invoice, or receipt fields.
create or replace function public.list_coach_lesson_agenda(target_coach uuid default null)
returns table(
  booking_id uuid,coach_id uuid,starts_at timestamptz,ends_at timestamptz,
  weapon text,status text,participant_names text[]
) language plpgsql stable security definer set search_path=public as $$
declare requested_coach uuid:=coalesce(target_coach,auth.uid());
begin
  if not public.current_user_is_admin() and (public.current_user_role()<>'coach' or requested_coach<>auth.uid())
  then raise exception using message='forbidden',errcode='P0001'; end if;
  return query
  select b.id,b.coach_id,b.starts_at,b.ends_at,b.weapon,b.status,
    array_agg(p.full_name order by bp.ordinal)
  from public.bookings b join public.booking_participants bp on bp.booking_id=b.id
  join public.profiles p on p.id=bp.participant_id
  where b.booking_model='lesson_v2' and b.coach_id=requested_coach
  group by b.id order by b.starts_at;
end $$;

-- Member/dependent lesson DTO deliberately omits payment_option and every monetary field.
create or replace function public.list_my_lesson_bookings()
returns table(
  booking_id uuid,coach_id uuid,coach_name text,starts_at timestamptz,ends_at timestamptz,
  weapon text,status text,participant_names text[],cancelled_at timestamptz,cancellation_reason text,cancellation_deadline timestamptz,
  rescheduled_from_booking_id uuid,rescheduled_to_booking_id uuid
) language plpgsql stable security definer set search_path=public as $$
declare cancellation_hours integer;
begin
  if auth.uid() is null or exists(select 1 from public.profiles p
    where p.id=auth.uid() and p.is_staff and p.staff_type='coach')
  then raise exception using message='forbidden',errcode='P0001'; end if;
  select cancellation_window_hours into cancellation_hours
    from public.lesson_booking_settings where singleton;
  return query
  select b.id,b.coach_id,coach.full_name,b.starts_at,b.ends_at,b.weapon,b.status,
    array_agg(participant.full_name order by bp.ordinal),
    b.cancelled_at,b.cancellation_reason,
    b.starts_at-make_interval(hours => cancellation_hours),
    b.rescheduled_from_booking_id,b.rescheduled_to_booking_id
  from public.bookings b join public.booking_participants bp on bp.booking_id=b.id
  join public.profiles participant on participant.id=bp.participant_id
  join public.profiles coach on coach.id=b.coach_id
  where b.booking_model='lesson_v2' and public.lesson_actor_can_manage_booking(b.id)
  group by b.id,coach.full_name order by b.starts_at;
end $$;

create or replace function public.notify_payer_of_cfa_lesson_change()
returns trigger language plpgsql security definer set search_path=public as $$
declare payer uuid;
begin
  if new.booking_model='lesson_v2' and new.status is distinct from old.status
    and new.status in ('cancelled','rescheduled')
    and (new.cancellation_actor_type in ('coach','admin','closure','system')
      or public.current_user_is_admin() or public.current_user_role()='coach') then
    for payer in select distinct public.active_billing_payer(bp.participant_id)
      from public.booking_participants bp where bp.booking_id=new.id loop
      insert into public.lesson_notifications(recipient_id,booking_id,notification_type,message)
      values(payer,new.id,case when new.status='cancelled' then 'booking_cancelled' else 'booking_changed' end,
        case when new.status='cancelled' then 'CFA cancelled a lesson at no charge.'
          else 'CFA changed a lesson booking.' end);
    end loop;
  end if;
  return new;
end $$;
create trigger notify_payer_of_cfa_lesson_change
  after update of status on public.bookings for each row
  execute function public.notify_payer_of_cfa_lesson_change();

-- RLS and grants. Monetary tables remain payer/admin only; coaches only see assigned lesson identity.
alter table public.lesson_booking_settings enable row level security;
alter table public.coach_lesson_profiles enable row level security;
alter table public.coach_lesson_weapons enable row level security;
alter table public.coach_availability_rules enable row level security;
alter table public.coach_availability_exceptions enable row level security;
alter table public.club_closures enable row level security;
alter table public.booking_participants enable row level security;
alter table public.closure_affected_bookings enable row level security;
alter table public.lesson_notifications enable row level security;
alter table public.ledger_credits enable row level security;

create policy "admins read lesson settings" on public.lesson_booking_settings for select using(public.current_user_is_admin());
create policy "admins manage lesson settings" on public.lesson_booking_settings for all using(public.current_user_is_admin());
create policy "lesson profiles are readable" on public.coach_lesson_profiles for select using(is_active or coach_id=auth.uid() or public.current_user_is_admin());
create policy "admins manage lesson profiles" on public.coach_lesson_profiles for all using(public.current_user_is_admin());
create policy "active coach weapons are readable" on public.coach_lesson_weapons for select using(exists(
  select 1 from public.coach_lesson_profiles cp where cp.coach_id=coach_lesson_weapons.coach_id and cp.is_active));
create policy "admins manage coach weapons" on public.coach_lesson_weapons for all using(public.current_user_is_admin());
create policy "coach or admin reads availability rules" on public.coach_availability_rules for select
  using(coach_id=auth.uid() or public.current_user_is_admin());
create policy "coach or admin manages availability rules" on public.coach_availability_rules for all
  using(coach_id=auth.uid() or public.current_user_is_admin());
create policy "coach or admin reads availability exceptions" on public.coach_availability_exceptions for select
  using(coach_id=auth.uid() or public.current_user_is_admin());
create policy "coach or admin manages availability exceptions" on public.coach_availability_exceptions for all
  using(coach_id=auth.uid() or public.current_user_is_admin());
create policy "authenticated read active closures" on public.club_closures for select to authenticated using(cancelled_at is null);
create policy "admins manage closures" on public.club_closures for all using(public.current_user_is_admin());
create policy "booking parties read participants" on public.booking_participants for select
  using(public.lesson_actor_can_manage_booking(booking_id));
create policy "admins read closure effects" on public.closure_affected_bookings for select using(public.current_user_is_admin());
create policy "recipients read lesson notifications" on public.lesson_notifications for select using(recipient_id=auth.uid() or public.current_user_is_admin());
create policy "recipients update lesson notifications" on public.lesson_notifications for update using(recipient_id=auth.uid());
create policy "payer or admin reads ledger credits" on public.ledger_credits for select using(
  public.current_user_is_admin() or (payer_id=auth.uid() and public.current_user_can_view_lesson_finances()));

drop policy if exists "Coaches can read fencer profiles" on public.profiles;
drop policy if exists "booking participants read" on public.bookings;
create policy "booking parties read" on public.bookings for select using(
  public.lesson_actor_can_manage_booking(id) and public.current_user_can_view_lesson_finances()
);
drop policy if exists "public reads open slots" on public.lesson_slots;

drop policy if exists "payer or admin reads household" on public.households;
create policy "payer or admin reads household" on public.households for select using(
  public.current_user_is_admin() or (payer_id=auth.uid() and public.current_user_can_view_lesson_finances()));

drop policy if exists "payer or admin reads charges" on public.charges;
create policy "payer or admin reads charges" on public.charges for select using(
  public.current_user_is_admin() or (payer_id=auth.uid() and public.current_user_can_view_lesson_finances()));
drop policy if exists "payer or admin reads invoices" on public.invoices;
create policy "payer or admin reads invoices" on public.invoices for select using(
  public.current_user_is_admin() or (payer_id=auth.uid() and public.current_user_can_view_lesson_finances()));
drop policy if exists "payer or admin reads invoice lines" on public.invoice_lines;
create policy "payer or admin reads invoice lines" on public.invoice_lines for select using(exists(
  select 1 from public.invoices i where i.id=invoice_id and
    (public.current_user_is_admin() or (i.payer_id=auth.uid() and public.current_user_can_view_lesson_finances()))));
drop policy if exists "payer or admin reads receipts" on public.receipts;
create policy "payer or admin reads receipts" on public.receipts for select using(
  public.current_user_is_admin() or (payer_id=auth.uid() and public.current_user_can_view_lesson_finances()));
drop policy if exists "payer or admin reads payment attempts" on public.payment_attempts;
create policy "payer or admin reads payment attempts" on public.payment_attempts for select using(
  public.current_user_is_admin() or (payer_id=auth.uid() and public.current_user_can_view_lesson_finances()));
drop policy if exists "payer manages own payment references" on public.payment_method_references;
create policy "payer manages own payment references" on public.payment_method_references for all
  using(payer_id=auth.uid() and public.current_user_can_view_lesson_finances())
  with check(payer_id=auth.uid() and public.current_user_can_view_lesson_finances());

revoke all on function public.lesson_actor_can_manage_participant(uuid) from public;
revoke all on function public.lesson_time_is_available(uuid,timestamptz,text,uuid) from public;
revoke all on function public.lesson_actor_can_manage_booking(uuid) from public;
revoke all on function public.current_user_can_view_lesson_finances() from public;
revoke all on function public.get_lesson_quote(uuid[]) from public;
revoke all on function public.list_lesson_coaches() from public;
revoke all on function public.list_available_lesson_times(uuid,text,date,date) from public;
revoke all on function public.list_open_lesson_slots() from anon,authenticated;
revoke all on function public.create_lesson_booking(uuid,uuid,text) from public,anon,authenticated;
revoke all on function public.create_lesson_booking_v2(uuid,timestamptz,uuid[],text) from public;
revoke all on function public.cancel_lesson_booking_v2(uuid,text,text) from public;
revoke all on function public.reschedule_lesson_booking_v2(uuid,timestamptz) from public;
revoke all on function public.record_lesson_outcome(uuid,text) from public;
revoke all on function public.update_lesson_booking_settings(jsonb) from public;
revoke all on function public.admin_set_coach_lesson_profile(uuid,boolean,text[]) from public;
revoke all on function public.admin_create_coach_exception(uuid,text,timestamptz,timestamptz,text,boolean) from public;
revoke all on function public.admin_create_club_closure(date,date,text,boolean) from public;
revoke all on function public.admin_preview_club_closure(date,date) from public;
revoke all on function public.preview_coach_availability_exception(uuid,timestamptz,timestamptz) from public;
revoke all on function public.admin_cancel_coach_future_bookings(uuid,text) from public;
revoke all on function public.admin_waive_booking_charges(uuid,text) from public;
revoke all on function public.list_coach_lesson_agenda(uuid) from public;
revoke all on function public.list_my_lesson_bookings() from public;
grant execute on function public.list_lesson_coaches() to anon,authenticated;
grant execute on function public.list_available_lesson_times(uuid,text,date,date) to anon,authenticated;
grant execute on function public.list_open_lesson_slots() to service_role;
grant execute on function public.get_lesson_quote(uuid[]) to authenticated;
grant execute on function public.lesson_actor_can_manage_booking(uuid) to authenticated;
grant execute on function public.current_user_can_view_lesson_finances() to authenticated;
grant execute on function public.create_lesson_booking_v2(uuid,timestamptz,uuid[],text) to authenticated;
grant execute on function public.cancel_lesson_booking_v2(uuid,text,text) to authenticated;
grant execute on function public.reschedule_lesson_booking_v2(uuid,timestamptz) to authenticated;
grant execute on function public.record_lesson_outcome(uuid,text) to authenticated;
grant execute on function public.update_lesson_booking_settings(jsonb) to authenticated;
grant execute on function public.admin_set_coach_lesson_profile(uuid,boolean,text[]) to authenticated;
grant execute on function public.admin_create_coach_exception(uuid,text,timestamptz,timestamptz,text,boolean) to authenticated;
grant execute on function public.admin_create_club_closure(date,date,text,boolean) to authenticated;
grant execute on function public.admin_preview_club_closure(date,date) to authenticated;
grant execute on function public.preview_coach_availability_exception(uuid,timestamptz,timestamptz) to authenticated;
grant execute on function public.admin_cancel_coach_future_bookings(uuid,text) to authenticated;
grant execute on function public.admin_waive_booking_charges(uuid,text) to authenticated;
grant execute on function public.list_coach_lesson_agenda(uuid) to authenticated;
grant execute on function public.list_my_lesson_bookings() to authenticated;

grant select on public.coach_lesson_profiles,public.coach_lesson_weapons,public.coach_availability_rules,
  public.coach_availability_exceptions,public.club_closures,public.booking_participants,
  public.closure_affected_bookings,public.lesson_notifications,public.ledger_credits to authenticated;
grant update(read_at) on public.lesson_notifications to authenticated;
grant all on public.lesson_booking_settings,public.coach_lesson_profiles,public.coach_lesson_weapons,
  public.coach_availability_rules,public.coach_availability_exceptions,public.club_closures,
  public.closure_affected_bookings to service_role;
