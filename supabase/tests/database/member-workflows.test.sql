begin;

select plan(43);

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
  where applicant_id = '90000000-0000-4000-8000-000000000001'), 'awaiting_payment',
  'approval waits for payment');
select is((select count(*)::integer from public.memberships
  where profile_id = '90000000-0000-4000-8000-000000000001'), 0,
  'approval alone does not create a membership');
select is((select membership_status from public.profiles
  where id = '90000000-0000-4000-8000-000000000001'), 'guest',
  'approval alone does not promote the profile');
select is((select count(*)::integer from public.charges
  where payer_id = '90000000-0000-4000-8000-000000000001' and type = 'membership'
    and lifecycle_state = 'provisional'), 1,
  'approval creates one provisional membership charge');
select is((select count(*)::integer from public.charges
  where payer_id = '90000000-0000-4000-8000-000000000001' and type = 'joining_fee'
    and lifecycle_state = 'provisional'), 1,
  'approval creates one provisional joining-fee charge');

set local role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
select is(public.record_manual_membership_payment(
  (select id from public.membership_applications
   where applicant_id = '90000000-0000-4000-8000-000000000001')), true,
  'staff record the applicant''s EFT payment');
reset role;

select is((select status from public.membership_applications
  where applicant_id = '90000000-0000-4000-8000-000000000001'), 'approved',
  'payment completes the approved application state');
select is((select status from public.memberships
  where profile_id = '90000000-0000-4000-8000-000000000001'), 'active',
  'payment persists an active membership');
select is((select membership_status from public.profiles
  where id = '90000000-0000-4000-8000-000000000001'), 'member',
  'payment promotes the profile to member status');
select is((select mt.code from public.profiles p join public.membership_types mt
  on mt.id = p.membership_type_id
  where p.id = '90000000-0000-4000-8000-000000000001'), 'month_to_month',
  'payment assigns the requested membership type to the profile');
select is((select count(*)::integer from public.charges
  where payer_id = '90000000-0000-4000-8000-000000000001'
    and type in ('membership', 'joining_fee') and status = 'paid'), 2,
  'payment settles both membership charges');
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

-- Booking requires a completed account profile; the applicant has finished it.
update public.profiles set profile_completed_at = now()
where id = '90000000-0000-4000-8000-000000000001';

-- Book a real slot through the current booking API: the seeded coach is
-- available 16:00-20:00 Africa/Johannesburg every day for foil.
set local role authenticated;
select set_config('request.jwt.claim.sub', '90000000-0000-4000-8000-000000000001', true);
select lives_ok($$select public.create_lesson_booking_v3(
  '22222222-2222-4222-8222-222222222222',
  ((current_date + 2) + time '19:30') at time zone 'Africa/Johannesburg',
  array['90000000-0000-4000-8000-000000000001']::uuid[], 'foil', 'pay_later')$$,
  'the member can book a lesson with pay later');
reset role;

select set_config('test.workflow_booking', (select bp.booking_id::text
  from public.booking_participants bp
  where bp.participant_id = '90000000-0000-4000-8000-000000000001'), true);
select is((select count(*)::integer from public.booking_participants
  where participant_id = '90000000-0000-4000-8000-000000000001'), 1,
  'pay later creates exactly one booking');
select is((select payment_option from public.bookings
  where id = current_setting('test.workflow_booking')::uuid), 'pay_later',
  'the booking retains the pay-later choice');
select is((select count(*)::integer from public.charges
  where booking_id = current_setting('test.workflow_booking')::uuid
    and type = 'lesson' and amount = 300), 1,
  'pay later creates exactly one lesson charge');
select is((select count(*)::integer from public.receipts r
  join public.payment_attempts a on a.id = r.payment_attempt_id
  where r.payer_id = '90000000-0000-4000-8000-000000000001'
    and a.membership_application_id is null), 0,
  'booking does not create a receipt before payment');
select is((select count(*)::integer from public.payment_attempts
  where payer_id = '90000000-0000-4000-8000-000000000001'
    and membership_application_id is null), 0,
  'booking does not create a payment attempt');
select is((select count(*) from public.provider_events),
  (select provider_event_count from workflow_test_baseline),
  'booking does not create a provider event');
select is((select sum(amount) from public.charges
  where payer_id = '90000000-0000-4000-8000-000000000001'),
  (select price + joining_fee + 300 from public.membership_types
   where code = 'month_to_month'),
  'the payer ledger totals membership, joining, and lesson costs');

-- A pay-later lesson becomes billable once it has happened. Move it into the
-- past (and the current billing month) and let the coach record attendance.
update public.bookings set starts_at = now() - interval '1 hour', ends_at = now() - interval '30 minutes'
where id = current_setting('test.workflow_booking')::uuid;
update public.charges set period = date_trunc('month', current_date)::date
where booking_id = current_setting('test.workflow_booking')::uuid;
set local role authenticated;
select set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', true);
select lives_ok($$select public.record_lesson_participant_outcome(
  current_setting('test.workflow_booking')::uuid,
  '90000000-0000-4000-8000-000000000001', 'attended')$$,
  'the coach records the lesson as attended');
reset role;

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
    and i.period = date_trunc('month', current_date)::date), 1,
  'the invoice contains only the unpaid lesson line');
select is((select count(*)::integer from public.invoice_lines il
  join public.invoices i on i.id = il.invoice_id
  where i.payer_id = '90000000-0000-4000-8000-000000000001'
    and il.participant_id = '90000000-0000-4000-8000-000000000001'), 1,
  'every invoice line identifies the charged participant');
select is((select total from public.invoices
  where payer_id = '90000000-0000-4000-8000-000000000001'
    and period = date_trunc('month', current_date)::date), 300::numeric,
  'the invoice total equals the unpaid lesson charge');
select is((select sum(il.amount) from public.invoice_lines il
  join public.invoices i on i.id = il.invoice_id
  where i.payer_id = '90000000-0000-4000-8000-000000000001'), 300::numeric,
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
  where i.payer_id = '90000000-0000-4000-8000-000000000001'), 1,
  'rerunning invoicing does not duplicate invoice lines');
select is((select total from public.invoices
  where payer_id = '90000000-0000-4000-8000-000000000001'
    and period = date_trunc('month', current_date)::date), 300::numeric,
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
