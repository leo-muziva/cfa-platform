-- list_lesson_time_options called lesson_time_is_available and
-- lesson_time_is_members_only once per candidate slot. Security-definer SQL
-- functions are never inlined, so three months of slots meant well over a
-- thousand separate function executions and a multi-second coach booking
-- page. The same rules now run as one set-based query. The per-slot
-- functions stay as they are: booking creation still uses them, and the
-- pgTAP test checks that both agree on every slot.
create or replace function public.list_lesson_time_options(
  target_coach uuid,target_weapon text,range_start date default null,range_end date default null
) returns table(starts_at timestamptz,ends_at timestamptz,is_available boolean,members_only boolean)
language sql stable security definer set search_path=public as $$
  with cfg as (select * from public.lesson_booking_settings where singleton),
  bounds as (
    select greatest(coalesce(range_start,(now() at time zone 'Africa/Johannesburg')::date),
        (now() at time zone 'Africa/Johannesburg')::date) as first_day,
      least(coalesce(range_end,horizon.last_day),horizon.last_day) as last_day,
      cfg.lesson_duration_minutes,cfg.booking_cutoff_minutes,
      (horizon.last_day+1)::timestamp at time zone 'Africa/Johannesburg' as horizon_end
    from cfg cross join lateral (
      select (date_trunc('month', now() at time zone 'Africa/Johannesburg')::date
        + (cfg.booking_horizon_calendar_months || ' months')::interval)::date - 1 as last_day
    ) horizon
  ), coach_ok as (
    select target_weapon in ('foil','epee','sabre')
      and exists(select 1 from public.coach_lesson_profiles cp where cp.coach_id=target_coach and cp.is_active)
      and exists(select 1 from public.profiles p where p.id=target_coach and p.is_active and p.is_staff and p.staff_type='coach')
      and exists(select 1 from public.coach_lesson_weapons cw where cw.coach_id=target_coach and cw.weapon=target_weapon) as ok
  ), standing as (
    select ((d.day::date+r.starts_at_local+g.slot_number*b.lesson_duration_minutes*interval '1 minute') at time zone 'Africa/Johannesburg') as slot_start
    from bounds b cross join lateral generate_series(b.first_day,b.last_day,interval '1 day') d(day)
    join public.coach_availability_rules r on r.coach_id=target_coach and r.is_active
      and r.iso_weekday=extract(isodow from d.day)::smallint
    cross join lateral generate_series(0,
      floor(extract(epoch from (r.ends_at_local-r.starts_at_local))/60/b.lesson_duration_minutes)::integer-1) g(slot_number)
  ), extras as (
    select e.starts_at+g.slot_number*b.lesson_duration_minutes*interval '1 minute' as slot_start
    from bounds b join public.coach_availability_exceptions e
      on e.coach_id=target_coach and e.exception_type='extra'
    cross join lateral generate_series(0,
      floor(extract(epoch from (e.ends_at-e.starts_at))/60/b.lesson_duration_minutes)::integer-1) g(slot_number)
    where (e.starts_at at time zone 'Africa/Johannesburg')::date between b.first_day and b.last_day
  ), candidates as (
    select distinct o.slot_start,
      o.slot_start+make_interval(mins => b.lesson_duration_minutes) as slot_end,
      o.slot_start at time zone 'Africa/Johannesburg' as local_start,
      (o.slot_start+make_interval(mins => b.lesson_duration_minutes)) at time zone 'Africa/Johannesburg' as local_end,
      b.lesson_duration_minutes,b.booking_cutoff_minutes,b.horizon_end
    from (select slot_start from standing union all select slot_start from extras) o cross join bounds b
  ), rules as (
    select * from public.coach_availability_rules where coach_id=target_coach and is_active
  ), exceptions as (
    select * from public.coach_availability_exceptions where coach_id=target_coach
  ), busy as (
    select b.starts_at,b.ends_at from public.bookings b
    where b.booking_model='lesson_v2' and b.coach_id=target_coach and b.status in ('scheduled','attended','no_show')
  ), closures as (
    select starts_on,ends_on from public.club_closures where cancelled_at is null
  ), checked as (
    select c.*,
      exists(select 1 from rules r where r.iso_weekday=extract(isodow from c.local_start)::smallint
        and c.local_start::time>=r.starts_at_local and c.local_end::time<=r.ends_at_local
        and mod(extract(epoch from (c.local_start::time-r.starts_at_local)),c.lesson_duration_minutes*60)=0) as rule_covers,
      exists(select 1 from exceptions e where e.exception_type='extra' and e.starts_at<=c.slot_start and e.ends_at>=c.slot_end
        and mod(extract(epoch from (c.slot_start-e.starts_at)),c.lesson_duration_minutes*60)=0) as extra_covers,
      exists(select 1 from exceptions e where e.exception_type='extra' and e.starts_at<=c.slot_start and e.ends_at>=c.slot_end) as inside_extra,
      exists(select 1 from rules r where r.iso_weekday=extract(isodow from c.local_start)::smallint
        and c.local_start::time>=r.starts_at_local and c.local_end::time<=r.ends_at_local and r.access_rule='active_members_only') as members_rule,
      exists(select 1 from rules r where r.iso_weekday=extract(isodow from c.local_start)::smallint
        and c.local_start::time>=r.starts_at_local and c.local_end::time<=r.ends_at_local and r.access_rule='guest_allowed') as guest_rule,
      exists(select 1 from exceptions e where e.exception_type='block' and e.starts_at<c.slot_end and e.ends_at>c.slot_start) as blocked,
      exists(select 1 from closures cl where c.local_start::date between cl.starts_on and cl.ends_on) as closed,
      exists(select 1 from busy b where b.starts_at<c.slot_end and b.ends_at>c.slot_start) as taken
    from candidates c
  )
  select k.slot_start,k.slot_end,
    k.slot_start>=now()+make_interval(mins => k.booking_cutoff_minutes) and k.slot_start<k.horizon_end
      and (k.rule_covers or k.extra_covers) and not k.blocked and not k.closed and not k.taken,
    k.members_rule and not k.guest_rule and not k.inside_extra
  from checked k cross join coach_ok
  where coach_ok.ok
  order by k.slot_start;
$$;
