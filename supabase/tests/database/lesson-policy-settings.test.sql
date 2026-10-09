begin;
select plan(9);

-- An adult member with a completed profile, so pay-later booking is allowed.
insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data,raw_app_meta_data)
values('94000000-0000-4000-8000-000000000001','policy-member@cfa.test',now(),'{"full_name":"Policy Member"}','{}');
update public.profiles set full_name='Policy Member', membership_status='member', date_of_birth='1990-01-01',
  profile_completed_at=now() where id='94000000-0000-4000-8000-000000000001';

update public.lesson_booking_settings set cancellation_window_hours=24, cancellation_partial_window_hours=3,
  cancellation_partial_fee_multiplier=.25, late_cancellation_fee_multiplier=.8 where singleton;

set local role authenticated;
select set_config('request.jwt.claim.sub','94000000-0000-4000-8000-000000000001',true);
select lives_ok($$select public.create_lesson_booking_v3(
  '22222222-2222-4222-8222-222222222222',
  ((current_date + 2) + time '18:00') at time zone 'Africa/Johannesburg',
  array['94000000-0000-4000-8000-000000000001']::uuid[], 'foil', 'pay_later')$$,
  'member books a pay-later lesson');
reset role;

select set_config('test.policy_booking', (select booking_id::text from public.booking_participants
  where participant_id='94000000-0000-4000-8000-000000000001'), true);
select is((select booked_cancellation_window_hours from public.bookings where id=current_setting('test.policy_booking')::uuid),
  24, 'free window is copied from settings, not hardcoded');
select is((select booked_partial_cancellation_window_hours from public.bookings where id=current_setting('test.policy_booking')::uuid),
  3, 'reduced window is copied from settings');
select is((select booked_partial_fee_multiplier from public.bookings where id=current_setting('test.policy_booking')::uuid),
  .25::numeric(6,2), 'reduced share is copied from settings');

-- Changing settings later never rewrites a booking that already exists.
update public.lesson_booking_settings set cancellation_window_hours=48 where singleton;
select is((select booked_cancellation_window_hours from public.bookings where id=current_setting('test.policy_booking')::uuid),
  24, 'existing bookings keep their booked terms');

set local role authenticated;
select set_config('request.jwt.claim.sub','94000000-0000-4000-8000-000000000001',true);
select is((select partial_fee_percent from public.list_my_lesson_bookings() where booking_id=current_setting('test.policy_booking')::uuid),
  25, 'member list exposes the reduced fee as a percentage');
select is((select late_fee_percent from public.list_my_lesson_bookings() where booking_id=current_setting('test.policy_booking')::uuid),
  80, 'member list exposes the late fee as a percentage');
reset role;

-- Inside the reduced window the booked late share applies, not a literal 100%.
update public.bookings set starts_at=now()+interval '2 hours', ends_at=now()+interval '2 hours 30 minutes'
where id=current_setting('test.policy_booking')::uuid;
set local role authenticated;
select set_config('request.jwt.claim.sub','94000000-0000-4000-8000-000000000001',true);
select public.cancel_lesson_booking_v2(current_setting('test.policy_booking')::uuid);
reset role;
select is((select amount_cents from public.charges where booking_id=current_setting('test.policy_booking')::uuid and type='lesson'),
  24000::bigint, 'late cancellation charges the booked 80 percent share');

select throws_ok($$update public.lesson_booking_settings set cancellation_partial_window_hours=60 where singleton$$,
  '23514', null, 'reduced window cannot extend past the free window');
select * from finish();
rollback;
