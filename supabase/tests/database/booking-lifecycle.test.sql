begin;
select plan(19);

-- Each scenario uses synthetic seed identities and is rolled back.
update public.bookings set starts_at=now()+interval '24 hours',ends_at=now()+interval '24 hours 30 minutes',
  booked_cancellation_window_hours=24
where id='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1';
update public.lesson_booking_settings set cancellation_window_hours=48 where singleton;
set local role authenticated;
select set_config('request.jwt.claim.sub','33333333-3333-4333-8333-333333333333',true);
select lives_ok($$select public.cancel_lesson_booking_v2('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1')$$,
  'dependent can cancel their lesson at the exact booked boundary');
reset role;
select is((select lifecycle_state from public.charges where id='ffffffff-ffff-4fff-8fff-fffffffffff1'),'voided',
  'exact boundary is free despite changed settings');

update public.bookings set starts_at=now()-interval '2 hours',ends_at=now()-interval '90 minutes',
  booked_no_show_multiplier=2 where id='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee2';
set local role authenticated;
select set_config('request.jwt.claim.sub','44444444-4444-4444-8444-444444444444',true);
select throws_ok($$select public.record_lesson_participant_outcome('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee2',
  '44444444-4444-4444-8444-444444444444','attended')$$,'P0001','forbidden','payer cannot record attendance');
select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);
select lives_ok($$select public.record_lesson_participant_outcome('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee2',
  '44444444-4444-4444-8444-444444444444','attended')$$,'coach records first participant');
select lives_ok($$select public.record_lesson_participant_outcome('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee2',
  '33333333-3333-4333-8333-333333333333','no_show')$$,'coach records independent second outcome');
select lives_ok($$select public.record_lesson_participant_outcome('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee2',
  '33333333-3333-4333-8333-333333333333','no_show')$$,'duplicate outcome is idempotent');
select throws_ok($$select public.record_lesson_participant_outcome('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee2',
  '33333333-3333-4333-8333-333333333333','attended')$$,'P0001','outcome_not_allowed','recorded outcome cannot be overwritten');
reset role;
select is((select amount_cents from public.charges where id='ffffffff-ffff-4fff-8fff-fffffffffff2'),30000::bigint,'attendee retains booked price');
select is((select amount_cents from public.charges where id='ffffffff-ffff-4fff-8fff-fffffffffff3'),60000::bigint,'only no-show receives booked multiplier once');

update public.bookings set status='scheduled',payment_state='held',hold_expires_at=now()-interval '1 second'
where id='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1';
update public.charges set lifecycle_state='provisional',voided_at=null where id='ffffffff-ffff-4fff-8fff-fffffffffff1';
select is(public.expire_lesson_holds(),1,'expired hold releases one booking');
select is(public.expire_lesson_holds(),0,'hold expiration rerun is idempotent');
select is((select status from public.bookings where id='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1'),'cancelled','expired booking is cancelled');
select is((select lifecycle_state from public.charges where id='ffffffff-ffff-4fff-8fff-fffffffffff1'),'voided','expired unpaid charge is voided');
insert into public.payment_attempts(id,payer_id,provider,booking_id,amount_cents,idempotency_key)
values('abcd0000-0000-4000-8000-000000000001','44444444-4444-4444-8444-444444444444','mock',
  'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1',30000,'booking-test-late-payment');
select lives_ok($$select public.settle_payment_attempt('abcd0000-0000-4000-8000-000000000001','late-test')$$,'late payment settles safely');
select is((select count(*)::integer from public.payment_allocations where payment_attempt_id='abcd0000-0000-4000-8000-000000000001'),0,'late payment cannot allocate released booking');
select is((select amount_cents from public.ledger_credits where payment_attempt_id='abcd0000-0000-4000-8000-000000000001'),30000::bigint,'late payment becomes account credit');
select is((select status from public.bookings where id='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1'),'cancelled','late payment never resurrects slot');
insert into public.payment_attempts(id,payer_id,provider,amount_cents,idempotency_key,status)
values('abcd0000-0000-4000-8000-000000000002','44444444-4444-4444-8444-444444444444','mock',30000,'booking-test-paid-cancellation','succeeded');
insert into public.payment_allocations(payment_attempt_id,charge_id,amount_cents)
values('abcd0000-0000-4000-8000-000000000002','ffffffff-ffff-4fff-8fff-fffffffffff2',30000);
select public.apply_lesson_charge_policy('ffffffff-ffff-4fff-8fff-fffffffffff2',0,'Free cancellation');
select is((select amount_cents from public.ledger_credits where charge_id='ffffffff-ffff-4fff-8fff-fffffffffff2'),30000::bigint,'paid free cancellation restores account credit');
select is((select amount_cents from public.charges where id='ffffffff-ffff-4fff-8fff-fffffffffff2'),30000::bigint,'settled original price remains intact');
select * from finish();
rollback;
