begin;
select no_plan();

-- Uses only synthetic seed actors and rolls everything back.
-- 4444 is the guardian payer of booking e1, 3333 the dependent, 5555 an
-- unrelated member, 2222 a coach and 1111 an admin.
update public.bookings set payment_option='pay_now',payment_state='held',status='scheduled',hold_expires_at=now()+interval '30 minutes'
where id='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1';
update public.charges set amount_cents=30000,status='unpaid',lifecycle_state='provisional',voided_at=null
where id='ffffffff-ffff-4fff-8fff-fffffffffff1';

-- Payable holds: payer only.
set local role anon;
select throws_ok($$select * from public.list_my_payable_lesson_holds()$$,'42501',null,'anonymous cannot list payable holds');
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','44444444-4444-4444-8444-444444444444',true);
select is((select count(*)::integer from public.list_my_payable_lesson_holds() where booking_id='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1'),1,'payer sees the live hold');
select is((select amount_cents from public.list_my_payable_lesson_holds() where booking_id='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1'),'30000','payer sees the amount due');
select set_config('request.jwt.claim.sub','33333333-3333-4333-8333-333333333333',true);
select is((select count(*)::integer from public.list_my_payable_lesson_holds()),0,'dependent sees no payable holds or amounts');
select set_config('request.jwt.claim.sub','55555555-5555-4555-8555-555555555555',true);
select is((select count(*)::integer from public.list_my_payable_lesson_holds() where booking_id='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1'),0,'another payer cannot see the hold');
select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);
select is((select count(*)::integer from public.list_my_payable_lesson_holds() where booking_id='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1'),0,'coach cannot see the hold amount');

-- Member lesson list shows the hold without money.
select set_config('request.jwt.claim.sub','33333333-3333-4333-8333-333333333333',true);
select is((select awaiting_payment from public.list_my_lesson_bookings() where booking_id='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1'),true,'dependent sees the lesson awaiting payment');
select is((select status from public.list_my_lesson_bookings() where booking_id='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1'),'scheduled','live hold stays scheduled');
select set_config('request.jwt.claim.sub','55555555-5555-4555-8555-555555555555',true);
select is((select count(*)::integer from public.list_my_lesson_bookings() where booking_id='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1'),0,'another member cannot see the lesson');
reset role;

-- A lapsed hold reads as released before the expiry job runs.
update public.bookings set hold_expires_at=now()-interval '1 minute' where id='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1';
set local role authenticated;
select set_config('request.jwt.claim.sub','44444444-4444-4444-8444-444444444444',true);
select is((select status from public.list_my_lesson_bookings() where booking_id='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1'),'cancelled','lapsed hold reads as cancelled');
select is((select awaiting_payment from public.list_my_lesson_bookings() where booking_id='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1'),false,'lapsed hold is not awaiting payment');
select is((select cancellation_reason from public.list_my_lesson_bookings() where booking_id='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1'),'Payment hold expired','lapsed hold explains why');
select is((select count(*)::integer from public.list_my_payable_lesson_holds() where booking_id='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1'),0,'lapsed hold cannot be paid');
select throws_ok($$select public.expire_lesson_holds()$$,'42501',null,'members cannot run hold expiry');
reset role;
set local role service_role;
select ok(public.expire_lesson_holds()>=1,'service role expires lapsed holds');
reset role;
select is((select payment_state from public.bookings where id='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1'),'expired','expiry job releases the slot');

-- Invoicing: all active staff, never members; scheduled run is service role only.
insert into public.charges(id,fencer_id,payer_id,type,amount_cents,amount,status,period,description,lifecycle_state)
values('cc330000-0000-4000-8000-000000000001','44444444-4444-4444-8444-444444444444','44444444-4444-4444-8444-444444444444','joining_fee',10000,100,'unpaid','2093-05-01','Synthetic joining fee','finalized');
set local role authenticated;
select set_config('request.jwt.claim.sub','44444444-4444-4444-8444-444444444444',true);
select throws_ok($$select public.run_monthly_invoices('2093-05-01')$$,'P0001','forbidden','members cannot run invoicing');
select throws_ok($$select public.generate_monthly_invoices('2093-05-01')$$,'42501',null,'members cannot call the internal invoicing routine');
select throws_ok($$select public.run_scheduled_invoices()$$,'42501',null,'members cannot run the scheduled invoicing job');
select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);
select lives_ok($$select public.run_monthly_invoices('2093-05-01')$$,'any active staff member can run invoicing');
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
select lives_ok($$select public.run_monthly_invoices('2093-05-01')$$,'rerun for the same period succeeds');
reset role;
select is((select count(*)::integer from public.invoice_lines where charge_id='cc330000-0000-4000-8000-000000000001'),1,'rerun does not duplicate invoice lines');
select is((select count(*)::integer from public.invoices where payer_id='44444444-4444-4444-8444-444444444444' and period='2093-05-01'),1,'one invoice per payer and period');
set local role service_role;
select lives_ok($$select public.run_scheduled_invoices()$$,'service role runs scheduled invoicing');
reset role;

select * from finish();
rollback;
