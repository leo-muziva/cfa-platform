begin;
select plan(9);

-- The fixture booking is owned by the dependent account used throughout the
-- lesson workflow tests. Each assertion resets it so the fee bands are tested
-- at their inclusive boundary rather than via UI timing.
update public.bookings set status='scheduled', payment_state='unpaid', starts_at=now()+interval '12 hours', ends_at=now()+interval '12 hours 30 minutes',
  booked_unit_price_cents=30000, booked_cancellation_window_hours=12, booked_partial_cancellation_window_hours=6,
  booked_partial_fee_multiplier=.5, booked_late_fee_multiplier=1
where id='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1';
update public.charges set lifecycle_state='provisional', amount_cents=30000, amount=300, voided_at=null where id='ffffffff-ffff-4fff-8fff-fffffffffff1';
set local role authenticated;
select set_config('request.jwt.claim.sub','33333333-3333-4333-8333-333333333333',true);
select lives_ok($$select public.cancel_lesson_booking_v2('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1')$$,'exactly twelve hours is free');
reset role;
select is((select lifecycle_state from public.charges where id='ffffffff-ffff-4fff-8fff-fffffffffff1'),'voided','free boundary voids provisional charge');

update public.bookings set status='scheduled', starts_at=now()+interval '6 hours', ends_at=now()+interval '6 hours 30 minutes' where id='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1';
update public.charges set lifecycle_state='provisional', amount_cents=30000, amount=300, voided_at=null where id='ffffffff-ffff-4fff-8fff-fffffffffff1';
set local role authenticated;
select set_config('request.jwt.claim.sub','33333333-3333-4333-8333-333333333333',true);
select lives_ok($$select public.cancel_lesson_booking_v2('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1')$$,'exactly six hours is allowed');
reset role;
select is((select amount_cents from public.charges where id='ffffffff-ffff-4fff-8fff-fffffffffff1'),15000::bigint,'exactly six hours retains 50 percent due');

update public.bookings set status='scheduled', starts_at=now()+interval '5 hours 59 minutes', ends_at=now()+interval '6 hours 29 minutes' where id='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1';
update public.charges set lifecycle_state='provisional', amount_cents=30000, amount=300, voided_at=null where id='ffffffff-ffff-4fff-8fff-fffffffffff1';
set local role authenticated;
select set_config('request.jwt.claim.sub','33333333-3333-4333-8333-333333333333',true);
select lives_ok($$select public.cancel_lesson_booking_v2('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1')$$,'inside six hours is still cancellable');
reset role;
select is((select amount_cents from public.charges where id='ffffffff-ffff-4fff-8fff-fffffffffff1'),30000::bigint,'inside six hours retains the full booked fee');

select ok(not public.lesson_time_is_available('22222222-2222-4222-8222-222222222222',now()+interval '11 hours 59 minutes','foil',null),'minimum lead time is enforced at the database boundary');
select is((select booking_horizon_calendar_months from public.lesson_booking_settings where singleton),3,'three calendar-month horizon is authoritative');
select is((select customer_price_cents from public.lesson_products where code='intro'),15000::bigint,'intro product price is authoritative');
select * from finish();
rollback;
