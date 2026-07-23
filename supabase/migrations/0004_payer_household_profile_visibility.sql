-- Allow an adult payer to identify members of their own household.
-- The helper bypasses profiles RLS to avoid a self-referential policy.
create or replace function public.current_payer_can_view_profile(
  target_profile uuid
) returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.household_members actor
    join public.household_members target
      on target.household_id = actor.household_id
    where actor.profile_id = auth.uid()
      and actor.household_role = 'payer'
      and target.profile_id = target_profile
  );
$$;

revoke all on function public.current_payer_can_view_profile(uuid) from public;
grant execute on function public.current_payer_can_view_profile(uuid) to authenticated;

create policy "Payers can read profiles in their household"
  on public.profiles for select
  using (public.current_payer_can_view_profile(id));
