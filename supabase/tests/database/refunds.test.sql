begin;
select no_plan();

-- Refund lifecycle (0031): request, decide, process manually or through the
-- provider, and bulk-order cancellation. Payments are made through the real
-- checkout and settlement routines so every attempt is genuine.
-- Synthetic seed actors plus one synthetic payer; everything rolls back.
--   11111111 admin staff      22222222 coach staff
--   33333333 dependent billed to 44444444 (not a payer)
--   44444444 guardian payer   77777777 synthetic second payer (created below)

-- ============================================================
-- Fixtures as the migration owner, before any role switch
-- ============================================================
select is((select count(*)::integer from public.refund_requests), 0, 'no refund requests before the test');

-- A second, unrelated adult payer. The profile trigger creates the profile
-- and a household of one.
insert into auth.users(id,instance_id,aud,role,email,email_confirmed_at,raw_app_meta_data,raw_user_meta_data)
values('77777777-7777-4777-8777-777777777777','00000000-0000-0000-0000-000000000000','authenticated','authenticated',
  'refund.other.payer@cfa.test',now(),'{}','{"full_name":"Olive Other"}');

insert into public.products(item_code,name,price,category,is_active) values
  ('TEST0031-A','Synthetic refund jacket',200.00,'Clothing',true),
  ('TEST0031-D','Synthetic refund glove',150.00,'Accessories',true),
  ('TEST0031-C','Synthetic refund bag',100.00,'Accessories',true);
insert into public.orders(id,user_id,status) values
  ('31310000-0000-4000-8000-00000000000a','44444444-4444-4444-8444-444444444444','draft'),
  ('31310000-0000-4000-8000-00000000000c','77777777-7777-4777-8777-777777777777','draft');
insert into public.order_items(order_id,product_id,quantity,unit_price) values
  ('31310000-0000-4000-8000-00000000000a',(select id from public.products where item_code='TEST0031-A'),1,200.00),
  ('31310000-0000-4000-8000-00000000000c',(select id from public.products where item_code='TEST0031-C'),1,100.00);

-- An unpaid invoice for the guardian, later settled manually by staff.
insert into public.charges(id,fencer_id,payer_id,type,amount_cents,status,period,description,lifecycle_state)
values('31310000-0000-4000-8000-0000000000c1','44444444-4444-4444-8444-444444444444','44444444-4444-4444-8444-444444444444',
  'membership',55000,'unpaid','2092-01-01','Synthetic refund invoice charge','finalized');
insert into public.invoices(id,payer_id,period,total)
values('31310000-0000-4000-8000-0000000000f1','44444444-4444-4444-8444-444444444444','2092-01-01',550);
insert into public.invoice_lines(invoice_id,charge_id,participant_id,description,amount)
values('31310000-0000-4000-8000-0000000000f1','31310000-0000-4000-8000-0000000000c1',
  '44444444-4444-4444-8444-444444444444','Synthetic refund invoice charge',550);

-- ============================================================
-- Genuine payments
-- ============================================================
-- Order A (guardian, R200) through PayFast.
set local role authenticated;
select set_config('request.jwt.claim.sub','44444444-4444-4444-8444-444444444444',true);
select is((select amount_cents from public.prepare_order_checkout('31310000-0000-4000-8000-00000000000a')),
  '20000','order A checkout prepares');
reset role;
select set_config('test.a_attempt',(select id::text from public.payment_attempts
  where order_id='31310000-0000-4000-8000-00000000000a'),true);
select set_config('test.a_reference',(select provider_reference from public.payment_attempts
  where order_id='31310000-0000-4000-8000-00000000000a'),true);
set local role service_role;
select is(public.record_payment_event('payfast_sandbox','rfd-evt-a','rfd-pay-a',
  current_setting('test.a_reference'),'succeeded',20000,'ZAR'),true,'order A paid through PayFast');
reset role;

-- Order D (guardian, R150) through PayFast, used for the provider refund path.
insert into public.orders(id,user_id,status) values
  ('31310000-0000-4000-8000-00000000000d','44444444-4444-4444-8444-444444444444','draft');
insert into public.order_items(order_id,product_id,quantity,unit_price) values
  ('31310000-0000-4000-8000-00000000000d',(select id from public.products where item_code='TEST0031-D'),1,150.00);
set local role authenticated;
select is((select amount_cents from public.prepare_order_checkout('31310000-0000-4000-8000-00000000000d')),
  '15000','order D checkout prepares');
reset role;
select set_config('test.d_attempt',(select id::text from public.payment_attempts
  where order_id='31310000-0000-4000-8000-00000000000d'),true);
select set_config('test.d_reference',(select provider_reference from public.payment_attempts
  where order_id='31310000-0000-4000-8000-00000000000d'),true);
set local role service_role;
select is(public.record_payment_event('payfast_sandbox','rfd-evt-d','rfd-pay-d',
  current_setting('test.d_reference'),'succeeded',15000,'ZAR'),true,'order D paid through PayFast');
reset role;

-- Order C (other payer, R100) through PayFast.
set local role authenticated;
select set_config('request.jwt.claim.sub','77777777-7777-4777-8777-777777777777',true);
select is((select amount_cents from public.prepare_order_checkout('31310000-0000-4000-8000-00000000000c')),
  '10000','order C checkout prepares for the other payer');
reset role;
select set_config('test.c_attempt',(select id::text from public.payment_attempts
  where order_id='31310000-0000-4000-8000-00000000000c'),true);
select set_config('test.c_reference',(select provider_reference from public.payment_attempts
  where order_id='31310000-0000-4000-8000-00000000000c'),true);
set local role service_role;
select is(public.record_payment_event('payfast_sandbox','rfd-evt-c','rfd-pay-c',
  current_setting('test.c_reference'),'succeeded',10000,'ZAR'),true,'order C paid through PayFast');
reset role;

-- Invoice M (guardian, R550) recorded manually by staff.
set local role authenticated;
select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);
select is(public.record_manual_invoice_payment('31310000-0000-4000-8000-0000000000f1'),true,
  'staff records the manual invoice payment');
reset role;
select set_config('test.m_attempt',(select id::text from public.payment_attempts
  where invoice_id='31310000-0000-4000-8000-0000000000f1' and provider='manual'),true);

select is((select string_agg(o.status||':'||(o.bulk_order_id=b.id)::text, ',' order by o.id) from public.orders o
  cross join public.bulk_orders b where b.status='collecting'
    and o.id in ('31310000-0000-4000-8000-00000000000a','31310000-0000-4000-8000-00000000000c','31310000-0000-4000-8000-00000000000d')),
  'paid:true,paid:true,paid:true','all three paid orders sit in the collecting bulk order');
select is(public.payment_refundable_cents(current_setting('test.m_attempt')::uuid),55000::bigint,
  'manual payment is fully refundable');
select set_config('test.old_bulk',(select id::text from public.bulk_orders where status='collecting'),true);

-- ============================================================
-- Requesting a refund
-- ============================================================
set local role anon;
select throws_ok($$select public.request_refund(current_setting('test.m_attempt')::uuid,100,'anon')$$,
  '42501',null,'anonymous cannot request a refund');
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub','77777777-7777-4777-8777-777777777777',true);
select throws_ok($$select public.request_refund(current_setting('test.a_attempt')::uuid,100,'Not mine')$$,
  'P0001','forbidden','another payer cannot request a refund of someone else''s payment');
select set_config('request.jwt.claim.sub','33333333-3333-4333-8333-333333333333',true);
select throws_ok($$select public.request_refund(current_setting('test.a_attempt')::uuid,100,'Dependent')$$,
  'P0001','forbidden','dependent cannot request a refund');

select set_config('request.jwt.claim.sub','44444444-4444-4444-8444-444444444444',true);
select throws_ok($$select public.request_refund(current_setting('test.m_attempt')::uuid,0,'Zero')$$,
  'P0001','invalid_input','zero amount rejected');
select throws_ok($$select public.request_refund(current_setting('test.m_attempt')::uuid,100,'   ')$$,
  'P0001','invalid_input','blank reason rejected');
select isnt(set_config('test.r1',public.request_refund(current_setting('test.m_attempt')::uuid,5000,
  ' Membership cancelled early ')::text,true),null,'payer requests a partial refund');
select throws_ok($$select public.request_refund(current_setting('test.m_attempt')::uuid,60000,'Too much')$$,
  'P0001','amount_exceeds_refundable','amount over the refundable balance rejected');
select isnt(set_config('test.r2',public.request_refund(current_setting('test.m_attempt')::uuid,50000,
  'Rest of it')::text,true),null,'second request within the remaining balance accepted');
select throws_ok($$select public.request_refund(current_setting('test.m_attempt')::uuid,1,'One cent more')$$,
  'P0001','amount_exceeds_refundable','request beyond the remaining balance rejected');
reset role;

select is((select status||'/'||amount_cents::text||'/'||reason||'/'||payer_id::text||'/'||requested_by::text
  from public.refund_requests where id=current_setting('test.r1')::uuid),
  'requested/5000/Membership cancelled early/44444444-4444-4444-8444-444444444444/44444444-4444-4444-8444-444444444444',
  'request stored with trimmed reason, payer and requester');
select matches((select refund_number from public.refund_requests where id=current_setting('test.r1')::uuid),
  '^RFD-[0-9]{6,}$','refund number assigned');
select is(public.payment_refundable_cents(current_setting('test.m_attempt')::uuid),0::bigint,
  'open requests reserve the whole payment');

-- ============================================================
-- Deciding
-- ============================================================
set local role authenticated;
select throws_ok($$select public.decide_refund(current_setting('test.r1')::uuid,true,'manual_bank',null)$$,
  'P0001','forbidden','non-staff payer cannot decide a refund');
select set_config('request.jwt.claim.sub','33333333-3333-4333-8333-333333333333',true);
select throws_ok($$select public.decide_refund(current_setting('test.r1')::uuid,false,null,'no')$$,
  'P0001','forbidden','dependent cannot decide a refund');

select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);
select throws_ok($$select public.decide_refund(current_setting('test.r2')::uuid,false,null,'  ')$$,
  'P0001','note_required','rejection needs a note');
select is(public.decide_refund(current_setting('test.r2')::uuid,false,null,'Membership already used'),true,
  'staff rejects with a note');
select throws_ok($$select public.decide_refund(current_setting('test.r2')::uuid,true,'manual_bank',null)$$,
  'P0001','refund_already_decided','a decided refund cannot be decided again');
reset role;
select is((select status||'/'||decision_note||'/'||decided_by::text from public.refund_requests
  where id=current_setting('test.r2')::uuid),
  'rejected/Membership already used/22222222-2222-4222-8222-222222222222','rejection recorded with note and decider');
select is(public.payment_refundable_cents(current_setting('test.m_attempt')::uuid),50000::bigint,
  'rejected amount is released');

set local role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
select throws_ok($$select public.decide_refund(current_setting('test.r1')::uuid,true,'provider',null)$$,
  'P0001','provider_refund_unavailable','manual payment cannot be refunded through the provider');
select throws_ok($$select public.decide_refund(current_setting('test.r1')::uuid,true,'cheque',null)$$,
  'P0001','invalid_input','unknown refund method rejected');
select throws_ok($$select public.decide_refund(current_setting('test.r1')::uuid,true,'manual_bank',null,6000)$$,
  'P0001','invalid_amount','approval cannot raise the requested amount');
select is(public.decide_refund(current_setting('test.r1')::uuid,true,'manual_bank','Pro rata',4000),true,
  'staff approves a lower amount');
reset role;
select is((select status||'/'||method||'/'||amount_cents::text||'/'||decision_note from public.refund_requests
  where id=current_setting('test.r1')::uuid),'approved/manual_bank/4000/Pro rata','approval recorded at the lower amount');
select is(public.payment_refundable_cents(current_setting('test.m_attempt')::uuid),51000::bigint,
  'lowering the approved amount releases the difference');

-- ============================================================
-- Manual processing
-- ============================================================
set local role authenticated;
select set_config('request.jwt.claim.sub','44444444-4444-4444-8444-444444444444',true);
select throws_ok($$select public.complete_manual_refund(current_setting('test.r1')::uuid,'EFT-1')$$,
  'P0001','forbidden','payer cannot mark a refund processed');
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
select throws_ok($$select public.complete_manual_refund(current_setting('test.r1')::uuid,'   ')$$,
  'P0001','reference_required','manual refund needs a bank reference');
select throws_ok($$select public.complete_manual_refund(current_setting('test.r2')::uuid,'EFT-X')$$,
  'P0001','refund_not_ready','rejected refund cannot be processed');
select is(public.complete_manual_refund(current_setting('test.r1')::uuid,' EFT-REF-0001 '),true,
  'staff completes the manual refund with a reference');
select is(public.complete_manual_refund(current_setting('test.r1')::uuid,'EFT-REF-0001'),false,
  'duplicate completion returns false');
reset role;
select is((select status||'/'||external_reference||'/'||processed_by::text||'/'||(processed_at is not null)::text
  from public.refund_requests where id=current_setting('test.r1')::uuid),
  'processed/EFT-REF-0001/11111111-1111-4111-8111-111111111111/true','manual refund processed');
select is((select status from public.invoices where id='31310000-0000-4000-8000-0000000000f1'),'paid',
  'refunded invoice stays paid (net paid = payment - refunds)');

-- ============================================================
-- Full refund of a shop order
-- ============================================================
set local role authenticated;
select set_config('request.jwt.claim.sub','44444444-4444-4444-8444-444444444444',true);
select isnt(set_config('test.ra',public.request_refund(current_setting('test.a_attempt')::uuid,20000,
  'Wrong size')::text,true),null,'payer requests a full shop order refund');
select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);
select is(public.decide_refund(current_setting('test.ra')::uuid,true,'manual_bank',null),true,'staff approves the full refund');
reset role;
select is((select status from public.orders where id='31310000-0000-4000-8000-00000000000a'),'paid',
  'order stays paid until the refund is processed');
set local role authenticated;
select is(public.complete_manual_refund(current_setting('test.ra')::uuid,'EFT-REF-0002'),true,'full shop refund processed');
reset role;
select is((select status from public.orders where id='31310000-0000-4000-8000-00000000000a'),'refunded',
  'fully refunded order is marked refunded');
select is((select bulk_order_id from public.orders where id='31310000-0000-4000-8000-00000000000a'),null::uuid,
  'refunded order leaves the collecting bulk order');
select is(public.payment_refundable_cents(current_setting('test.a_attempt')::uuid),0::bigint,
  'nothing left to refund on the order');

-- ============================================================
-- Provider refund path (order D, PayFast)
-- ============================================================
set local role authenticated;
select set_config('request.jwt.claim.sub','44444444-4444-4444-8444-444444444444',true);
select isnt(set_config('test.rp1',public.request_refund(current_setting('test.d_attempt')::uuid,1000,
  'Missing button')::text,true),null,'payer requests a partial refund of a PayFast payment');
select throws_ok($$select * from public.start_provider_refund(current_setting('test.rp1')::uuid)$$,
  'P0001','forbidden','payer cannot start a provider refund');
select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);
select throws_ok($$select * from public.start_provider_refund(current_setting('test.rp1')::uuid)$$,
  'P0001','refund_not_ready','an undecided refund cannot be started');
select is(public.decide_refund(current_setting('test.rp1')::uuid,true,'provider',null),true,
  'staff approves a provider refund on the PayFast payment');
select is((select provider||'/'||provider_payment_id||'/'||amount_cents||'/'||reason
  from public.start_provider_refund(current_setting('test.rp1')::uuid)),
  'payfast_sandbox/rfd-pay-d/1000/Missing button','staff claims the refund and gets the provider payment id');
select throws_ok($$select * from public.start_provider_refund(current_setting('test.rp1')::uuid)$$,
  'P0001','refund_not_ready','a claimed refund cannot be started twice');
select throws_ok($$select public.finish_provider_refund(current_setting('test.rp1')::uuid,true,'x',null)$$,
  '42501',null,'authenticated users cannot record the provider result');
reset role;
select is((select status||'/'||processed_by::text from public.refund_requests where id=current_setting('test.rp1')::uuid),
  'processing/22222222-2222-4222-8222-222222222222','claimed refund is processing');

set local role service_role;
select is(public.finish_provider_refund(current_setting('test.rp1')::uuid,false,null,'Sandbox does not support refunds'),
  true,'server records a provider failure');
select is(public.finish_provider_refund(current_setting('test.rp1')::uuid,false,null,'again'),
  false,'repeat provider result is ignored');
reset role;
select is((select status||'/'||failure_reason from public.refund_requests where id=current_setting('test.rp1')::uuid),
  'failed/Sandbox does not support refunds','failed provider refund recorded');
select is(public.payment_refundable_cents(current_setting('test.d_attempt')::uuid),15000::bigint,
  'failed refund restores the refundable amount');

set local role authenticated;
select set_config('request.jwt.claim.sub','44444444-4444-4444-8444-444444444444',true);
select isnt(set_config('test.rp2',public.request_refund(current_setting('test.d_attempt')::uuid,1000,
  'Missing button, retry')::text,true),null,'payer requests the refund again');
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
select is(public.decide_refund(current_setting('test.rp2')::uuid,true,'provider',null),true,'staff approves the retry');
select is((select provider_payment_id from public.start_provider_refund(current_setting('test.rp2')::uuid)),
  'rfd-pay-d','staff claims the retry');
select throws_ok($$select public.complete_manual_refund(current_setting('test.rp2')::uuid,'EFT-X')$$,
  'P0001','refund_not_ready','a provider refund cannot be completed manually');
reset role;
set local role service_role;
select is(public.finish_provider_refund(current_setting('test.rp2')::uuid,true,' pf-refund-1 ',null),
  true,'server records provider success');
reset role;
select is((select status||'/'||external_reference from public.refund_requests where id=current_setting('test.rp2')::uuid),
  'processed/pf-refund-1','provider refund processed with the provider reference');
select is(public.payment_refundable_cents(current_setting('test.d_attempt')::uuid),14000::bigint,
  'processed provider refund reduces the refundable amount');
select is((select status from public.orders where id='31310000-0000-4000-8000-00000000000d'),'paid',
  'partially refunded order stays paid');

-- ============================================================
-- Bulk-order cancellation
-- ============================================================
set local role authenticated;
select set_config('request.jwt.claim.sub','44444444-4444-4444-8444-444444444444',true);
select throws_ok($$select public.cancel_bulk_order(current_setting('test.old_bulk')::uuid)$$,
  'P0001','forbidden','non-staff cannot cancel a bulk order');
reset role;
-- Every paid order still in the collecting bulk order, including any from
-- other fixtures, gets exactly one request.
select set_config('test.expected_raised',(select count(*)::text from public.payment_attempts p
  join public.orders o on o.id=p.order_id
  where o.bulk_order_id=current_setting('test.old_bulk')::uuid and o.status='paid' and p.status='succeeded'
    and public.payment_refundable_cents(p.id)>0),true);
select is(current_setting('test.expected_raised')::integer>=2,true,'orders C and D are both in the bulk order');
set local role authenticated;
select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);
select is(public.cancel_bulk_order(current_setting('test.old_bulk')::uuid),
  current_setting('test.expected_raised')::integer,'staff cancel raises one request per paid order');
select throws_ok($$select public.cancel_bulk_order(current_setting('test.old_bulk')::uuid)$$,
  'P0001','bulk_order_closed','a cancelled bulk order cannot be cancelled again');
reset role;
select is((select status from public.bulk_orders where id=current_setting('test.old_bulk')::uuid),'cancelled',
  'bulk order cancelled');
select is((select count(*)::integer from public.bulk_orders where status='collecting'
  and id<>current_setting('test.old_bulk')::uuid),1,'a fresh collecting bulk order is opened');
select is((select string_agg(amount_cents::text||'/'||status||'/'||requested_by::text,',' order by amount_cents)
  from public.refund_requests where reason='Bulk order cancelled'
    and payment_attempt_id in (current_setting('test.c_attempt')::uuid,current_setting('test.d_attempt')::uuid)),
  '10000/requested/22222222-2222-4222-8222-222222222222,14000/requested/22222222-2222-4222-8222-222222222222',
  'bulk cancellation requests the remaining refundable amount of each paid order');
select is((select count(*)::integer from public.refund_requests where reason='Bulk order cancelled'
  and payment_attempt_id=current_setting('test.a_attempt')::uuid),0,'already refunded order gets no new request');

-- ============================================================
-- Direct table access and read scoping
-- ============================================================
set local role authenticated;
select set_config('request.jwt.claim.sub','44444444-4444-4444-8444-444444444444',true);
select throws_ok($$insert into public.refund_requests(payment_attempt_id,payer_id,requested_by,amount_cents,reason)
  values(current_setting('test.d_attempt')::uuid,auth.uid(),auth.uid(),1,'direct')$$,
  '42501',null,'payer cannot insert refund requests directly');
select throws_ok($$update public.refund_requests set status='processed' where id=current_setting('test.rp1')::uuid$$,
  '42501',null,'payer cannot update refund requests directly');
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
select throws_ok($$update public.refund_requests set status='processed' where id=current_setting('test.rp1')::uuid$$,
  '42501',null,'staff cannot update refund requests directly');
select throws_ok($$delete from public.refund_requests where id=current_setting('test.rp1')::uuid$$,
  '42501',null,'staff cannot delete refund requests directly');

-- Table reads.
reset role;
select set_config('test.total_refunds',(select count(*)::text from public.refund_requests),true);
select set_config('test.guardian_refunds',(select count(*)::text from public.refund_requests
  where payer_id='44444444-4444-4444-8444-444444444444'),true);
set local role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
select is((select count(*)::text from public.refund_requests),current_setting('test.total_refunds'),
  'staff select sees all refund requests');
select set_config('request.jwt.claim.sub','44444444-4444-4444-8444-444444444444',true);
select is((select count(*)::text from public.refund_requests),current_setting('test.guardian_refunds'),
  'payer selects only own refund requests');
select is((select count(*)::integer from public.refund_requests where payer_id<>auth.uid()),0,
  'payer sees no other payer''s refund requests');
select set_config('request.jwt.claim.sub','77777777-7777-4777-8777-777777777777',true);
select is((select count(*)::integer from public.refund_requests),1,'other payer sees only their bulk refund request');
select set_config('request.jwt.claim.sub','33333333-3333-4333-8333-333333333333',true);
select is((select count(*)::integer from public.refund_requests),0,'dependent reads no refund requests');
reset role;
set local role anon;
-- anon keeps the default table SELECT grant, but the staff policy calls a
-- function anon cannot execute, so the read is refused outright.
select throws_ok($$select count(*) from public.refund_requests$$,'42501',null,'anonymous cannot read refund requests');
reset role;

-- Read models.
set local role authenticated;
select set_config('request.jwt.claim.sub','44444444-4444-4444-8444-444444444444',true);
select is((select count(*)::text from public.list_refund_requests()),current_setting('test.guardian_refunds'),
  'payer lists only own refund requests');
select is((select count(*)::integer from public.list_refund_requests() where payer_id<>auth.uid()),0,
  'payer refund list excludes other payers');
select is((select kind||'/'||payment_amount_cents||'/'||refundable_cents||'/'||amount_cents||'/'||status||'/'||has_provider_payment::text
  from public.list_refund_requests() where id=current_setting('test.rp2')::uuid),
  'order/15000/0/1000/processed/true','refund list reports kind, balances and provider payment');
select is((select count(*)::integer from public.list_refundable_payments() where payer_id<>auth.uid()),0,
  'payer refundable list excludes other payers');
select is((select kind||'/'||provider||'/'||amount_cents||'/'||refundable_cents||'/'||(receipt_number is not null)::text
  from public.list_refundable_payments() where attempt_id=current_setting('test.m_attempt')::uuid),
  'invoice/manual/55000/51000/true','payer sees own manual payment with its refundable balance');
select is((select count(*)::integer from public.list_refundable_payments()
  where attempt_id in (current_setting('test.a_attempt')::uuid,current_setting('test.d_attempt')::uuid)),2,
  'payer sees own order payments');
select set_config('request.jwt.claim.sub','77777777-7777-4777-8777-777777777777',true);
select is((select count(*)::integer from public.list_refund_requests()),1,'other payer lists only own refund request');
select is((select string_agg(attempt_id::text,',') from public.list_refundable_payments()),
  current_setting('test.c_attempt'),'other payer lists only own payment');
select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);
select is((select count(*)::text from public.list_refund_requests()),current_setting('test.total_refunds'),
  'staff list every refund request');
select is((select count(*)::integer from public.list_refundable_payments()
  where attempt_id in (current_setting('test.a_attempt')::uuid,current_setting('test.c_attempt')::uuid,
    current_setting('test.d_attempt')::uuid,current_setting('test.m_attempt')::uuid)),4,
  'staff list payments from every payer');
select set_config('request.jwt.claim.sub','33333333-3333-4333-8333-333333333333',true);
select throws_ok($$select * from public.list_refund_requests()$$,'P0001','forbidden','dependent cannot list refund requests');
select throws_ok($$select * from public.list_refundable_payments()$$,'P0001','forbidden','dependent cannot list refundable payments');
reset role;
set local role anon;
select throws_ok($$select * from public.list_refund_requests()$$,'42501',null,'anonymous cannot list refund requests');
select throws_ok($$select * from public.list_refundable_payments()$$,'42501',null,'anonymous cannot list refundable payments');
reset role;

-- ============================================================
-- Audit trail
-- ============================================================
select is((select string_agg(event_type||'='||n::text,',' order by event_type) from (
    select event_type,count(*) n from public.audit_events
    where entity_type='refund_request' group by event_type) e),
  -- requested=7: five direct requests plus one per order raised by cancel_bulk_order (0032).
  'refund.approved=4,refund.failed=1,refund.processed=3,refund.rejected=1,refund.requested=7',
  'each refund step writes an audit event');
select is((select actor_id::text||'/'||subject_profile_id::text||'/'||(metadata->>'amount_cents')
  from public.audit_events where event_type='refund.processed' and entity_id=current_setting('test.rp2')::uuid),
  '11111111-1111-4111-8111-111111111111/44444444-4444-4444-8444-444444444444/1000',
  'provider success is attributed to the staff member who claimed it');
select is((select actor_id::text||'/'||(metadata->>'refunds_requested') from public.audit_events
  where event_type='bulk_order.cancelled' and entity_id=current_setting('test.old_bulk')::uuid),
  '22222222-2222-4222-8222-222222222222/'||current_setting('test.expected_raised'),'bulk cancellation audited');

select * from finish();
rollback;
