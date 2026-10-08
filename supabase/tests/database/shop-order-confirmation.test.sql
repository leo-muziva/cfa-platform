begin;
select plan(7);

-- 44444444 is the seeded guardian and payer.
insert into public.products(item_code,name,price,category,is_active)
values('TEST0042-P1','Synthetic training jacket',450.00,'Clothing',true);
insert into public.orders(id,user_id,status) values
  ('42420000-0000-4000-8000-000000000001','44444444-4444-4444-8444-444444444444','paid'),
  ('42420000-0000-4000-8000-000000000002','44444444-4444-4444-8444-444444444444','cancelled');
insert into public.order_items(order_id,product_id,quantity,size,unit_price) values
  ('42420000-0000-4000-8000-000000000001',(select id from public.products where item_code='TEST0042-P1'),2,'M',450.00);
insert into public.payment_attempts(payer_id,order_id,provider,provider_reference,status,amount,amount_cents) values
  ('44444444-4444-4444-8444-444444444444','42420000-0000-4000-8000-000000000001','payfast_sandbox','cfa-test-0042-paid','succeeded',900,90000),
  ('44444444-4444-4444-8444-444444444444','42420000-0000-4000-8000-000000000002','payfast_sandbox','cfa-test-0042-void','succeeded',900,90000);

set local role authenticated;
select set_config('request.jwt.claim.sub','44444444-4444-4444-8444-444444444444',true);
select throws_ok($$select * from public.claim_shop_order_confirmation('payfast_sandbox','cfa-test-0042-paid')$$,
  '42501',null,'a signed-in user cannot claim confirmation emails');
reset role;

set local role service_role;
select is((select total_cents from public.claim_shop_order_confirmation('payfast_sandbox','cfa-test-0042-paid')),
  90000::bigint,'the first notification claims the email with the order total');
select is((select count(*)::int from public.claim_shop_order_confirmation('payfast_sandbox','cfa-test-0042-paid')),
  0,'a repeated notification cannot send a second email');
select is((select count(*)::int from public.claim_shop_order_confirmation('payfast_sandbox','cfa-test-0042-void')),
  0,'a cancelled order is never confirmed');
select is((select count(*)::int from public.claim_shop_order_confirmation('payfast_sandbox','no-such-reference')),
  0,'an unknown payment reference claims nothing');
select lives_ok($$select public.release_shop_order_confirmation('42420000-0000-4000-8000-000000000001')$$,
  'a failed send releases the claim');
select is((select items->0->>'size' from public.claim_shop_order_confirmation('payfast_sandbox','cfa-test-0042-paid')),
  'M','after release the next notification can claim again, with item details');
reset role;
select * from finish();
rollback;
