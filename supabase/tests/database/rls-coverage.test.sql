begin;
select no_plan();

-- Every public table is behind RLS with at least one policy, and the
-- financial tables most at risk are closed to anonymous visitors.
-- Synthetic seed actors plus one synthetic payer; everything rolls back.
--   11111111 admin staff   22222222 coach staff
--   33333333 dependent     44444444 guardian payer   77777777 synthetic payer

-- ============================================================
-- Catalogue checks
-- ============================================================
select is(
  (select coalesce(array_agg(tablename::text order by tablename), '{}') from pg_tables
    where schemaname = 'public' and not rowsecurity),
  '{}'::text[],
  'every public table has row level security enabled');

-- Tables allowed to have RLS without any policy (deny-all to clients). Add a
-- table here only with a written reason. Currently none.
select is(
  (select coalesce(array_agg(t.tablename::text order by t.tablename), '{}') from pg_tables t
    where t.schemaname = 'public'
      and t.tablename not in (select unnest('{}'::text[]))
      and not exists (select 1 from pg_policies p
        where p.schemaname = 'public' and p.tablename = t.tablename)),
  '{}'::text[],
  'every public table has at least one policy');

-- ============================================================
-- Fixtures: one manually paid invoice each for two payers
-- ============================================================
insert into auth.users(id,instance_id,aud,role,email,email_confirmed_at,raw_app_meta_data,raw_user_meta_data)
values('77777777-7777-4777-8777-777777777777','00000000-0000-0000-0000-000000000000','authenticated','authenticated',
  'rls.other.payer@cfa.test',now(),'{}','{"full_name":"Olive Other"}');
insert into public.charges(id,fencer_id,payer_id,type,amount_cents,status,period,description,lifecycle_state) values
  ('3c300000-0000-4000-8000-0000000000c1','44444444-4444-4444-8444-444444444444','44444444-4444-4444-8444-444444444444',
    'membership',55000,'unpaid','2093-01-01','Synthetic guardian charge','finalized'),
  ('3c300000-0000-4000-8000-0000000000c2','77777777-7777-4777-8777-777777777777','77777777-7777-4777-8777-777777777777',
    'membership',55000,'unpaid','2093-01-01','Synthetic other payer charge','finalized');
insert into public.invoices(id,payer_id,period,total) values
  ('3c300000-0000-4000-8000-0000000000f1','44444444-4444-4444-8444-444444444444','2093-01-01',550),
  ('3c300000-0000-4000-8000-0000000000f2','77777777-7777-4777-8777-777777777777','2093-01-01',550);
insert into public.invoice_lines(invoice_id,charge_id,participant_id,description,amount) values
  ('3c300000-0000-4000-8000-0000000000f1','3c300000-0000-4000-8000-0000000000c1',
    '44444444-4444-4444-8444-444444444444','Synthetic guardian charge',550),
  ('3c300000-0000-4000-8000-0000000000f2','3c300000-0000-4000-8000-0000000000c2',
    '77777777-7777-4777-8777-777777777777','Synthetic other payer charge',550);

set local role authenticated;
select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);
select is(public.record_manual_invoice_payment('3c300000-0000-4000-8000-0000000000f1'),true,'guardian invoice paid');
select is(public.record_manual_invoice_payment('3c300000-0000-4000-8000-0000000000f2'),true,'other payer invoice paid');
reset role;
select set_config('test.g_attempt',(select id::text from public.payment_attempts
  where invoice_id='3c300000-0000-4000-8000-0000000000f1'),true);
select set_config('test.o_attempt',(select id::text from public.payment_attempts
  where invoice_id='3c300000-0000-4000-8000-0000000000f2'),true);
select set_config('test.guardian_allocations',(select count(*)::text from public.payment_allocations pa
  join public.payment_attempts a on a.id=pa.payment_attempt_id
  where a.payer_id='44444444-4444-4444-8444-444444444444'),true);
select set_config('test.all_allocations',(select count(*)::text from public.payment_allocations),true);

-- ============================================================
-- Anonymous visitors
-- ============================================================
set local role anon;
select throws_ok($$select count(*) from public.bulk_orders$$,'42501',null,'anonymous cannot read bulk orders');
select throws_ok($$select count(*) from public.refund_requests$$,'42501',null,'anonymous cannot read refund requests');
select throws_ok($$select count(*) from public.payment_allocations$$,'42501',null,'anonymous cannot read payment allocations');
select lives_ok($$select * from public.get_collecting_bulk_progress()$$,'anonymous still reads pooled bulk progress');
reset role;

-- ============================================================
-- Payment allocations for signed-in users
-- ============================================================
set local role authenticated;
select set_config('request.jwt.claim.sub','44444444-4444-4444-8444-444444444444',true);
select is((select count(*)::integer from public.payment_allocations
  where payment_attempt_id=current_setting('test.g_attempt')::uuid),1,'guardian reads own payment allocation');
select is((select count(*)::integer from public.payment_allocations
  where payment_attempt_id=current_setting('test.o_attempt')::uuid),0,'guardian cannot read another payer''s allocation');
select is((select count(*)::text from public.payment_allocations),current_setting('test.guardian_allocations'),
  'guardian reads only allocations of own payments');
select throws_ok($$insert into public.payment_allocations(payment_attempt_id,charge_id,amount_cents)
  values(current_setting('test.g_attempt')::uuid,'3c300000-0000-4000-8000-0000000000c1',1)$$,
  '42501',null,'guardian cannot write allocations directly');

select set_config('request.jwt.claim.sub','77777777-7777-4777-8777-777777777777',true);
select is((select count(*)::integer from public.payment_allocations),1,'other payer reads only own allocation');

select set_config('request.jwt.claim.sub','33333333-3333-4333-8333-333333333333',true);
select is((select count(*)::integer from public.payment_allocations),0,'dependent reads no allocations');

select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);
select is((select count(*)::text from public.payment_allocations),current_setting('test.all_allocations'),
  'staff read every allocation');
reset role;

select * from finish();
rollback;
