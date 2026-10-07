begin;
select no_plan();

-- Membership is paid after approval and activates only once paid (0035).
-- Uses the synthetic seed actors; everything rolls back.
--   11111111 admin (is_staff, staff_type admin)   22222222 coach (staff, not admin)
--   33333333 dependent billed to 44444444         44444444 guardian and payer

create temporary table pay_after_approval_baseline as
select (select last_value from public.invoice_number_seq) as invoice_sequence_value,
  (select is_called from public.invoice_number_seq) as invoice_sequence_called;
grant all on pay_after_approval_baseline to authenticated, service_role;

-- Start both actors as guests with no open application, whatever earlier
-- local use left behind (rolled back with everything else).
update public.membership_applications set status='rejected'
  where applicant_id in ('33333333-3333-4333-8333-333333333333','44444444-4444-4444-8444-444444444444')
    and status in ('pending','changes_requested','awaiting_payment');
update public.memberships set status='cancelled',cancelled_at=now()
  where profile_id in ('33333333-3333-4333-8333-333333333333','44444444-4444-4444-8444-444444444444');
update public.profiles set membership_status='guest'
  where id in ('33333333-3333-4333-8333-333333333333','44444444-4444-4444-8444-444444444444');

-- ------------------------------------------------------------
-- A dependent applies and an admin approves
-- ------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claim.sub','33333333-3333-4333-8333-333333333333',true);
select lives_ok($$select public.submit_membership_application(
  (select id from public.membership_types where code='month_to_month'))$$,'the dependent can apply');
select set_config('test.dependent_app',(select id::text from public.membership_applications
  where applicant_id=auth.uid() and status='pending'),true);
select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);
select throws_ok($$select public.review_membership_application(current_setting('test.dependent_app')::uuid,'approve')$$,
  'P0001','forbidden','a coach cannot approve an application');
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
select lives_ok($$select public.review_membership_application(current_setting('test.dependent_app')::uuid,
  'approve','Welcome to CFA.')$$,'the admin can approve the application');
reset role;

select is((select status from public.membership_applications where id=current_setting('test.dependent_app')::uuid),
  'awaiting_payment','approval waits for payment');
select is((select count(*)::integer from public.memberships
  where profile_id='33333333-3333-4333-8333-333333333333' and status='active'),0,
  'approval does not activate the membership');
select is((select membership_status from public.profiles where id='33333333-3333-4333-8333-333333333333'),
  'guest','approval does not promote the profile');
select is((select count(*)::integer from public.charges where membership_application_id=current_setting('test.dependent_app')::uuid
  and lifecycle_state='provisional' and payer_id='44444444-4444-4444-8444-444444444444'),2,
  'approval creates provisional membership and joining-fee charges billed to the guardian');
select is((select count(*)::integer from public.audit_events
  where entity_id=current_setting('test.dependent_app')::uuid and event_type='membership.application_approved'),1,
  'approval is audited');

set local role authenticated;
select set_config('request.jwt.claim.sub','33333333-3333-4333-8333-333333333333',true);
select throws_ok($$select public.submit_membership_application(
  (select id from public.membership_types where code='six_month'))$$,'P0001','open application already exists',
  'no second application while one awaits payment');

-- The monthly run never invoices charges that still await payment.
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
select lives_ok($$select public.run_monthly_invoices(date_trunc('month',current_date)::date)$$,'the monthly run succeeds');
reset role;
select is((select count(*)::integer from public.invoice_lines l join public.charges c on c.id=l.charge_id
  where c.membership_application_id=current_setting('test.dependent_app')::uuid),0,
  'awaiting-payment charges are not invoiced');

-- ------------------------------------------------------------
-- Who can see and pay it
-- ------------------------------------------------------------
set local role anon;
select throws_ok($$select * from public.prepare_membership_checkout(current_setting('test.dependent_app')::uuid)$$,
  '42501',null,'anonymous cannot prepare a membership checkout');
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub','33333333-3333-4333-8333-333333333333',true);
select throws_ok($$select * from public.prepare_membership_checkout(current_setting('test.dependent_app')::uuid)$$,
  'P0001','forbidden','the dependent cannot pay');
select throws_ok($$select * from public.list_my_membership_payments_due()$$,
  'P0001','forbidden','the dependent cannot read membership amounts');
select is((select count(*)::integer from public.charges where membership_application_id=current_setting('test.dependent_app')::uuid),0,
  'the dependent cannot read the charges through RLS');
select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);
select throws_ok($$select * from public.prepare_membership_checkout(current_setting('test.dependent_app')::uuid)$$,
  'P0001','forbidden','another payer cannot pay someone else''s membership');
select is((select count(*)::integer from public.list_my_membership_payments_due()),0,
  'another payer sees nothing due');
select throws_ok($$select * from public.get_membership_payment_notice(current_setting('test.dependent_app')::uuid)$$,
  'P0001','forbidden','a coach cannot read the payment notice');

select set_config('request.jwt.claim.sub','44444444-4444-4444-8444-444444444444',true);
select is((select total_cents from public.list_my_membership_payments_due()
  where application_id=current_setting('test.dependent_app')::uuid),
  (select (round((price+joining_fee)*100))::bigint::text from public.membership_types where code='month_to_month'),
  'the guardian sees the total due for the dependent');
select throws_ok($$select * from public.get_membership_payment_notice(current_setting('test.dependent_app')::uuid)$$,
  'P0001','forbidden','the guardian cannot read the admin payment notice');
select throws_ok($$select * from public.prepare_membership_checkout(current_setting('test.dependent_app')::uuid,'live_card')$$,
  'P0001','invalid_input','unknown provider rejected');
select set_config('test.dependent_ref',(select provider_reference from public.prepare_membership_checkout(
  current_setting('test.dependent_app')::uuid)),true);
select is((select provider_reference from public.prepare_membership_checkout(current_setting('test.dependent_app')::uuid)),
  current_setting('test.dependent_ref'),'repeat prepare reuses the pending attempt');
select is((select description from public.get_payment_checkout((select id from public.payment_attempts
  where provider_reference=current_setting('test.dependent_ref')))),'CFA membership','checkout is described as membership');
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
select is((select payer_email from public.get_membership_payment_notice(current_setting('test.dependent_app')::uuid)),
  (select email from public.profiles where id='44444444-4444-4444-8444-444444444444'),
  'the admin payment notice addresses the guardian');
select lives_ok($$select public.record_membership_payment_email(current_setting('test.dependent_app')::uuid,'sent')$$,
  'the admin records the email outcome');
select throws_ok($$select public.record_membership_payment_email(current_setting('test.dependent_app')::uuid,'opened')$$,
  'P0001','invalid_input','unknown email outcomes are rejected');
reset role;
select is((select payment_email_status from public.membership_applications where id=current_setting('test.dependent_app')::uuid),
  'sent','the email outcome is stored');

-- ------------------------------------------------------------
-- Verified payment activates the membership
-- ------------------------------------------------------------
select set_config('test.dependent_cents',(select amount_cents::text from public.payment_attempts
  where provider_reference=current_setting('test.dependent_ref')),true);
set local role service_role;
select throws_ok($$select public.record_payment_event('payfast_sandbox','mem-bad-amount','mem-payment-1',
  current_setting('test.dependent_ref'),'succeeded',100,'ZAR')$$,'P0001','payment_mismatch','amount mismatch rejected');
select is(public.record_payment_event('payfast_sandbox','mem-success-1','mem-payment-1',
  current_setting('test.dependent_ref'),'succeeded',current_setting('test.dependent_cents')::bigint,'ZAR'),true,
  'a verified payment settles the membership');
select is(public.record_payment_event('payfast_sandbox','mem-success-1','mem-payment-1',
  current_setting('test.dependent_ref'),'succeeded',current_setting('test.dependent_cents')::bigint,'ZAR'),false,
  'a duplicate event is ignored');
reset role;

select is((select status from public.membership_applications where id=current_setting('test.dependent_app')::uuid),
  'approved','payment completes the application');
select is((select status from public.memberships where profile_id='33333333-3333-4333-8333-333333333333'),
  'active','payment activates the membership');
select is((select membership_status from public.profiles where id='33333333-3333-4333-8333-333333333333'),
  'member','payment promotes the dependent to member');
select is((select count(*)::integer from public.charges where membership_application_id=current_setting('test.dependent_app')::uuid
  and status='paid' and lifecycle_state='finalized'),2,'both charges are finalized and paid');
select is((select count(*)::integer from public.receipts r join public.payment_attempts a on a.id=r.payment_attempt_id
  where a.provider_reference=current_setting('test.dependent_ref')),1,'one receipt is issued');
select is((select count(*)::integer from public.ledger_credits c join public.payment_attempts a on a.id=c.payment_attempt_id
  where a.provider_reference=current_setting('test.dependent_ref')),0,'an exact payment leaves no credit');

set local role authenticated;
select set_config('request.jwt.claim.sub','44444444-4444-4444-8444-444444444444',true);
select is((select kind from public.get_payment_status((select id from public.payment_attempts
  where provider_reference=current_setting('test.dependent_ref')))),'membership','payment status reports a membership');
select is((select kind from public.list_refundable_payments() where attempt_id=(select id from public.payment_attempts
  where provider_reference=current_setting('test.dependent_ref'))),'membership','refunds list the payment as a membership');
select is((select count(*)::integer from public.list_my_membership_payments_due()
  where application_id=current_setting('test.dependent_app')::uuid),0,'nothing is due once paid');

-- ------------------------------------------------------------
-- A withdrawn approval keeps a late payment as credit
-- ------------------------------------------------------------
select lives_ok($$select public.submit_membership_application(
  (select id from public.membership_types where code='month_to_month'))$$,'the guardian applies for themselves');
select set_config('test.guardian_app',(select id::text from public.membership_applications
  where applicant_id=auth.uid() and status='pending'),true);
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
select lives_ok($$select public.review_membership_application(current_setting('test.guardian_app')::uuid,'approve')$$,
  'the admin approves the guardian');
select set_config('request.jwt.claim.sub','44444444-4444-4444-8444-444444444444',true);
select set_config('test.guardian_ref',(select provider_reference from public.prepare_membership_checkout(
  current_setting('test.guardian_app')::uuid)),true);
select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);
select throws_ok($$select public.withdraw_membership_approval(current_setting('test.guardian_app')::uuid)$$,
  'P0001','forbidden','a coach cannot withdraw an approval');
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
select lives_ok($$select public.withdraw_membership_approval(current_setting('test.guardian_app')::uuid,'Please contact us.')$$,
  'the admin withdraws the approval');
reset role;

select is((select status from public.membership_applications where id=current_setting('test.guardian_app')::uuid),
  'rejected','withdrawal closes the application');
select is((select count(*)::integer from public.charges where membership_application_id=current_setting('test.guardian_app')::uuid
  and lifecycle_state='voided'),2,'withdrawal voids the charges');
select is((select status from public.payment_attempts where provider_reference=current_setting('test.guardian_ref')),
  'failed','withdrawal fails the open checkout');

select set_config('test.guardian_cents',(select amount_cents::text from public.payment_attempts
  where provider_reference=current_setting('test.guardian_ref')),true);
set local role service_role;
select is(public.record_payment_event('payfast_sandbox','mem-late-1','mem-payment-late',
  current_setting('test.guardian_ref'),'succeeded',current_setting('test.guardian_cents')::bigint,'ZAR'),true,
  'a late payment is still recorded');
reset role;
select is((select membership_status from public.profiles where id='44444444-4444-4444-8444-444444444444'),
  'guest','a late payment does not activate a withdrawn approval');
select is((select c.amount_cents from public.ledger_credits c join public.payment_attempts a on a.id=c.payment_attempt_id
  where a.provider_reference=current_setting('test.guardian_ref')),current_setting('test.guardian_cents')::bigint,
  'a late payment becomes account credit');

-- ------------------------------------------------------------
-- Re-approval in the same month and a manual EFT payment
-- ------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claim.sub','44444444-4444-4444-8444-444444444444',true);
select lives_ok($$select public.submit_membership_application(
  (select id from public.membership_types where code='month_to_month'))$$,'the guardian can apply again');
select set_config('test.guardian_app2',(select id::text from public.membership_applications
  where applicant_id=auth.uid() and status='pending'),true);
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
select lives_ok($$select public.review_membership_application(current_setting('test.guardian_app2')::uuid,'approve')$$,
  'a voided charge does not block re-approval in the same month');
select set_config('request.jwt.claim.sub','44444444-4444-4444-8444-444444444444',true);
select throws_ok($$select public.record_manual_membership_payment(current_setting('test.guardian_app2')::uuid)$$,
  'P0001','forbidden','a non-staff payer cannot record a manual payment');
select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);
select is(public.record_manual_membership_payment(current_setting('test.guardian_app2')::uuid),true,
  'any active staff member can record an EFT payment');
select is(public.record_manual_membership_payment(current_setting('test.guardian_app2')::uuid),false,
  'recording the same payment twice changes nothing');
reset role;

select is((select membership_status from public.profiles where id='44444444-4444-4444-8444-444444444444'),
  'member','a manual payment activates the membership');
select is((select count(*)::integer from public.charges where membership_application_id=current_setting('test.guardian_app2')::uuid
  and status='paid'),2,'a manual payment pays both charges');
select is((select count(*)::integer from public.receipts r join public.payment_attempts a on a.id=r.payment_attempt_id
  where a.membership_application_id=current_setting('test.guardian_app2')::uuid and a.provider='manual'),1,
  'a manual payment issues one receipt');
select is((select count(*)::integer from public.audit_events
  where entity_id=current_setting('test.guardian_app2')::uuid and event_type='membership.activated'),1,
  'activation is audited');

-- ------------------------------------------------------------
-- Rejoining in a month whose dues are already charged
-- ------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claim.sub','44444444-4444-4444-8444-444444444444',true);
select lives_ok($$select public.change_membership_status('44444444-4444-4444-8444-444444444444','cancelled')$$,
  'the guardian cancels the membership');
select lives_ok($$select public.submit_membership_application(
  (select id from public.membership_types where code='month_to_month'))$$,'the guardian rejoins in the same month');
select set_config('test.guardian_app3',(select id::text from public.membership_applications
  where applicant_id=auth.uid() and status='pending'),true);
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
select lives_ok($$select public.review_membership_application(current_setting('test.guardian_app3')::uuid,'approve')$$,
  'approving a same-month rejoin does not collide with the charged month');
reset role;
select ok((select c.period>date_trunc('month',(now() at time zone 'Africa/Johannesburg'))::date
  and not exists(select 1 from public.charges o where o.fencer_id=c.fencer_id and o.type='membership'
    and o.period=c.period and o.lifecycle_state<>'voided' and o.id<>c.id)
  from public.charges c where c.membership_application_id=current_setting('test.guardian_app3')::uuid and c.type='membership'),
  'the rejoined membership is billed from the first uncharged month');

do $$
declare baseline pay_after_approval_baseline%rowtype;
begin
  select * into baseline from pay_after_approval_baseline;
  perform setval('public.invoice_number_seq', baseline.invoice_sequence_value, baseline.invoice_sequence_called);
end $$;

select * from finish();
rollback;
