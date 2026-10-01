begin;
select no_plan();

-- Shop orders are pay-now through the shared payment pipeline (0029).
-- Uses synthetic seed actors and synthetic products/orders; everything rolls back.
--   11111111 admin (is_staff, staff_type admin)   22222222 coach (staff, not admin)
--   33333333 dependent billed to 44444444         44444444 guardian and payer

-- Fixtures as the migration owner, before any role switch.
insert into public.products(item_code,name,price,category,is_active) values
  ('TEST0029-P1','Synthetic practice foil',125.50,'Weapons',true),
  ('TEST0029-OFF','Synthetic retired mask',80.00,'Masks',false);
insert into public.orders(id,user_id,status) values
  ('29290000-0000-4000-8000-000000000002','33333333-3333-4333-8333-333333333333','draft'),
  ('29290000-0000-4000-8000-000000000003','22222222-2222-4222-8222-222222222222','draft'),
  ('29290000-0000-4000-8000-000000000004','11111111-1111-4111-8111-111111111111','draft');
insert into public.order_items(order_id,product_id,quantity,unit_price) values
  ('29290000-0000-4000-8000-000000000002',(select id from public.products where item_code='TEST0029-P1'),1,125.50),
  ('29290000-0000-4000-8000-000000000004',(select id from public.products where item_code='TEST0029-OFF'),1,80.00);
select set_config('test.bulk_baseline',
  (select coalesce(sum(total_cents),0)::text from public.get_collecting_bulk_progress()),true);

-- Anonymous visitors cannot start a checkout but can see the pooled progress.
set local role anon;
select throws_ok($$select * from public.prepare_order_checkout('29290000-0000-4000-8000-000000000002')$$,
  '42501',null,'anonymous cannot prepare a shop checkout');
select lives_ok($$select * from public.get_collecting_bulk_progress()$$,'anonymous can read bulk order progress');
reset role;

-- The payer builds a cart under RLS and tampers with the line price.
set local role authenticated;
select set_config('request.jwt.claim.sub','44444444-4444-4444-8444-444444444444',true);
select lives_ok($$insert into public.orders(id,user_id,status)
  values('29290000-0000-4000-8000-000000000001',auth.uid(),'draft')$$,'payer creates own draft cart');
select lives_ok($$insert into public.order_items(order_id,product_id,quantity,unit_price)
  values('29290000-0000-4000-8000-000000000001',(select id from public.products where item_code='TEST0029-P1'),2,1.00)$$,
  'payer adds a draft line with a tampered price');
select throws_ok($$update public.orders set status='submitted' where id='29290000-0000-4000-8000-000000000001'$$,
  '42501',null,'payer cannot submit an unpaid order directly');
select throws_ok($$update public.orders set status='paid' where id='29290000-0000-4000-8000-000000000001'$$,
  '42501',null,'payer cannot mark own order paid');
select throws_ok($$insert into public.orders(id,user_id,status)
  values('29290000-0000-4000-8000-000000000006',auth.uid(),'paid')$$,
  '42501',null,'payer cannot insert a paid order');

-- Authorization and validation failures.
select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);
select throws_ok($$select * from public.prepare_order_checkout('29290000-0000-4000-8000-000000000001')$$,
  'P0001','forbidden','another payer cannot prepare someone else''s order');
select throws_ok($$select * from public.prepare_order_checkout('29290000-0000-4000-8000-000000000003')$$,
  'P0001','empty_order','empty order cannot be checked out');
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
select throws_ok($$select * from public.prepare_order_checkout('29290000-0000-4000-8000-000000000004')$$,
  'P0001','product_unavailable','inactive product blocks checkout');
select set_config('request.jwt.claim.sub','33333333-3333-4333-8333-333333333333',true);
select throws_ok($$select * from public.prepare_order_checkout('29290000-0000-4000-8000-000000000002')$$,
  'P0001','forbidden','dependent owner cannot pay for an order');
select set_config('request.jwt.claim.sub','44444444-4444-4444-8444-444444444444',true);
select throws_ok($$select * from public.prepare_order_checkout('29290000-0000-4000-8000-000000000001','live_card')$$,
  'P0001','invalid_input','unknown provider rejected');

-- Checkout re-prices the draft, locks it and is idempotent.
select is((select prices_changed from public.prepare_order_checkout('29290000-0000-4000-8000-000000000001')),
  true,'tampered draft price is re-priced to the catalogue');
select is((select amount_cents from public.prepare_order_checkout('29290000-0000-4000-8000-000000000001')),
  '25100','repeat prepare returns the catalogue total in cents');
select is((select prices_changed from public.prepare_order_checkout('29290000-0000-4000-8000-000000000001')),
  false,'pending order keeps its checkout snapshot');

-- Direct writes cannot change a pending order.
select throws_ok($$insert into public.order_items(order_id,product_id,quantity,unit_price)
  values('29290000-0000-4000-8000-000000000001',(select id from public.products where item_code='TEST0029-P1'),1,125.50)$$,
  '42501',null,'no new lines while pending payment');
update public.order_items set quantity=1,unit_price=1.00 where order_id='29290000-0000-4000-8000-000000000001';
update public.orders set status='draft' where id='29290000-0000-4000-8000-000000000001';
update public.orders set status='paid' where id='29290000-0000-4000-8000-000000000001';
reset role;

select is((select status from public.orders where id='29290000-0000-4000-8000-000000000001'),
  'pending_payment','checkout locks the order and direct status writes change nothing');
select is((select count(*)::integer from public.order_items where order_id='29290000-0000-4000-8000-000000000001'),
  1,'no line added while pending');
select is((select quantity from public.order_items where order_id='29290000-0000-4000-8000-000000000001'),
  2,'pending lines cannot be edited');
select is((select unit_price from public.order_items where order_id='29290000-0000-4000-8000-000000000001'),
  125.50::numeric,'line carries the catalogue price');
select is((select count(*)::integer from public.charges where order_id='29290000-0000-4000-8000-000000000001'),
  1,'one charge for the order');
select is((select type||'/'||lifecycle_state||'/'||status||'/'||amount_cents::text||'/'||payer_id::text
  from public.charges where order_id='29290000-0000-4000-8000-000000000001'),
  'shop/provisional/unpaid/25100/44444444-4444-4444-8444-444444444444','provisional shop charge for the payer');
select is((select count(*)::integer from public.payment_attempts where order_id='29290000-0000-4000-8000-000000000001'),
  1,'repeat prepare reuses one attempt');
select is((select status||'/'||amount_cents::text from public.payment_attempts
  where order_id='29290000-0000-4000-8000-000000000001'),'pending/25100','attempt is pending for the order total');
select set_config('test.g_attempt',(select id::text from public.payment_attempts
  where order_id='29290000-0000-4000-8000-000000000001'),true);
select set_config('test.g_reference',(select provider_reference from public.payment_attempts
  where order_id='29290000-0000-4000-8000-000000000001'),true);

set local role authenticated;
select is((select description from public.get_payment_checkout(current_setting('test.g_attempt')::uuid)),
  'CFA shop order','checkout description names the shop order');
select is((select kind from public.get_payment_status(current_setting('test.g_attempt')::uuid)),
  'order','payment status reports an order attempt');
reset role;

-- Verified provider events settle the order.
set local role service_role;
select throws_ok($$select public.record_payment_event('payfast_sandbox','shop-bad-amount','shop-payment-1',
  current_setting('test.g_reference'),'succeeded',100,'ZAR')$$,'P0001','payment_mismatch','amount mismatch rejected');
select is(public.record_payment_event('payfast_sandbox','shop-failed-1','shop-payment-1',
  current_setting('test.g_reference'),'failed',25100,'ZAR'),true,'failed event recorded');
reset role;
select is((select status from public.orders where id='29290000-0000-4000-8000-000000000001'),
  'pending_payment','failed payment leaves the order awaiting payment');
select is((select lifecycle_state from public.charges where order_id='29290000-0000-4000-8000-000000000001'),
  'provisional','failed payment leaves the charge provisional');
set local role service_role;
select is(public.record_payment_event('payfast_sandbox','shop-success-1','shop-payment-1',
  current_setting('test.g_reference'),'succeeded',25100,'ZAR'),true,'verified success settles the order');
select is(public.record_payment_event('payfast_sandbox','shop-success-1','shop-payment-1',
  current_setting('test.g_reference'),'succeeded',25100,'ZAR'),false,'duplicate event ignored');
reset role;
select is((select status from public.orders where id='29290000-0000-4000-8000-000000000001'),'paid','order paid');
select is((select bulk_order_id from public.orders where id='29290000-0000-4000-8000-000000000001'),
  (select id from public.bulk_orders where status='collecting'),'paid order joins the collecting bulk order');
select is((select lifecycle_state||'/'||status from public.charges where order_id='29290000-0000-4000-8000-000000000001'),
  'finalized/paid','charge finalized and paid');
select is((select sum(amount_cents)::bigint from public.payment_allocations
  where payment_attempt_id=current_setting('test.g_attempt')::uuid),25100::bigint,'exact amount allocated');
select is((select count(*)::integer from public.receipts where payment_attempt_id=current_setting('test.g_attempt')::uuid),
  1,'single receipt');
select is((select count(*)::integer from public.ledger_credits where payment_attempt_id=current_setting('test.g_attempt')::uuid),
  0,'exact payment leaves no credit');

set local role anon;
select is((select coalesce(sum(total_cents),0)::bigint from public.get_collecting_bulk_progress()),
  current_setting('test.bulk_baseline')::bigint+25100,'bulk progress includes the paid order total');
reset role;

-- A reopened cart keeps late money as credit instead of settling.
set local role authenticated;
select lives_ok($$insert into public.orders(id,user_id,status)
  values('29290000-0000-4000-8000-000000000005',auth.uid(),'draft')$$,'payer opens a new cart after paying');
select lives_ok($$insert into public.order_items(order_id,product_id,quantity,unit_price)
  values('29290000-0000-4000-8000-000000000005',(select id from public.products where item_code='TEST0029-P1'),1,125.50)$$,
  'payer adds a line to the new cart');
select is((select amount_cents from public.prepare_order_checkout('29290000-0000-4000-8000-000000000005')),
  '12550','second order checkout prepares');
reset role;
select set_config('test.r_attempt',(select id::text from public.payment_attempts
  where order_id='29290000-0000-4000-8000-000000000005'),true);
select set_config('test.r_reference',(select provider_reference from public.payment_attempts
  where order_id='29290000-0000-4000-8000-000000000005'),true);
set local role authenticated;
select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);
select throws_ok($$select public.reopen_order_cart('29290000-0000-4000-8000-000000000005')$$,
  'P0001','forbidden','another user cannot reopen the cart');
select set_config('request.jwt.claim.sub','44444444-4444-4444-8444-444444444444',true);
select is(public.reopen_order_cart('29290000-0000-4000-8000-000000000005'),true,'pending order reopens');
select is(public.reopen_order_cart('29290000-0000-4000-8000-000000000005'),false,'reopening a draft is a no-op');
reset role;
select is((select status from public.orders where id='29290000-0000-4000-8000-000000000005'),'draft','reopened order is a draft');
select is((select lifecycle_state from public.charges where order_id='29290000-0000-4000-8000-000000000005'),
  'voided','provisional charge voided on reopen');
select is((select status from public.payment_attempts where id=current_setting('test.r_attempt')::uuid),
  'failed','open attempt failed on reopen');
set local role service_role;
select is(public.record_payment_event('payfast_sandbox','shop-late-1','shop-payment-late',
  current_setting('test.r_reference'),'succeeded',12550,'ZAR'),true,'late success for the old attempt acknowledged');
reset role;
select is((select status from public.orders where id='29290000-0000-4000-8000-000000000005'),'draft','late payment does not settle a changed order');
select is((select bulk_order_id from public.orders where id='29290000-0000-4000-8000-000000000005'),
  null::uuid,'changed order stays out of the bulk order');
select is((select amount_cents::text||'/'||reason from public.ledger_credits
  where payment_attempt_id=current_setting('test.r_attempt')::uuid),
  '12550/Payment received for a changed shop order','late payment credited in full');
select is((select count(*)::integer from public.payment_allocations
  where payment_attempt_id=current_setting('test.r_attempt')::uuid),0,'late payment allocates nothing');
set local role authenticated;
select is((select credited from public.get_payment_status(current_setting('test.r_attempt')::uuid)),
  true,'payer sees the late payment as credited');
select is((select amount_cents from public.prepare_order_checkout('29290000-0000-4000-8000-000000000005')),
  '12550','reopened cart can be checked out again');
reset role;
select is((select count(*)::integer from public.charges
  where order_id='29290000-0000-4000-8000-000000000005' and lifecycle_state='provisional'),
  1,'a fresh provisional charge replaces the voided one');
select is((select count(*)::integer from public.payment_attempts
  where order_id='29290000-0000-4000-8000-000000000005' and status='pending'),
  1,'a fresh attempt replaces the failed one');

-- Monthly invoicing never bills shop charges; a membership control proves the run.
insert into public.charges(id,fencer_id,payer_id,type,amount_cents,status,period,description,lifecycle_state) values
  ('29290000-0000-4000-8000-0000000000c1','44444444-4444-4444-8444-444444444444','44444444-4444-4444-8444-444444444444',
    'shop',9900,'unpaid','2091-03-01','Synthetic finalized shop charge','finalized'),
  ('29290000-0000-4000-8000-0000000000c2','44444444-4444-4444-8444-444444444444','44444444-4444-4444-8444-444444444444',
    'membership',55000,'unpaid','2091-03-01','Synthetic membership control','finalized');
set local role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
select lives_ok($$select public.run_monthly_invoices('2091-03-01')$$,'admin runs invoices for the synthetic period');
select lives_ok($$select public.run_monthly_invoices(date_trunc('month',now())::date)$$,
  'admin runs invoices for the shop charge period');
reset role;
select is((select count(*)::integer from public.invoice_lines where charge_id='29290000-0000-4000-8000-0000000000c1'),
  0,'finalized unpaid shop charge never enters a monthly invoice');
select is((select count(*)::integer from public.invoice_lines where charge_id='29290000-0000-4000-8000-0000000000c2'),
  1,'membership control charge is invoiced');
select is((select count(*)::integer from public.invoice_lines l join public.charges c on c.id=l.charge_id
  where c.order_id in ('29290000-0000-4000-8000-000000000001','29290000-0000-4000-8000-000000000005')),
  0,'shop order charges stay off monthly invoices');

-- Product management uses the staff admin capability.
set local role authenticated;
select lives_ok($$insert into public.products(item_code,name,price,category)
  values('TEST0029-NEW','Synthetic admin product',50.00,'Accessories')$$,'admin creates a product');
select lives_ok($$update public.products set price=60.00,is_active=false where item_code='TEST0029-NEW'$$,
  'admin edits and deactivates a product');
select is((select count(*)::integer from public.products where item_code='TEST0029-OFF'),1,'admin reads inactive products');
select set_config('request.jwt.claim.sub','44444444-4444-4444-8444-444444444444',true);
select is((select count(*)::integer from public.products where item_code='TEST0029-OFF'),0,'customers cannot read inactive products');
update public.products set price=1.00 where item_code='TEST0029-P1';
select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);
select throws_ok($$insert into public.products(item_code,name,price)
  values('TEST0029-BAD','Synthetic forbidden product',1.00)$$,'42501',null,'non-admin staff cannot create a product');
reset role;
select is((select price::text||'/'||is_active::text from public.products where item_code='TEST0029-NEW'),
  '60.00/false','admin product update persisted');
select is((select price from public.products where item_code='TEST0029-P1'),125.50::numeric,'customer product update changes nothing');

select * from finish();
rollback;
