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
    '{"full_name":"Charles Coach"}',
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

-- [HOSTED + LOCAL] Set roles, names, and phone numbers on the auto-created profiles.
-- These UUIDs must match the auth.users IDs above (local) or the real UUIDs from
-- Supabase Dashboard (hosted).
update public.profiles set
  role              = 'admin',
  membership_status = 'guest',
  is_staff          = true,
  staff_type        = 'admin',
  full_name         = 'Alice Admin',
  phone             = '+27 21 000 0001',
  is_active         = true
where id = '11111111-1111-4111-8111-111111111111';

update public.profiles set
  role              = 'coach',
  membership_status = 'guest',
  is_staff          = true,
  staff_type        = 'coach',
  full_name         = 'Charles Coach',
  phone             = '+27 21 000 0002',
  is_active         = true
where id = '22222222-2222-4222-8222-222222222222';

update public.profiles set
  role               = 'fencer',
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
  role               = 'guardian',
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
