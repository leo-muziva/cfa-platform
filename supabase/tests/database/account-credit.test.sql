begin;
select plan(14);

-- BUG-21: account credit is spent on an invoice when its checkout starts or
-- when staff record a manual payment. Synthetic rows, all rolled back.
-- George (payer) and Fiona (his dependent) come from seed.sql.

-- Invoice 1: Fiona R1 000 + George R550 = R1 550, with R300 credit.
insert into public.charges(id,fencer_id,payer_id,type,amount,amount_cents,status,period,description,lifecycle_state) values
  ('c2100000-0000-4000-8000-000000000001','33333333-3333-4333-8333-333333333333','44444444-4444-4444-8444-444444444444','membership',1000,100000,'unpaid','2030-01-01','Fiona membership','finalized'),
  ('c2100000-0000-4000-8000-000000000002','44444444-4444-4444-8444-444444444444','44444444-4444-4444-8444-444444444444','membership',550,55000,'unpaid','2030-01-01','George membership','finalized');
insert into public.invoices(id,payer_id,period,invoice_number,total) values
  ('12100000-0000-4000-8000-000000000001','44444444-4444-4444-8444-444444444444','2030-01-01','CFA-TEST-21A',1550);
insert into public.invoice_lines(invoice_id,charge_id,description,amount,participant_id) values
  ('12100000-0000-4000-8000-000000000001','c2100000-0000-4000-8000-000000000001','Fiona membership',1000,'33333333-3333-4333-8333-333333333333'),
  ('12100000-0000-4000-8000-000000000001','c2100000-0000-4000-8000-000000000002','George membership',550,'44444444-4444-4444-8444-444444444444');
insert into public.ledger_credits(id,payer_id,amount,amount_cents,reason) values
  ('1c210000-0000-4000-8000-000000000001','44444444-4444-4444-8444-444444444444',300,30000,'Lesson cancellation');

set local role authenticated;
select set_config('request.jwt.claim.sub','44444444-4444-4444-8444-444444444444',true);
select is(public.get_my_available_credit(),'30000','payer sees R300 unused credit');
select is((select amount_cents from public.prepare_payment_checkout(null,'12100000-0000-4000-8000-000000000001','payfast_sandbox')),
  '125000','checkout charges R1 250, the invoice less the credit');
select is(public.get_my_available_credit(),'0','the credit is used up');
select is((select amount_cents from public.prepare_payment_checkout(null,'12100000-0000-4000-8000-000000000001','payfast_sandbox')),
  '125000','starting checkout again does not spend credit twice');
select set_config('request.jwt.claim.sub','33333333-3333-4333-8333-333333333333',true);
select throws_ok($$select public.get_my_available_credit()$$,'P0001','forbidden','a dependent cannot read the payer''s credit');
reset role;
select is((select sum(amount_cents) from public.credit_consumptions where ledger_credit_id='1c210000-0000-4000-8000-000000000001'),
  30000::numeric,'exactly R300 of credit was consumed');
select is((select status from public.invoices where id='12100000-0000-4000-8000-000000000001'),'unpaid','a part-covered invoice stays unpaid');

-- Invoice 2: R200, fully covered by a new R500 credit.
insert into public.charges(id,fencer_id,payer_id,type,amount,amount_cents,status,period,description,lifecycle_state) values
  ('c2100000-0000-4000-8000-000000000003','44444444-4444-4444-8444-444444444444','44444444-4444-4444-8444-444444444444','membership',200,20000,'unpaid','2030-02-01','George small charge','finalized');
insert into public.invoices(id,payer_id,period,invoice_number,total) values
  ('12100000-0000-4000-8000-000000000002','44444444-4444-4444-8444-444444444444','2030-02-01','CFA-TEST-21B',200);
insert into public.invoice_lines(invoice_id,charge_id,description,amount,participant_id) values
  ('12100000-0000-4000-8000-000000000002','c2100000-0000-4000-8000-000000000003','George small charge',200,'44444444-4444-4444-8444-444444444444');
insert into public.ledger_credits(id,payer_id,amount,amount_cents,reason) values
  ('1c210000-0000-4000-8000-000000000002','44444444-4444-4444-8444-444444444444',500,50000,'Online payment excess');

set local role authenticated;
select set_config('request.jwt.claim.sub','44444444-4444-4444-8444-444444444444',true);
select is((select count(*)::integer from public.prepare_payment_checkout(null,'12100000-0000-4000-8000-000000000002','payfast_sandbox')),
  0,'no checkout is needed when credit covers the invoice');
select is(public.get_my_available_credit(),'30000','R300 of the R500 credit is left');
reset role;
select is((select status from public.invoices where id='12100000-0000-4000-8000-000000000002'),'paid','credit marks the invoice paid');
select is((select status from public.charges where id='c2100000-0000-4000-8000-000000000003'),'paid','and its charge paid');

-- Invoice 3: R550 recorded by staff as a manual payment; R300 credit is used first.
insert into public.charges(id,fencer_id,payer_id,type,amount,amount_cents,status,period,description,lifecycle_state) values
  ('c2100000-0000-4000-8000-000000000004','44444444-4444-4444-8444-444444444444','44444444-4444-4444-8444-444444444444','membership',550,55000,'unpaid','2030-03-01','George membership','finalized');
insert into public.invoices(id,payer_id,period,invoice_number,total) values
  ('12100000-0000-4000-8000-000000000003','44444444-4444-4444-8444-444444444444','2030-03-01','CFA-TEST-21C',550);
insert into public.invoice_lines(invoice_id,charge_id,description,amount,participant_id) values
  ('12100000-0000-4000-8000-000000000003','c2100000-0000-4000-8000-000000000004','George membership',550,'44444444-4444-4444-8444-444444444444');

set local role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
select ok(public.record_manual_invoice_payment('12100000-0000-4000-8000-000000000003'),'staff record the manual payment');
reset role;
select is((select amount_cents from public.receipts where invoice_id='12100000-0000-4000-8000-000000000003'),25000::bigint,
  'the receipt is for R250, the invoice less the credit');
select is((select status from public.invoices where id='12100000-0000-4000-8000-000000000003'),'paid','the invoice is paid');

select * from finish();
rollback;
