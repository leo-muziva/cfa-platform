-- Migration: 0002_fix_profiles_rls_recursion
--
-- Problem: the admin/coach policies in 0001 ran a subquery on public.profiles
-- inside a policy ON public.profiles. Evaluating the policy re-triggers RLS on
-- the same table, so every authenticated select failed with Postgres error
-- 42P17 ("infinite recursion detected in policy for relation profiles").
-- The membership_types admin policy had the same subquery, so admin access to
-- that table broke the same way.
--
-- Fix: read the caller's role through a SECURITY DEFINER function. It runs
-- with the function owner's privileges, so the lookup bypasses RLS and the
-- recursion never starts. This is the pattern Supabase documents for
-- role-based policies.

create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

comment on function public.current_user_role() is
  'Returns the profiles.role of the logged-in user, bypassing RLS. Used by policies to avoid self-referential recursion.';

-- Recreate the recursive policies using the helper
drop policy if exists "Admins can read all profiles" on public.profiles;
create policy "Admins can read all profiles"
  on public.profiles for select
  using (public.current_user_role() = 'admin');

drop policy if exists "Admins can update all profiles" on public.profiles;
create policy "Admins can update all profiles"
  on public.profiles for update
  using (public.current_user_role() = 'admin');

drop policy if exists "Coaches can read fencer profiles" on public.profiles;
create policy "Coaches can read fencer profiles"
  on public.profiles for select
  using (public.current_user_role() = 'coach' and role = 'fencer');

drop policy if exists "Admins can manage membership types" on public.membership_types;
create policy "Admins can manage membership types"
  on public.membership_types for all
  using (public.current_user_role() = 'admin');
