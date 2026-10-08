begin;
select plan(7);

-- Coach 22222222 (Misha) teaches 16:00-20:00 every day. Give the calendar
-- every kind of rule the per-slot functions know about.
update public.coach_availability_rules set access_rule='active_members_only'
where coach_id='22222222-2222-4222-8222-222222222222' and iso_weekday=6;
insert into public.coach_availability_exceptions(coach_id,exception_type,starts_at,ends_at,reason,created_by) values
  ('22222222-2222-4222-8222-222222222222','block',((current_date+5)+time '17:00') at time zone 'Africa/Johannesburg',
    ((current_date+5)+time '18:00') at time zone 'Africa/Johannesburg','Coach away','22222222-2222-4222-8222-222222222222'),
  ('22222222-2222-4222-8222-222222222222','extra',((current_date+6)+time '21:00') at time zone 'Africa/Johannesburg',
    ((current_date+6)+time '22:00') at time zone 'Africa/Johannesburg','Late session','22222222-2222-4222-8222-222222222222');
insert into public.club_closures(starts_on,ends_on,reason,created_by)
values(current_date+8,current_date+8,'Hall maintenance','11111111-1111-4111-8111-111111111111');

set local role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
select lives_ok($$select public.create_lesson_booking_v3('22222222-2222-4222-8222-222222222222',
  ((current_date+4)+time '16:30') at time zone 'Africa/Johannesburg',
  array['33333333-3333-4333-8333-333333333333']::uuid[],'foil','pay_now')$$,'a held lesson occupies one time');
reset role;

create temp table opts on commit drop as
  select * from public.list_lesson_time_options('22222222-2222-4222-8222-222222222222','foil');

select ok((select count(*) from opts)>600,'three months of times are listed');
select is((select count(*)::int from opts o where
    o.is_available is distinct from public.lesson_time_is_available('22222222-2222-4222-8222-222222222222',o.starts_at,'foil',null)
    or o.members_only is distinct from public.lesson_time_is_members_only('22222222-2222-4222-8222-222222222222',o.starts_at)),
  0,'every listed time agrees with the per-slot booking rules');
select ok(not (select is_available from opts where starts_at=((current_date+4)+time '16:30') at time zone 'Africa/Johannesburg'),
  'a booked time is unavailable');
select ok(not (select bool_or(is_available) from opts where (starts_at at time zone 'Africa/Johannesburg')::date=current_date+8),
  'a closure day has no available times');
select ok((select is_available and not members_only from opts where starts_at=((current_date+6)+time '21:30') at time zone 'Africa/Johannesburg'),
  'extra hours are listed, bookable and open to guests');
select is((select count(*)::int from public.list_lesson_time_options('22222222-2222-4222-8222-222222222222','sabre')),
  0,'a weapon the coach does not teach lists nothing');
select * from finish();
rollback;
