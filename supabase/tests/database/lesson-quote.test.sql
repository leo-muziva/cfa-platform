begin;
select plan(4);

-- BUG-01: the quote shown in the booking panel uses the same price the
-- booking charges (lesson_products standard_30), per fencer. Rolled back.
set local role authenticated;
select set_config('request.jwt.claim.sub','44444444-4444-4444-8444-444444444444',true);
select is((select total_cents from public.get_lesson_quote_v3(array['44444444-4444-4444-8444-444444444444']::uuid[])),
  '30000','one fencer is quoted R300');
select is((select total_cents from public.get_lesson_quote_v3(array['44444444-4444-4444-8444-444444444444','33333333-3333-4333-8333-333333333333']::uuid[])),
  '60000','two fencers are quoted R600, one charge each');
reset role;

-- The settings price no longer drives charges, so it must not drive the quote either.
update public.lesson_booking_settings set single_lesson_price_cents=99900 where singleton;
update public.lesson_products set customer_price_cents=35000,coach_allocation_cents=30000,club_allocation_cents=5000 where code='standard_30';
set local role authenticated;
select set_config('request.jwt.claim.sub','44444444-4444-4444-8444-444444444444',true);
select is((select total_cents from public.get_lesson_quote_v3(array['44444444-4444-4444-8444-444444444444']::uuid[])),
  '35000','the quote follows the lesson product price');
select is((select total_cents from public.get_lesson_quote_v3(array['44444444-4444-4444-8444-444444444444','33333333-3333-4333-8333-333333333333']::uuid[])),
  '70000','and doubles it for a shared lesson');
reset role;

select * from finish();
rollback;
