begin;

select plan(23);

select has_table('public','lesson_booking_settings','lesson settings table exists');
select has_table('public','coach_availability_rules','weekly availability exists');
select has_table('public','coach_availability_exceptions','availability exceptions exist');
select has_table('public','club_closures','club closures exist');
select has_table('public','booking_participants','booking participants exist');
select has_table('public','lesson_notifications','lesson notifications exist');
select has_table('public','ledger_credits','settled waiver credits exist');

select is((select count(*)::integer from public.lesson_booking_settings),1,'settings are a singleton');
select is((select single_lesson_price_cents from public.lesson_booking_settings where singleton),30000,'single price is R300');
select is((select payment_mode from public.lesson_booking_settings where singleton),'invoice_only','payment mode is invoice only');
select is((select lesson_duration_minutes from public.lesson_booking_settings where singleton),30,'duration is 30 minutes');

select has_function('public','list_available_lesson_times',array['uuid','text','date','date'],'availability RPC exists');
select has_function('public','create_lesson_booking_v2',array['uuid','timestamp with time zone','uuid[]','text'],'atomic booking RPC exists');
select has_function('public','reschedule_lesson_booking_v2',array['uuid','timestamp with time zone'],'atomic reschedule RPC exists');
select has_function('public','admin_waive_booking_charges',array['uuid','text'],'waiver RPC exists');

select ok(not public.lesson_time_is_available(
  '22222222-2222-4222-8222-222222222222',
  (date_trunc('day',now() at time zone 'Africa/Johannesburg')+interval '4 days 16 hours 7 minutes') at time zone 'Africa/Johannesburg',
  'foil',null
),'crafted off-grid starts are rejected');

select is((select count(*)::integer from public.booking_participants
  where booking_id='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee2'),2,'demo double lesson has two participants');
select is((select sum(amount) from public.charges
  where booking_id='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee2'),600::numeric,'double lesson has two R300 charges');

set local role authenticated;
select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);
select is((select count(*)::integer from public.charges),0,'coach cannot read charges even when a payer');
select is((select count(*)::integer from public.bookings),0,'coach cannot read full booking rows with payment_option');
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub','33333333-3333-4333-8333-333333333333',true);
select is((select count(*)::integer from public.charges),0,'effective dependent cannot read any financial rows');
select is((select count(*)::integer from public.bookings),0,'effective dependent cannot read raw booking payment fields');
select throws_ok(
  $$select * from public.get_lesson_quote(array['33333333-3333-4333-8333-333333333333']::uuid[])$$,
  'P0001','forbidden','effective dependent cannot retrieve a monetary quote');
reset role;

select * from finish();
rollback;
