begin;
select no_plan();

-- Uses only synthetic seed actors and rolls all ledger changes back.
update public.bookings set payment_option='pay_now',payment_state='held',status='scheduled',hold_expires_at=now()+interval '30 minutes'
where id='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1';
update public.charges set amount_cents=30000,status='unpaid',lifecycle_state='provisional',voided_at=null
where id='ffffffff-ffff-4fff-8fff-fffffffffff1';
set local role anon;
select throws_ok($$select public.prepare_payment_checkout('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1')$$,
  '42501',null,'anonymous cannot prepare checkout');
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','33333333-3333-4333-8333-333333333333',true);
select throws_ok($$select public.prepare_payment_checkout('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1')$$,
  'P0001','forbidden','dependent cannot prepare checkout');
select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);
select throws_ok($$select public.prepare_payment_checkout('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1')$$,
  'P0001','forbidden','coach cannot checkout another payer booking');
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
select throws_ok($$select public.prepare_payment_checkout('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1')$$,
  'P0001','forbidden','admin cannot checkout another payer booking');
select set_config('request.jwt.claim.sub','44444444-4444-4444-8444-444444444444',true);
select lives_ok($$select public.prepare_payment_checkout('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1')$$,'guardian prepares own dependent payment');
select lives_ok($$select public.prepare_payment_checkout('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1')$$,'repeat prepare is idempotent');
select throws_ok($$select public.record_payment_event('payfast_sandbox','x','x','x','succeeded',30000,'ZAR')$$,
  '42501',null,'payer cannot impersonate a verified webhook');
select throws_ok($$insert into public.payment_attempts(payer_id,amount) values(auth.uid(),1)$$,
  '42501',null,'direct attempts cannot bypass RPC');
reset role;
select is((select count(*)::integer from public.payment_attempts where booking_id='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1'),1,'one pending attempt');
select set_config('test.payment_reference',(select provider_reference from public.payment_attempts where booking_id='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1'),true);
select set_config('test.payment_attempt',(select id::text from public.payment_attempts where booking_id='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1'),true);
set local role service_role;
select throws_ok($$select public.record_payment_event('payfast_sandbox','bad-amount','payment-1',current_setting('test.payment_reference'),'succeeded',1,'ZAR')$$,
  'P0001','payment_mismatch','amount mismatch rejected');
select throws_ok($$select public.record_payment_event('payfast_sandbox','bad-currency','payment-1',current_setting('test.payment_reference'),'succeeded',30000,'USD')$$,
  'P0001','payment_mismatch','currency mismatch rejected');
select throws_ok($$select public.record_payment_event('peach_sandbox','wrong-provider','payment-1',current_setting('test.payment_reference'),'succeeded',30000,'ZAR')$$,
  'P0001','payment_attempt_not_found','provider is pinned');
select is(public.record_payment_event('payfast_sandbox','failed-1','payment-1',current_setting('test.payment_reference'),'failed',30000,'ZAR'),true,'failure recorded');
select is(public.record_payment_event('payfast_sandbox','success-1','payment-1',current_setting('test.payment_reference'),'succeeded',30000,'ZAR'),true,'success after failure settles');
select is(public.record_payment_event('payfast_sandbox','success-1','payment-1',current_setting('test.payment_reference'),'succeeded',30000,'ZAR'),false,'duplicate event ignored');
select is(public.record_payment_event('payfast_sandbox','success-2','payment-1',current_setting('test.payment_reference'),'succeeded',30000,'ZAR'),false,'new event same payment does not duplicate');
select is(public.record_payment_event('payfast_sandbox','late-failure','payment-1',current_setting('test.payment_reference'),'failed',30000,'ZAR'),false,'success cannot roll back');
reset role;
select is((select payment_state from public.bookings where id='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1'),'paid','booking finalized');
select is((select sum(amount_cents)::bigint from public.payment_allocations where payment_attempt_id=current_setting('test.payment_attempt')::uuid),30000::bigint,'exact amount allocated');
select is((select count(*)::integer from public.receipts where payment_attempt_id=current_setting('test.payment_attempt')::uuid),1,'single receipt');

-- A second held lesson expires before the verified success arrives.
update public.bookings set payment_option='pay_now',payment_state='held',status='scheduled',hold_expires_at=now()+interval '30 minutes'
where id='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee2';
update public.charges set amount_cents=30000,status='unpaid',lifecycle_state='provisional'
where booking_id='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee2';
set local role authenticated;
select lives_ok($$select public.prepare_payment_checkout('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee2')$$,'double booking payment prepares');
reset role;
select set_config('test.late_reference',(select provider_reference from public.payment_attempts where booking_id='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee2'),true);
update public.bookings set hold_expires_at=now()-interval '1 second' where id='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee2';
set local role service_role;
select is(public.record_payment_event('payfast_sandbox','late-success','late-payment',current_setting('test.late_reference'),'succeeded',60000,'ZAR'),true,'late success acknowledged');
reset role;
select is((select payment_state from public.bookings where id='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee2'),'expired','late success does not resurrect booking');
select is((select amount_cents from public.ledger_credits where booking_id='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee2'),60000::bigint,'late payment credited fully');

insert into public.charges(id,fencer_id,payer_id,type,amount_cents,status,period,description,lifecycle_state)
values('cc250000-0000-4000-8000-000000000001','44444444-4444-4444-8444-444444444444','44444444-4444-4444-8444-444444444444','membership',55000,'unpaid','2090-01-01','Synthetic invoice charge','finalized');
insert into public.invoices(id,payer_id,period,total) values('aa250000-0000-4000-8000-000000000001','44444444-4444-4444-8444-444444444444','2090-01-01',550);
insert into public.invoice_lines(invoice_id,charge_id,participant_id,description,amount) values('aa250000-0000-4000-8000-000000000001','cc250000-0000-4000-8000-000000000001','44444444-4444-4444-8444-444444444444','Synthetic invoice charge',550);
set local role authenticated;
select lives_ok($$select public.prepare_payment_checkout(null,'aa250000-0000-4000-8000-000000000001')$$,'invoice checkout prepares');
select lives_ok($$select public.prepare_payment_checkout(null,'aa250000-0000-4000-8000-000000000001','peach_sandbox')$$,'second provider may have an outstanding attempt');
reset role;
select set_config('test.invoice_reference',(select provider_reference from public.payment_attempts where invoice_id='aa250000-0000-4000-8000-000000000001' and provider='payfast_sandbox'),true);
select set_config('test.second_reference',(select provider_reference from public.payment_attempts where invoice_id='aa250000-0000-4000-8000-000000000001' and provider='peach_sandbox'),true);
set local role service_role;
select is(public.record_payment_event('payfast_sandbox','invoice-success','invoice-payment',current_setting('test.invoice_reference'),'succeeded',55000,'ZAR'),true,'invoice success allocates');
select is(public.record_payment_event('peach_sandbox','invoice-second','invoice-second-payment',current_setting('test.second_reference'),'succeeded',55000,'ZAR'),true,'overlapping success is retained as credit');
reset role;
select is((select status from public.invoices where id='aa250000-0000-4000-8000-000000000001'),'paid','invoice paid');
select is((select total from public.invoices where id='aa250000-0000-4000-8000-000000000001'),550::numeric,'issued total immutable');
select is((select sum(amount_cents)::bigint from public.payment_allocations where charge_id='cc250000-0000-4000-8000-000000000001'),55000::bigint,'no over allocation');
select is((select amount_cents from public.ledger_credits where payment_attempt_id=(select id from public.payment_attempts where provider_reference=current_setting('test.second_reference'))),55000::bigint,'second payment credited');
set local role authenticated;
select set_config('request.jwt.claim.sub','33333333-3333-4333-8333-333333333333',true);
select throws_ok($$select public.get_invoice_payment_balances()$$,'P0001','forbidden','dependent cannot read financial balances');
select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);
select is((select count(*)::integer from public.get_payment_status(current_setting('test.payment_attempt')::uuid)),0,'coach cannot read another payer attempt');
select throws_ok($$select public.prepare_peach_sandbox_checkout('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1')$$,'42501',null,'legacy preparation bypass disabled');
reset role;
-- Staff participation uses the same payer identity, not a special payment privilege.
update public.profiles set is_staff=true,staff_type='coach' where id='44444444-4444-4444-8444-444444444444';
set local role authenticated;
select set_config('request.jwt.claim.sub','44444444-4444-4444-8444-444444444444',true);
select lives_ok($$select public.get_invoice_payment_balances()$$,'staff acting as guardian retains own financial access');
reset role;
-- Fixture edits run as the seed admin; the profile guard checks the JWT subject.
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
update public.profiles set is_staff=false,staff_type=null,date_of_birth=current_date-interval '12 years'
where id='44444444-4444-4444-8444-444444444444';
set local role authenticated;
select set_config('request.jwt.claim.sub','44444444-4444-4444-8444-444444444444',true);
select throws_ok($$select public.get_invoice_payment_balances()$$,'P0001','forbidden','minor without guardian link still cannot access payments');
reset role;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
update public.profiles set date_of_birth=null where id='44444444-4444-4444-8444-444444444444';
select set_config('request.jwt.claim.sub','44444444-4444-4444-8444-444444444444',true);

insert into public.charges(id,fencer_id,payer_id,type,amount_cents,status,period,description,lifecycle_state)
values('cc250000-0000-4000-8000-000000000002','44444444-4444-4444-8444-444444444444','44444444-4444-4444-8444-444444444444','membership',55000,'unpaid','2090-02-01','Manual overlap','finalized');
insert into public.invoices(id,payer_id,period,total) values('aa250000-0000-4000-8000-000000000002','44444444-4444-4444-8444-444444444444','2090-02-01',550);
insert into public.invoice_lines(invoice_id,charge_id,participant_id,description,amount) values('aa250000-0000-4000-8000-000000000002','cc250000-0000-4000-8000-000000000002','44444444-4444-4444-8444-444444444444','Manual overlap',550);
set local role authenticated;
select lives_ok($$select public.prepare_payment_checkout(null,'aa250000-0000-4000-8000-000000000002')$$,'online attempt precedes manual payment');
select throws_ok($$select public.record_manual_invoice_payment('aa250000-0000-4000-8000-000000000002')$$,'P0001','forbidden','payer cannot record manual settlement');
select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);
select is(public.record_manual_invoice_payment('aa250000-0000-4000-8000-000000000002'),true,'staff records manual payment atomically');
select is(public.record_manual_invoice_payment('aa250000-0000-4000-8000-000000000002'),false,'manual payment duplicate ignored');
reset role;
select set_config('test.manual_reference',(select provider_reference from public.payment_attempts where invoice_id='aa250000-0000-4000-8000-000000000002' and provider='payfast_sandbox'),true);
set local role service_role;
select is(public.record_payment_event('payfast_sandbox','manual-overlap','manual-overlap-payment',current_setting('test.manual_reference'),'succeeded',55000,'ZAR'),true,'online success after manual payment is accepted');
reset role;
select is((select sum(amount_cents)::bigint from public.payment_allocations where charge_id='cc250000-0000-4000-8000-000000000002'),55000::bigint,'manual overlap cannot allocate twice');
select is((select amount_cents from public.ledger_credits where payment_attempt_id=(select id from public.payment_attempts where provider_reference=current_setting('test.manual_reference'))),55000::bigint,'manual overlap becomes payer credit');
select * from finish();
rollback;
