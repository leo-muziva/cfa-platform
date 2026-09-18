-- =============================================================
-- CFA Platform — Development Seed Data
-- =============================================================
-- FOR LOCAL SUPABASE ONLY (supabase start + supabase db seed)
--
-- For hosted Supabase:
--   1. Create accounts via Supabase Dashboard → Authentication → Users
--   2. Run only the UPDATE statements below (lines marked [HOSTED])
--
-- All test account passwords: Test1234!
-- =============================================================

-- [LOCAL ONLY] Insert test users into auth.users
-- The on_auth_user_created trigger auto-creates the profiles rows.
insert into auth.users (
  id,
  instance_id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  raw_app_meta_data,
  raw_user_meta_data,
  is_super_admin,
  confirmation_token,
  recovery_token,
  email_change_token_new,
  email_change,
  email_change_token_current,
  phone_change,
  phone_change_token,
  reauthentication_token
)
values
  (
    '11111111-1111-4111-8111-111111111111',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated',
    'admin@cfa.test',
    crypt('Test1234!', gen_salt('bf')),
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Alice Admin"}',
    false, '', '', '', '', '', '', '', ''
  ),
  (
    '22222222-2222-4222-8222-222222222222',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated',
    'coach@cfa.test',
    crypt('Test1234!', gen_salt('bf')),
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Dr. Misha Galukhin"}',
    false, '', '', '', '', '', '', '', ''
  ),
  (
    '33333333-3333-4333-8333-333333333333',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated',
    'fencer@cfa.test',
    crypt('Test1234!', gen_salt('bf')),
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Fiona Fencer"}',
    false, '', '', '', '', '', '', '', ''
  ),
  (
    '44444444-4444-4444-8444-444444444444',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated',
    'guardian@cfa.test',
    crypt('Test1234!', gen_salt('bf')),
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"George Guardian"}',
    false, '', '', '', '', '', '', '', ''
  );

-- [LOCAL ONLY] Extra homepage coaches for booking-directory coverage.
insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_super_admin,
  confirmation_token, recovery_token, email_change_token_new, email_change,
  email_change_token_current, phone_change, phone_change_token, reauthentication_token
) values
  ('55555555-5555-4555-8555-555555555555', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'jacques@cfa.test', crypt('Test1234!', gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Jacques Viljoen"}', false, '', '', '', '', '', '', '', ''),
  ('66666666-6666-4666-8666-666666666666', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'jeremy@cfa.test', crypt('Test1234!', gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Jeremy Saner"}', false, '', '', '', '', '', '', '', '');
-- [HOSTED + LOCAL] Set staff type, names, and phone numbers on the auto-created profiles.
-- These UUIDs must match the auth.users IDs above (local) or the real UUIDs from
-- Supabase Dashboard (hosted).
update public.profiles set
  membership_status = 'guest',
  is_staff          = true,
  staff_type        = 'admin',
  full_name         = 'Alice Admin',
  phone             = '+27 21 000 0001',
  is_active         = true
where id = '11111111-1111-4111-8111-111111111111';

update public.profiles set
  membership_status = 'guest',
  is_staff          = true,
  staff_type        = 'coach',
  full_name         = 'Dr. Misha Galukhin',
  phone             = '+27 21 000 0002',
  is_active         = true
where id = '22222222-2222-4222-8222-222222222222';

update public.profiles set
  membership_status = 'guest', is_staff = true, staff_type = 'coach',
  full_name = 'Jacques Viljoen', phone = '+27 21 000 0005', is_active = true
where id = '55555555-5555-4555-8555-555555555555';

update public.profiles set
  membership_status = 'guest', is_staff = true, staff_type = 'coach',
  full_name = 'Jeremy Saner', phone = '+27 21 000 0006', is_active = true
where id = '66666666-6666-4666-8666-666666666666';
update public.profiles set
  membership_status  = 'guest',
  is_staff           = false,
  staff_type         = null,
  full_name          = 'Fiona Fencer',
  phone              = '+27 21 000 0003',
  date_of_birth      = '2005-03-15',
  is_active          = true,
  membership_type_id = null
where id = '33333333-3333-4333-8333-333333333333';

update public.profiles set
  membership_status  = 'guest',
  is_staff           = false,
  staff_type         = null,
  full_name          = 'George Guardian',
  phone              = '+27 21 000 0004',
  is_active          = true,
  membership_type_id = null
where id = '44444444-4444-4444-8444-444444444444';

-- Make the guardian/fencer pair exercise payer and dependent permissions.
-- The profile trigger initially creates a household of one for each account.
delete from public.household_members
where profile_id = '33333333-3333-4333-8333-333333333333';

delete from public.households
where payer_id = '33333333-3333-4333-8333-333333333333';

insert into public.household_members (
  household_id,
  profile_id,
  household_role,
  payer_consent_at
)
select
  id,
  '33333333-3333-4333-8333-333333333333',
  'dependent',
  now()
from public.households
where payer_id = '44444444-4444-4444-8444-444444444444';

insert into public.family_links (
  guardian_id, dependent_id, status, requested_by, accepted_by, requested_at, accepted_at
)
select
  '44444444-4444-4444-8444-444444444444',
  '33333333-3333-4333-8333-333333333333',
  'active',
  '44444444-4444-4444-8444-444444444444',
  '33333333-3333-4333-8333-333333333333',
  now(),
  now()
where not exists (
  select 1 from public.family_links
  where guardian_id = '44444444-4444-4444-8444-444444444444'
    and dependent_id = '33333333-3333-4333-8333-333333333333'
    and status in ('pending', 'active')
);

insert into public.dependent_billing_links (
  household_id, guardian_id, dependent_id, family_link_id, effective_from
)
select
  h.id,
  '44444444-4444-4444-8444-444444444444',
  '33333333-3333-4333-8333-333333333333',
  fl.id,
  now()
from public.households h
join public.family_links fl on fl.guardian_id = h.payer_id
  and fl.dependent_id = '33333333-3333-4333-8333-333333333333'
  and fl.status = 'active'
where h.payer_id = '44444444-4444-4444-8444-444444444444'
  and not exists (
    select 1 from public.dependent_billing_links dbl
    where dbl.dependent_id = '33333333-3333-4333-8333-333333333333'
      and dbl.effective_to is null
  );
-- [LOCAL ONLY] Relative future lesson slots keep the public calendar usable
-- after every local database reset. Hosted lessons are created by admins.
insert into public.lesson_slots (
  id,
  starts_at,
  ends_at,
  coach_id,
  capacity,
  price,
  is_open,
  access_rule,
  created_by
)
values
  (
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
    (date_trunc('day', now() at time zone 'Africa/Johannesburg') + interval '1 day 18 hours 30 minutes') at time zone 'Africa/Johannesburg',
    (date_trunc('day', now() at time zone 'Africa/Johannesburg') + interval '1 day 19 hours 30 minutes') at time zone 'Africa/Johannesburg',
    '22222222-2222-4222-8222-222222222222', 6, 300, true, 'guest_allowed',
    '11111111-1111-4111-8111-111111111111'
  ),
  (
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2',
    (date_trunc('day', now() at time zone 'Africa/Johannesburg') + interval '1 day 19 hours 45 minutes') at time zone 'Africa/Johannesburg',
    (date_trunc('day', now() at time zone 'Africa/Johannesburg') + interval '1 day 20 hours 45 minutes') at time zone 'Africa/Johannesburg',
    '22222222-2222-4222-8222-222222222222', 4, 350, true, 'guest_allowed',
    '11111111-1111-4111-8111-111111111111'
  ),
  (
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3',
    (date_trunc('day', now() at time zone 'Africa/Johannesburg') + interval '3 days 18 hours 30 minutes') at time zone 'Africa/Johannesburg',
    (date_trunc('day', now() at time zone 'Africa/Johannesburg') + interval '3 days 19 hours 30 minutes') at time zone 'Africa/Johannesburg',
    '22222222-2222-4222-8222-222222222222', 6, 300, true, 'guest_allowed',
    '11111111-1111-4111-8111-111111111111'
  ),
  (
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4',
    (date_trunc('day', now() at time zone 'Africa/Johannesburg') + interval '5 days 18 hours 30 minutes') at time zone 'Africa/Johannesburg',
    (date_trunc('day', now() at time zone 'Africa/Johannesburg') + interval '5 days 19 hours 30 minutes') at time zone 'Africa/Johannesburg',
    '22222222-2222-4222-8222-222222222222', 8, 250, true, 'active_members_only',
    '11111111-1111-4111-8111-111111111111'
  )
on conflict (id) do update set
  starts_at = excluded.starts_at,
  ends_at = excluded.ends_at,
  coach_id = excluded.coach_id,
  capacity = excluded.capacity,
  price = excluded.price,
  is_open = excluded.is_open,
  access_rule = excluded.access_rule;

-- Lesson booking demo: completed accounts, recurring coach offering, an exception,
-- an inclusive closure, and financially pending single/double examples.
update public.profiles set profile_completed_at=coalesce(profile_completed_at,now())
where id in (
  '22222222-2222-4222-8222-222222222222',
  '55555555-5555-4555-8555-555555555555',
  '66666666-6666-4666-8666-666666666666',
  '33333333-3333-4333-8333-333333333333',
  '44444444-4444-4444-8444-444444444444'
);

insert into public.coach_lesson_profiles(coach_id,is_active,updated_by)
values
  ('22222222-2222-4222-8222-222222222222',true,'11111111-1111-4111-8111-111111111111'),
  ('55555555-5555-4555-8555-555555555555',true,'11111111-1111-4111-8111-111111111111'),
  ('66666666-6666-4666-8666-666666666666',true,'11111111-1111-4111-8111-111111111111')
on conflict(coach_id) do update set is_active=true,updated_by=excluded.updated_by,updated_at=now();

insert into public.coach_lesson_weapons(coach_id,weapon) values
  ('22222222-2222-4222-8222-222222222222','foil'),
  ('22222222-2222-4222-8222-222222222222','epee'),
  ('55555555-5555-4555-8555-555555555555','foil'),
  ('66666666-6666-4666-8666-666666666666','foil'),
  ('66666666-6666-4666-8666-666666666666','epee'),
  ('66666666-6666-4666-8666-666666666666','sabre')
on conflict do nothing;

insert into public.coach_availability_rules(coach_id,iso_weekday,starts_at_local,ends_at_local)
select '22222222-2222-4222-8222-222222222222',weekday,'16:00'::time,'20:00'::time
from generate_series(1,7) weekday on conflict do nothing;

insert into public.coach_availability_rules(coach_id,iso_weekday,starts_at_local,ends_at_local)
select '55555555-5555-4555-8555-555555555555',weekday,'15:00'::time,'19:00'::time
from generate_series(1,7) weekday on conflict do nothing;

insert into public.coach_availability_rules(coach_id,iso_weekday,starts_at_local,ends_at_local)
select '66666666-6666-4666-8666-666666666666',weekday,'17:00'::time,'21:00'::time
from generate_series(1,7) weekday on conflict do nothing;

insert into public.coach_availability_exceptions(
  id,coach_id,exception_type,starts_at,ends_at,reason,created_by
) values(
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1',
  '22222222-2222-4222-8222-222222222222','block',
  (date_trunc('day',now() at time zone 'Africa/Johannesburg')+interval '7 days 17 hours') at time zone 'Africa/Johannesburg',
  (date_trunc('day',now() at time zone 'Africa/Johannesburg')+interval '7 days 18 hours') at time zone 'Africa/Johannesburg',
  'Coach development session','11111111-1111-4111-8111-111111111111'
) on conflict(id) do update set starts_at=excluded.starts_at,ends_at=excluded.ends_at,reason=excluded.reason;

insert into public.club_closures(id,starts_on,ends_on,reason,created_by) values(
  'cccccccc-cccc-4ccc-8ccc-ccccccccccc1',
  (now() at time zone 'Africa/Johannesburg')::date+14,
  (now() at time zone 'Africa/Johannesburg')::date+15,
  'Demo club closure','11111111-1111-4111-8111-111111111111'
) on conflict(id) do update set starts_on=excluded.starts_on,ends_on=excluded.ends_on,reason=excluded.reason;

insert into public.lesson_slots(id,starts_at,ends_at,coach_id,capacity,price,is_open,access_rule,created_by) values
  ('dddddddd-dddd-4ddd-8ddd-ddddddddddd1',
    (date_trunc('day',now() at time zone 'Africa/Johannesburg')+interval '2 days 16 hours') at time zone 'Africa/Johannesburg',
    (date_trunc('day',now() at time zone 'Africa/Johannesburg')+interval '2 days 16 hours 30 minutes') at time zone 'Africa/Johannesburg',
    '22222222-2222-4222-8222-222222222222',1,300,true,'guest_allowed','11111111-1111-4111-8111-111111111111'),
  ('dddddddd-dddd-4ddd-8ddd-ddddddddddd2',
    (date_trunc('day',now() at time zone 'Africa/Johannesburg')+interval '3 days 16 hours') at time zone 'Africa/Johannesburg',
    (date_trunc('day',now() at time zone 'Africa/Johannesburg')+interval '3 days 16 hours 30 minutes') at time zone 'Africa/Johannesburg',
    '22222222-2222-4222-8222-222222222222',1,300,true,'guest_allowed','11111111-1111-4111-8111-111111111111')
on conflict(id) do update set starts_at=excluded.starts_at,ends_at=excluded.ends_at,coach_id=excluded.coach_id,price=excluded.price;

insert into public.bookings(id,lesson_slot_id,booked_by_id,fencer_id,payment_option,status,booking_model,coach_id,starts_at,ends_at,weapon) values
  ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1','dddddddd-dddd-4ddd-8ddd-ddddddddddd1',
    '33333333-3333-4333-8333-333333333333','33333333-3333-4333-8333-333333333333','pay_later','scheduled','lesson_v2',
    '22222222-2222-4222-8222-222222222222',
    (date_trunc('day',now() at time zone 'Africa/Johannesburg')+interval '2 days 16 hours') at time zone 'Africa/Johannesburg',
    (date_trunc('day',now() at time zone 'Africa/Johannesburg')+interval '2 days 16 hours 30 minutes') at time zone 'Africa/Johannesburg','foil'),
  ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee2','dddddddd-dddd-4ddd-8ddd-ddddddddddd2',
    '44444444-4444-4444-8444-444444444444','44444444-4444-4444-8444-444444444444','pay_later','scheduled','lesson_v2',
    '22222222-2222-4222-8222-222222222222',
    (date_trunc('day',now() at time zone 'Africa/Johannesburg')+interval '3 days 16 hours') at time zone 'Africa/Johannesburg',
    (date_trunc('day',now() at time zone 'Africa/Johannesburg')+interval '3 days 16 hours 30 minutes') at time zone 'Africa/Johannesburg','epee')
on conflict(id) do update set starts_at=excluded.starts_at,ends_at=excluded.ends_at,status='scheduled';

insert into public.booking_participants(booking_id,participant_id,ordinal) values
  ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1','33333333-3333-4333-8333-333333333333',1),
  ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee2','44444444-4444-4444-8444-444444444444',1),
  ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee2','33333333-3333-4333-8333-333333333333',2)
on conflict do nothing;

insert into public.charges(id,fencer_id,payer_id,booking_id,type,amount,status,period,description,lifecycle_state) values
  ('ffffffff-ffff-4fff-8fff-fffffffffff1','33333333-3333-4333-8333-333333333333','44444444-4444-4444-8444-444444444444',
    'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1','lesson',300,'unpaid',date_trunc('month',current_date)::date,'Individual lesson','provisional'),
  ('ffffffff-ffff-4fff-8fff-fffffffffff2','44444444-4444-4444-8444-444444444444','44444444-4444-4444-8444-444444444444',
    'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee2','lesson',300,'unpaid',date_trunc('month',current_date)::date,'Individual lesson','provisional'),
  ('ffffffff-ffff-4fff-8fff-fffffffffff3','33333333-3333-4333-8333-333333333333','44444444-4444-4444-8444-444444444444',
    'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee2','lesson',300,'unpaid',date_trunc('month',current_date)::date,'Individual lesson','provisional')
on conflict(id) do update set amount=excluded.amount,lifecycle_state='provisional';
