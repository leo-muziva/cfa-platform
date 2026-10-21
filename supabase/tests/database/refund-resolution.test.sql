begin;
select no_plan();

-- Staff resolution of a provider refund left 'processing' after an
-- unconfirmed PayFast call (0032). Synthetic seed actors; rolls back.
--   22222222 coach staff   44444444 guardian payer

insert into public.products(item_code,name,price,category,is_active) values
  ('TEST0032-P','Synthetic resolution mask',300.00,'Protective',true);
insert into public.orders(id,user_id,status) values
  ('32320000-0000-4000-8000-00000000000a','44444444-4444-4444-8444-444444444444','draft');
insert into public.order_items(order_id,product_id,quantity,unit_price) values
  ('32320000-0000-4000-8000-00000000000a',(select id from public.products where item_code='TEST0032-P'),1,300.00);

set local role authenticated;
select set_config('request.jwt.claim.sub','44444444-4444-4444-8444-444444444444',true);
select is((select amount_cents from public.prepare_order_checkout('32320000-0000-4000-8000-00000000000a')),
  '30000','order checkout prepares');
reset role;
select set_config('test.attempt',(select id::text from public.payment_attempts
  where order_id='32320000-0000-4000-8000-00000000000a'),true);
select set_config('test.reference',(select provider_reference from public.payment_attempts
  where order_id='32320000-0000-4000-8000-00000000000a'),true);
set local role service_role;
select is(public.record_payment_event('payfast_sandbox','res-evt','res-pay',
  current_setting('test.reference'),'succeeded',30000,'ZAR'),true,'order paid through PayFast');
reset role;

-- Two provider refunds end up processing: one will be resolved paid, one failed.
set local role authenticated;
select set_config('request.jwt.claim.sub','44444444-4444-4444-8444-444444444444',true);
select isnt(set_config('test.r1',public.request_refund(current_setting('test.attempt')::uuid,10000,'Wrong size')::text,true),
  null,'payer requests the first refund');
select isnt(set_config('test.r2',public.request_refund(current_setting('test.attempt')::uuid,5000,'Damaged')::text,true),
  null,'payer requests the second refund');
select throws_ok($$select public.resolve_processing_refund(current_setting('test.r1')::uuid,true,'ref','checked')$$,
  'P0001','forbidden','payer cannot resolve a refund');
select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);
select throws_ok($$select public.resolve_processing_refund(current_setting('test.r1')::uuid,true,'ref','checked')$$,
  'P0001','refund_not_ready','only processing refunds can be resolved');
select is(public.decide_refund(current_setting('test.r1')::uuid,true,'provider',null),true,'first approved for PayFast');
select is(public.decide_refund(current_setting('test.r2')::uuid,true,'provider',null),true,'second approved for PayFast');
select lives_ok($$select * from public.start_provider_refund(current_setting('test.r1')::uuid)$$,'first claimed');
select lives_ok($$select * from public.start_provider_refund(current_setting('test.r2')::uuid)$$,'second claimed');

select throws_ok($$select public.resolve_processing_refund(current_setting('test.r1')::uuid,true,'ref','  ')$$,
  'P0001','note_required','a note is required');
select throws_ok($$select public.resolve_processing_refund(current_setting('test.r1')::uuid,true,null,'Dashboard shows paid')$$,
  'P0001','reference_required','a paid outcome needs the PayFast reference');
select is(public.resolve_processing_refund(current_setting('test.r1')::uuid,true,' PF-REF-1 ','Dashboard shows paid'),
  true,'staff records a paid outcome');
select is(public.resolve_processing_refund(current_setting('test.r2')::uuid,false,null,'No refund on dashboard'),
  true,'staff records a failed outcome without a reference');
select throws_ok($$select public.resolve_processing_refund(current_setting('test.r1')::uuid,true,'ref','again')$$,
  'P0001','refund_not_ready','a resolved refund cannot be resolved again');
reset role;

select is((select status||'/'||external_reference from public.refund_requests where id=current_setting('test.r1')::uuid),
  'processed/PF-REF-1','paid outcome is processed with the reference');
select is((select status||'/'||failure_reason from public.refund_requests where id=current_setting('test.r2')::uuid),
  'failed/No refund on dashboard','failed outcome records the note');
select is(public.payment_refundable_cents(current_setting('test.attempt')::uuid),20000::bigint,
  'only the paid refund reduces the refundable amount');
select is((select status from public.orders where id='32320000-0000-4000-8000-00000000000a'),'paid',
  'a partially refunded order stays paid');
select is((select count(*)::integer from public.audit_events where entity_type='refund_request'
  and entity_id in (current_setting('test.r1')::uuid,current_setting('test.r2')::uuid)
  and (metadata->>'resolved_manually')='true'),2,'both resolutions are audited');

set local role anon;
select throws_ok($$select count(*) from public.refund_requests$$,'42501',null,'anonymous cannot read refund requests');
reset role;

select * from finish();
rollback;
