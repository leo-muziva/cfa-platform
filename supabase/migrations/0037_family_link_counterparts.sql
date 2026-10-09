-- A dependent cannot read a requesting guardian's profile under profiles RLS,
-- so incoming link requests rendered with no name. This returns only the
-- other party's name and email, and only for links the caller is part of.
create or replace function public.list_my_family_link_counterparts()
returns table(link_id uuid, counterpart_id uuid, counterpart_name text, counterpart_email text)
language sql stable security definer set search_path=public as $$
  select l.id,
    p.id,
    p.full_name,
    p.email
  from public.family_links l
  join public.profiles p on p.id = case when l.guardian_id = auth.uid() then l.dependent_id else l.guardian_id end
  where auth.uid() is not null
    and (l.guardian_id = auth.uid() or l.dependent_id = auth.uid())
$$;
revoke all on function public.list_my_family_link_counterparts() from public, anon;
grant execute on function public.list_my_family_link_counterparts() to authenticated;
