-- Name the member who has an item out. 0050 added equipment_items.assigned_to
-- but nothing to set or read it, because coaches cannot select arbitrary rows
-- from public.profiles -- 0003 and 0011 both drop the coach read policy, so a
-- plain join would show a name to an admin and nothing to a coach.
--
-- Rather than widen the profiles policies for everyone, staff get exactly one
-- thing through a security definer function: a list of id + display name. No
-- email, no contact details, nothing else on the profile.
--
-- Inactive members are left out of the picker, except anyone who still has
-- kit out: dropping them would show their item as "not recorded" and a save
-- would quietly clear the holder. is_active lets the form flag them.

create or replace function public.equipment_member_options()
returns table(id uuid, full_name text, is_active boolean)
language sql stable security definer set search_path = public
as $$
  select p.id, coalesce(nullif(trim(p.full_name), ''), 'Unnamed member'), p.is_active
  from public.profiles p
  where public.current_user_is_coach_or_admin()
    and (p.is_active
         or exists (select 1 from public.equipment_items e where e.assigned_to = p.id))
  order by 2, 1;
$$;

comment on function public.equipment_member_options() is
  'Id and display name of active members (plus anyone inactive still holding an item), for the equipment register''s holder picker. Staff only; returns no rows for anyone else.';

revoke all on function public.equipment_member_options() from public;
grant execute on function public.equipment_member_options() to authenticated;
