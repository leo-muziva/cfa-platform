begin;
select plan(17);

-- RLS must be on for every ledger/lesson-policy table exposed through PostgREST.
select ok((select relrowsecurity from pg_class where oid='public.credit_consumptions'::regclass),'credit_consumptions has RLS');
select ok((select relrowsecurity from pg_class where oid='public.invoice_adjustments'::regclass),'invoice_adjustments has RLS');
select ok((select relrowsecurity from pg_class where oid='public.lesson_products'::regclass),'lesson_products has RLS');
select ok((select relrowsecurity from pg_class where oid='public.lesson_entitlements'::regclass),'lesson_entitlements has RLS');

-- Owner-written fixture so the read checks are not trivially empty.
insert into public.invoice_adjustments(charge_id,amount_cents,reason)
values('ffffffff-ffff-4fff-8fff-fffffffffff1',100,'RLS fixture') on conflict(charge_id) do nothing;

set local role anon;
select is((select count(*)::integer from public.invoice_adjustments),0,'anon cannot read invoice adjustments');
select is((select count(*)::integer from public.lesson_products),0,'anon cannot read lesson products');
select throws_ok($$insert into public.lesson_entitlements(profile_id,product_code,remaining_uses,source)
  values('33333333-3333-4333-8333-333333333333','intro',9,'staff')$$,'42501',null,'anon cannot grant entitlements');
reset role;

-- An ordinary member cannot see or forge ledger rows or entitlement balances.
set local role authenticated;
select set_config('request.jwt.claim.sub','33333333-3333-4333-8333-333333333333',true);
select is((select count(*)::integer from public.invoice_adjustments),0,'member cannot read invoice adjustments');
select is((select count(*)::integer from public.credit_consumptions),0,'member cannot read credit consumptions');
select is((select count(*)::integer from public.lesson_entitlements),0,'member cannot read entitlements');
select ok((select count(*) from public.lesson_products)>0,'member can read active lesson products');
select throws_ok($$insert into public.invoice_adjustments(charge_id,amount_cents,reason)
  values('ffffffff-ffff-4fff-8fff-fffffffffff1',1,'forged')$$,'42501',null,'member cannot write invoice adjustments');
select throws_ok($$update public.lesson_entitlements set remaining_uses=99$$,'42501',null,'member cannot top up entitlements');
select throws_ok($$update public.lesson_products set customer_price_cents=0$$,'42501',null,'member cannot change lesson prices');
reset role;

-- Admin financial staff keep read access.
set local role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
select ok((select count(*) from public.invoice_adjustments)>0,'admin can read invoice adjustments');
select ok((select count(*) from public.lesson_entitlements)>0,'admin can read entitlements');
reset role;

-- Security-definer lesson RPCs are unaffected by RLS on their tables.
update public.bookings set status='scheduled',payment_state='unpaid',starts_at=now()+interval '2 days',ends_at=now()+interval '2 days 30 minutes'
where id='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1';
set local role authenticated;
select set_config('request.jwt.claim.sub','33333333-3333-4333-8333-333333333333',true);
select lives_ok($$select public.cancel_lesson_booking_v2('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1')$$,'member cancellation RPC still works');
reset role;

select * from finish();
rollback;
