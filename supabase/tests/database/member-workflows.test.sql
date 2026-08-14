begin;

select plan(37);

create temporary table workflow_test_baseline as
select
  (select count(*) from public.provider_events) as provider_event_count,
  (select last_value from public.invoice_number_seq) as invoice_sequence_value,
  (select is_called from public.invoice_number_seq) as invoice_sequence_called;

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_super_admin,
  confirmation_token, recovery_token, email_change_token_new, email_change,
  email_change_token_current, phone_change, phone_change_token, reauthentication_token
) values (
  '90000000-0000-4000-8000-000000000001',
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'workflow-applicant@cfa.test',
  crypt('Workflow123!', gen_salt('bf')), null, now(), now(),
  '{"provider":"email","providers":["email"]}',
  '{"full_name":"Workflow Applicant"}',
  false, '', '', '', '', '', '', '', ''
);

select is((select count(*)::integer from public.profiles
  where id = '90000000-0000-4000-8000-000000000001'), 0,
  'an unconfirmed auth account has no application profile');
select is((select count(*)::integer from public.households
  where payer_id = '90000000-0000-4000-8000-000000000001'), 0,
  'an unconfirmed auth account has no household');

update auth.users set email_confirmed_at = now(), updated_at = now()
where id = '90000000-0000-4000-8000-000000000001';

select is((select count(*)::integer from public.profiles
  where id = '90000000-0000-4000-8000-000000000001'
    and email = 'workflow-applicant@cfa.test'
    and full_name = 'Workflow Applicant' and membership_status = 'guest'), 1,
  'email confirmation persists one guest profile');
select is((select count(*)::integer from public.households
  where payer_id = '90000000-0000-4000-8000-000000000001'), 1,
  'email confirmation persists one household');
select is((select count(*)::integer from public.household_members hm
  join public.households h on h.id = hm.household_id
  where h.payer_id = '90000000-0000-4000-8000-000000000001'
    and hm.profile_id = h.payer_id and hm.household_role = 'payer'), 1,
  'the confirmed account is the sole payer member of its household');

set local role authenticated;
select set_config('request.jwt.claim.sub', '90000000-0000-4000-8000-000000000001', true);
select lives_ok($$select public.submit_membership_application(
  (select id from public.membership_types where code = 'month_to_month'))$$,
  'the applicant can submit a membership application');
reset role;

select is((select count(*)::integer from public.membership_applications
  where applicant_id = '90000000-0000-4000-8000-000000000001'
    and status = 'pending' and version = 1), 1,
  'submission persists exactly one pending application');
select is((select count(*)::integer from public.audit_events
  where actor_id = '90000000-0000-4000-8000-000000000001'
    and subject_profile_id = '90000000-0000-4000-8000-000000000001'
    and event_type = 'membership.application_submitted'), 1,
  'submission persists its audit event');

set local role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
select lives_ok($$select public.review_membership_application(
  (select id from public.membership_applications
   where applicant_id = '90000000-0000-4000-8000-000000000001'),
  'approve', 'Welcome to CFA.', 'Workflow test private note')$$,
  'the seeded administrator can approve the application');
reset role;

select is((select status from public.membership_applications
  where applicant_id = '90000000-0000-4000-8000-000000000001'), 'approved',
  'approval persists the approved application state');
select is((select status from public.memberships
  where profile_id = '90000000-0000-4000-8000-000000000001'), 'active',
  'approval persists an active membership');
select is((select membership_status from public.profiles
  where id = '90000000-0000-4000-8000-000000000001'), 'member',
  'approval promotes the profile to member status');
select is((select mt.code from public.profiles p join public.membership_types mt
  on mt.id = p.membership_type_id
  where p.id = '90000000-0000-4000-8000-000000000001'), 'month_to_month',
  'approval assigns the requested membership type to the profile');
select is((select count(*)::integer from public.charges
  where payer_id = '90000000-0000-4000-8000-000000000001' and type = 'membership'), 1,
  'approval creates one membership charge');
select is((select count(*)::integer from public.charges
  where payer_id = '90000000-0000-4000-8000-000000000001' and type = 'joining_fee'), 1,
  'approval creates one joining-fee charge');
select is((select sum(c.amount) from public.charges c
  where c.payer_id = '90000000-0000-4000-8000-000000000001'
    and c.type in ('membership', 'joining_fee')),
  (select mt.price + mt.joining_fee from public.membership_types mt
   where mt.code = 'month_to_month'),
  'initial charge amounts equal the selected product price and joining fee');
select is((select count(*)::integer from public.audit_events
  where actor_id = '11111111-1111-4111-8111-111111111111'
    and subject_profile_id = '90000000-0000-4000-8000-000000000001'
    and event_type = 'membership.application_approved'), 1,
  'approval persists an administrator audit event');
select is((select count(*)::integer from public.membership_application_admin_notes n
  join public.membership_applications a on a.id = n.application_id
  where a.applicant_id = '90000000-0000-4000-8000-000000000001'
    and n.private_notes = 'Workflow test private note'
    and n.updated_by = '11111111-1111-4111-8111-111111111111'), 1,
  'approval persists the private note in the admin-only store');

set local role authenticated;
select set_config('request.jwt.claim.sub', '90000000-0000-4000-8000-000000000001', true);
select is((select count(*)::integer from public.membership_application_admin_notes), 0,
  'the applicant cannot retrieve administrator private notes through RLS');
reset role;

insert into public.lesson_slots (
  id, starts_at, ends_at, coach_id, capacity, price, is_open, access_rule, created_by
) values (
  '90000000-0000-4000-8000-000000000002', now() + interval '1 hour',
  now() + interval '2 hours', '22222222-2222-4222-8222-222222222222',
  4, 300, true, 'guest_allowed', '11111111-1111-4111-8111-111111111111'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '90000000-0000-4000-8000-000000000001', true);
select lives_ok($$select public.create_lesson_booking(
  '90000000-0000-4000-8000-000000000002',
  '90000000-0000-4000-8000-000000000001', 'pay_later')$$,
  'the member can book a lesson with pay later');
reset role;

select is((select count(*)::integer from public.bookings
  where lesson_slot_id = '90000000-0000-4000-8000-000000000002'
    and fencer_id = '90000000-0000-4000-8000-000000000001'), 1,
  'pay later creates exactly one booking');
select is((select payment_option from public.bookings
  where lesson_slot_id = '90000000-0000-4000-8000-000000000002'
    and fencer_id = '90000000-0000-4000-8000-000000000001'), 'pay_later',
  'the booking retains the pay-later choice');
select is((select count(*)::integer from public.charges c
  join public.bookings b on b.id = c.booking_id
  where b.lesson_slot_id = '90000000-0000-4000-8000-000000000002'
    and b.fencer_id = '90000000-0000-4000-8000-000000000001'
    and c.type = 'lesson' and c.amount = 300), 1,
  'pay later creates exactly one lesson charge');
select is((select count(*)::integer from public.receipts
  where payer_id = '90000000-0000-4000-8000-000000000001'), 0,
  'booking does not create a receipt before payment');
select is((select count(*)::integer from public.payment_attempts
  where payer_id = '90000000-0000-4000-8000-000000000001'), 0,
  'booking does not create a payment attempt');
select is((select count(*) from public.provider_events),
  (select provider_event_count from workflow_test_baseline),
  'booking does not create a provider event');
select is((select sum(amount) from public.charges
  where payer_id = '90000000-0000-4000-8000-000000000001'),
  (select price + joining_fee + 300 from public.membership_types
   where code = 'month_to_month'),
  'the payer ledger totals membership, joining, and lesson costs');

set local role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
select lives_ok($$select public.run_monthly_invoices(
  date_trunc('month', current_date)::date)$$,
  'the administrator can generate the current-period invoice');
reset role;

select is((select count(*)::integer from public.invoices
  where payer_id = '90000000-0000-4000-8000-000000000001'
    and period = date_trunc('month', current_date)::date), 1,
  'invoicing creates one payer invoice');
select is((select count(*)::integer from public.invoice_lines il
  join public.invoices i on i.id = il.invoice_id
  where i.payer_id = '90000000-0000-4000-8000-000000000001'
    and i.period = date_trunc('month', current_date)::date), 3,
  'the invoice contains membership, joining-fee, and lesson lines');
select is((select count(*)::integer from public.invoice_lines il
  join public.invoices i on i.id = il.invoice_id
  where i.payer_id = '90000000-0000-4000-8000-000000000001'
    and il.participant_id = '90000000-0000-4000-8000-000000000001'), 3,
  'every invoice line identifies the charged participant');
select is((select total from public.invoices
  where payer_id = '90000000-0000-4000-8000-000000000001'
    and period = date_trunc('month', current_date)::date),
  (select price + joining_fee + 300 from public.membership_types
   where code = 'month_to_month'),
  'the invoice total equals all eligible payer charges');
select is((select sum(il.amount) from public.invoice_lines il
  join public.invoices i on i.id = il.invoice_id
  where i.payer_id = '90000000-0000-4000-8000-000000000001'),
  (select price + joining_fee + 300 from public.membership_types
   where code = 'month_to_month'),
  'invoice line amounts reconcile to the expected total');

set local role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
select lives_ok($$select public.run_monthly_invoices(
  date_trunc('month', current_date)::date)$$, 'rerunning invoicing succeeds');
reset role;

select is((select count(*)::integer from public.invoices
  where payer_id = '90000000-0000-4000-8000-000000000001'
    and period = date_trunc('month', current_date)::date), 1,
  'rerunning invoicing does not duplicate the invoice');
select is((select count(*)::integer from public.invoice_lines il
  join public.invoices i on i.id = il.invoice_id
  where i.payer_id = '90000000-0000-4000-8000-000000000001'), 3,
  'rerunning invoicing does not duplicate invoice lines');
select is((select total from public.invoices
  where payer_id = '90000000-0000-4000-8000-000000000001'
    and period = date_trunc('month', current_date)::date),
  (select price + joining_fee + 300 from public.membership_types
   where code = 'month_to_month'),
  'rerunning invoicing preserves the reconciled total');

do $$
declare baseline workflow_test_baseline%rowtype;
begin
  select * into baseline from workflow_test_baseline;
  perform setval('public.invoice_number_seq', baseline.invoice_sequence_value,
    baseline.invoice_sequence_called);
end $$;

select * from finish();
rollback;
