-- Preserve scheduled coach occurrences for booking while keeping unavailability reasons private.
create or replace function public.list_lesson_time_options(
  target_coach uuid,target_weapon text,range_start date default null,range_end date default null
) returns table(starts_at timestamptz,ends_at timestamptz,is_available boolean)
language sql stable security definer set search_path=public as $$
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
  ), candidates as (
    select distinct slot_start,lesson_duration_minutes from (select * from standing union all select * from extras) occurrences
  )
  select c.slot_start,c.slot_start+make_interval(mins => c.lesson_duration_minutes),
    public.lesson_time_is_available(target_coach,c.slot_start,target_weapon,null)
  from candidates c
  where target_weapon in ('foil','epee','sabre')
    and exists(select 1 from public.coach_lesson_profiles cp where cp.coach_id=target_coach and cp.is_active)
    and exists(select 1 from public.profiles p where p.id=target_coach and p.is_active and p.is_staff and p.staff_type='coach')
    and exists(select 1 from public.coach_lesson_weapons cw where cw.coach_id=target_coach and cw.weapon=target_weapon)
  order by c.slot_start;
$$;

revoke all on function public.list_lesson_time_options(uuid,text,date,date) from public;
grant execute on function public.list_lesson_time_options(uuid,text,date,date) to anon,authenticated;
