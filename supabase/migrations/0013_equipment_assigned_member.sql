-- Name the member who has an item out. 0012 added equipment_items.assigned_to
-- but nothing to set or read it, because coaches cannot select arbitrary rows
-- from public.profiles -- 0003 and 0011 both drop the coach read policy, so a
-- plain join would show a name to an admin and nothing to a coach.
--
-- Rather than widen the profiles policies for everyone, staff get exactly one
-- thing through a security definer function: a list of id + display name. No
-- email, no contact details, nothing else on the profile.

create or replace function public.equipment_member_options()
returns table(id uuid, full_name text)
language sql stable security definer set search_path = public
as $$
  select p.id, coalesce(nullif(trim(p.full_name), ''), 'Unnamed member')
  from public.profiles p
  where public.current_user_is_coach_or_admin()
    and p.is_active
  order by 2, 1;
$$;

comment on function public.equipment_member_options() is
  'Id and display name of active members, for the equipment register''s holder picker. Staff only; returns no rows for anyone else.';

revoke all on function public.equipment_member_options() from public;
grant execute on function public.equipment_member_options() to authenticated;
