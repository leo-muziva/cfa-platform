begin;
select plan(22);

-- Uses synthetic seed actors and rolls everything back. 1111 is an admin and
-- 2222 a coach. 9800...01 is an ordinary (non-staff) payer made here.
insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data,raw_app_meta_data)
values('98000000-0000-4000-8000-000000000001','invoice-docs@cfa.test',now(),'{"full_name":"Invoice Docs Payer"}','{}');
update public.profiles set date_of_birth='1985-01-01', profile_completed_at=now()
where id='98000000-0000-4000-8000-000000000001';

-- ============================================================
-- Who generated each invoice
-- ============================================================
insert into public.charges(fencer_id,payer_id,type,amount,status,period,description,lifecycle_state)
values('98000000-0000-4000-8000-000000000001','98000000-0000-4000-8000-000000000001',
  'joining_fee',350,'unpaid',date_trunc('month',current_date)::date,'Joining fee','finalized');
select ok(public.generate_monthly_invoices(current_date)>=1,'a staff run bills the payer');
select is((select generated_by from public.invoices where payer_id='98000000-0000-4000-8000-000000000001' and sequence=1),
  'staff','a run without a source is recorded as staff');

insert into public.charges(fencer_id,payer_id,type,amount,status,period,description,lifecycle_state)
values('98000000-0000-4000-8000-000000000001','98000000-0000-4000-8000-000000000001',
  'joining_fee',100,'unpaid',(date_trunc('month',(now() at time zone 'Africa/Johannesburg')))::date,'Late addition','finalized');
select ok(public.run_scheduled_invoices()>=1,'the scheduled run bills the new charge');
select is((select generated_by from public.invoices where payer_id='98000000-0000-4000-8000-000000000001' and sequence=2),
  'schedule','the scheduled run is recorded as schedule');
select throws_ok($$select public.generate_monthly_invoices(current_date,'robot')$$,'P0001','invalid invoice source',
  'an unknown source is rejected');

-- ============================================================
-- Sending: claim, complete, release
-- ============================================================
select ok((select id from public.invoices where payer_id='98000000-0000-4000-8000-000000000001' and sequence=2)
  in (select * from public.list_unsent_scheduled_invoices()),'the unsent scheduled invoice is listed for the cron');
select ok((select id from public.invoices where payer_id='98000000-0000-4000-8000-000000000001' and sequence=1)
  not in (select * from public.list_unsent_scheduled_invoices()),'a staff invoice is never emailed by the cron');

create temp table doc_invoice as select id from public.invoices
  where payer_id='98000000-0000-4000-8000-000000000001' and sequence=2;
select is((select recipient_email from public.claim_invoice_email((select id from doc_invoice))),
  'invoice-docs@cfa.test','the claim returns the payer''s email');
select is((select count(*)::int from public.claim_invoice_email((select id from doc_invoice))),0,
  'a second sender cannot claim the same invoice');
select public.release_invoice_email((select id from doc_invoice));
select is((select count(*)::int from public.claim_invoice_email((select id from doc_invoice))),1,
  'a released claim can be taken again');
select public.complete_invoice_email((select id from doc_invoice));
select ok((select sent_at is not null and send_claimed_at is null from public.invoices where id=(select id from doc_invoice)),
  'completing records when it was sent');
select ok((select id from doc_invoice) not in (select * from public.list_unsent_scheduled_invoices()),
  'a sent invoice drops off the cron list');
select is((select count(*)::int from public.claim_invoice_email((select id from doc_invoice))),0,
  'a sent invoice is not claimed again by default');
select is((select count(*)::int from public.claim_invoice_email((select id from doc_invoice),true)),1,
  'staff may resend a sent invoice');

-- Only the server (service_role) may run the sending routines.
set local role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
select throws_ok($$select * from public.claim_invoice_email('98000000-0000-4000-8000-0000000000ff')$$,'42501',null,
  'even an admin session cannot claim directly');
select throws_ok($$select * from public.list_unsent_scheduled_invoices()$$,'42501',null,'signed-in users cannot list the cron queue');
reset role;
set local role anon;
select throws_ok($$select public.complete_invoice_email('98000000-0000-4000-8000-0000000000ff')$$,'42501',null,
  'anonymous cannot mark invoices sent');
reset role;

-- ============================================================
-- Club billing settings
-- ============================================================
set local role anon;
select throws_ok($$select * from public.club_billing_settings$$,'42501',null,'anonymous cannot read billing settings');
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','98000000-0000-4000-8000-000000000001',true);
select is((select club_name from public.club_billing_settings),'Cape Fencing Academy','members can read the details printed on invoices');
update public.club_billing_settings set bank_name='Member Bank';
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
select isnt((select bank_name from public.club_billing_settings),'Member Bank','a member cannot change the bank details');
update public.club_billing_settings set bank_name='Admin Bank';
select is((select bank_name from public.club_billing_settings),'Admin Bank','an admin can change the bank details');
select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);
update public.club_billing_settings set bank_name='Coach Bank';
select is((select bank_name from public.club_billing_settings),'Coach Bank','all staff handle finances, so a coach can too');
reset role;

select * from finish();
rollback;
