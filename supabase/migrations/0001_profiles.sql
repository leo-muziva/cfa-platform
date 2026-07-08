-- Migration: 0001_profiles
-- Creates the profiles table, RLS policies, and auto-create trigger

-- ============================================================
-- 1. Membership types (reference table, created first)
-- ============================================================
create table public.membership_types (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  monthly_fee numeric(10, 2) not null,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.membership_types enable row level security;

-- Everyone can read active membership types
create policy "Anyone can read active membership types"
  on public.membership_types for select
  using (is_active = true);

-- Seed default membership types
insert into public.membership_types (name, monthly_fee, description) values
  ('Junior', 350.00, 'For fencers under 18 years old'),
  ('Senior', 450.00, 'For fencers 18 and older'),
  ('Social', 200.00, 'Social/recreational membership');

-- ============================================================
-- 2. Profiles table (extends auth.users)
-- ============================================================
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  role text not null default 'fencer'
    check (role in ('admin', 'coach', 'fencer', 'guardian')),
  phone text,
  date_of_birth date,
  is_active boolean not null default true,
  membership_type_id uuid references public.membership_types(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Users can read their own profile
create policy "Users can read own profile"
  on public.profiles for select
  using (auth.uid() = id);

-- Users can update their own profile (name + phone only — role/email locked via service layer)
create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Admins can read all profiles
create policy "Admins can read all profiles"
  on public.profiles for select
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

-- Admins can update all profiles
create policy "Admins can update all profiles"
  on public.profiles for update
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

-- Coaches can read all fencer profiles
create policy "Coaches can read fencer profiles"
  on public.profiles for select
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'coach'
    )
    and role = 'fencer'
  );

-- Admins can manage membership types (defined here because it references profiles)
create policy "Admins can manage membership types"
  on public.membership_types for all
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- ============================================================
-- 3. Auto-updated updated_at timestamp
-- ============================================================
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.handle_updated_at();

-- ============================================================
-- 4. Auto-create profile when a user signs up
-- ============================================================
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', '')
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
