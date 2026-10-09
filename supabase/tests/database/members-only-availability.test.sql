begin;
select plan(7);

insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data,raw_app_meta_data)
values
('95000000-0000-4000-8000-000000000001','mo-member@cfa.test',now(),'{"full_name":"Members Only Member"}','{}'),
('95000000-0000-4000-8000-000000000002','mo-guest@cfa.test',now(),'{"full_name":"Members Only Guest"}','{}');
update public.profiles set membership_status='member', date_of_birth='1990-01-01', profile_completed_at=now()
where id='95000000-0000-4000-8000-000000000001';
update public.profiles set membership_status='guest', date_of_birth='1990-01-01', profile_completed_at=now()
where id='95000000-0000-4000-8000-000000000002';

-- The seeded coach teaches foil 16:00-20:00 every day; make those hours members-only.
update public.coach_availability_rules set access_rule='active_members_only'
where coach_id='22222222-2222-4222-8222-222222222222';

select ok(public.lesson_time_is_members_only('22222222-2222-4222-8222-222222222222',
  ((current_date + 12) + time '18:00') at time zone 'Africa/Johannesburg'), 'standing hours report members-only');
select ok((select bool_and(members_only) from public.list_lesson_time_options('22222222-2222-4222-8222-222222222222','foil',
  current_date + 12, current_date + 12)), 'time options label every slot members-only');

set local role authenticated;
select set_config('request.jwt.claim.sub','95000000-0000-4000-8000-000000000002',true);
select throws_ok($$select public.create_lesson_booking_v3('22222222-2222-4222-8222-222222222222',
  ((current_date + 12) + time '18:00') at time zone 'Africa/Johannesburg',
  array['95000000-0000-4000-8000-000000000002']::uuid[],'foil','pay_now')$$,
  'P0001','members_only','a guest cannot book members-only hours');

select set_config('request.jwt.claim.sub','95000000-0000-4000-8000-000000000001',true);
select lives_ok($$select public.create_lesson_booking_v3('22222222-2222-4222-8222-222222222222',
  ((current_date + 12) + time '18:00') at time zone 'Africa/Johannesburg',
  array['95000000-0000-4000-8000-000000000001']::uuid[],'foil','pay_later')$$,
  'an active member can book members-only hours');
reset role;
select is((select ls.access_rule from public.bookings b join public.lesson_slots ls on ls.id=b.lesson_slot_id
  join public.booking_participants bp on bp.booking_id=b.id where bp.participant_id='95000000-0000-4000-8000-000000000001'),
  'active_members_only','the booking records the access rule it was made under');

-- Extra one-off hours open the same time to everyone.
insert into public.coach_availability_exceptions(coach_id,exception_type,starts_at,ends_at,reason,created_by)
values('22222222-2222-4222-8222-222222222222','extra',
  ((current_date + 13) + time '19:00') at time zone 'Africa/Johannesburg',
  ((current_date + 13) + time '20:00') at time zone 'Africa/Johannesburg','Open session','22222222-2222-4222-8222-222222222222');
select ok(not public.lesson_time_is_members_only('22222222-2222-4222-8222-222222222222',
  ((current_date + 13) + time '19:00') at time zone 'Africa/Johannesburg'), 'extra hours are open to guests');

set local role authenticated;
select set_config('request.jwt.claim.sub','95000000-0000-4000-8000-000000000002',true);
select lives_ok($$select public.create_lesson_booking_v3('22222222-2222-4222-8222-222222222222',
  ((current_date + 13) + time '19:00') at time zone 'Africa/Johannesburg',
  array['95000000-0000-4000-8000-000000000002']::uuid[],'foil','pay_now')$$,
  'a guest can book open extra hours');
reset role;
select * from finish();
rollback;
