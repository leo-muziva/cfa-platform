begin;
select plan(8);

-- 44444444 is the seeded guardian and payer.
insert into public.invoices(id,payer_id,period,total)
values('44440000-0000-4000-8000-000000000001','44444444-4444-4444-8444-444444444444',date '2001-01-01',300);
insert into public.payment_attempts(id,payer_id,invoice_id,provider,provider_reference,status,amount,amount_cents) values
  ('44440000-0000-4000-8000-000000000010','44444444-4444-4444-8444-444444444444','44440000-0000-4000-8000-000000000001','payfast_sandbox','cfa-test-0044-paid','succeeded',300,30000),
  ('44440000-0000-4000-8000-000000000011','44444444-4444-4444-8444-444444444444','44440000-0000-4000-8000-000000000001','payfast_sandbox','cfa-test-0044-pending','pending',300,30000);
insert into public.receipts(payer_id,invoice_id,amount,payment_attempt_id)
values('44444444-4444-4444-8444-444444444444','44440000-0000-4000-8000-000000000001',300,'44440000-0000-4000-8000-000000000010');

set local role authenticated;
select set_config('request.jwt.claim.sub','44444444-4444-4444-8444-444444444444',true);
select throws_ok($$select * from public.claim_payment_receipt('payfast_sandbox','cfa-test-0044-paid')$$,
  '42501',null,'a signed-in user cannot claim receipt emails');
select ok((select receipt_number from public.get_payment_status('44440000-0000-4000-8000-000000000010')) like 'REC-%',
  'the payer''s status page gets the receipt number');
reset role;

set local role service_role;
select results_eq(
  $$select kind,amount_cents,description,receipt_number like 'REC-%' from public.claim_payment_receipt('payfast_sandbox','cfa-test-0044-paid')$$,
  $$select 'invoice'::text,30000::bigint,'Invoice '||(select invoice_number from public.invoices where id='44440000-0000-4000-8000-000000000001'),true$$,
  'the first notification claims the receipt with the amount and what was paid');
select is((select count(*)::int from public.claim_payment_receipt('payfast_sandbox','cfa-test-0044-paid')),
  0,'a repeated notification cannot send a second receipt');
select is((select count(*)::int from public.claim_payment_receipt('payfast_sandbox','cfa-test-0044-pending')),
  0,'an unsettled payment has no receipt');
select is((select count(*)::int from public.claim_payment_receipt('payfast_sandbox','no-such-reference')),
  0,'an unknown payment reference claims nothing');
select lives_ok($$select public.release_payment_receipt('44440000-0000-4000-8000-000000000010')$$,
  'a failed send releases the claim');
select is((select count(*)::int from public.claim_payment_receipt('payfast_sandbox','cfa-test-0044-paid')),
  1,'after release the next notification can claim again');
reset role;
select * from finish();
rollback;
