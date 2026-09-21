-- Staff claims belong to server-controlled app metadata, never signup metadata.
-- Existing profiles retain their assignments when confirmation is replayed.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  staff_kind text := new.raw_app_meta_data->>'cfa_staff_type';
  trusted_staff boolean := coalesce(new.raw_app_meta_data->>'cfa_is_staff', 'false') = 'true'
    and coalesce(staff_kind in ('admin', 'coach'), false);
begin
  if new.email_confirmed_at is not null then
    insert into public.profiles (id, email, full_name, is_staff, staff_type)
    values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', ''),
      trusted_staff, case when trusted_staff then staff_kind else null end)
    on conflict (id) do nothing;
  end if;
  return new;
end;
$$;

create or replace function public.handle_user_email_confirmed()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  staff_kind text := new.raw_app_meta_data->>'cfa_staff_type';
  trusted_staff boolean := coalesce(new.raw_app_meta_data->>'cfa_is_staff', 'false') = 'true'
    and coalesce(staff_kind in ('admin', 'coach'), false);
begin
  insert into public.profiles (id, email, full_name, is_staff, staff_type)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', ''),
    trusted_staff, case when trusted_staff then staff_kind else null end)
  on conflict (id) do update set email = excluded.email,
    full_name = case when profiles.full_name is null or profiles.full_name = ''
      then excluded.full_name else profiles.full_name end;
  return new;
end;
$$;

-- Locking the auth row serializes provisioning with email confirmation.
create or replace function public.provision_invited_staff(target_user uuid, target_staff_type text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if target_staff_type is null or target_staff_type not in ('admin', 'coach') then
    raise exception 'invalid staff type';
  end if;
  perform 1 from auth.users where id = target_user for update;
  if not found then raise exception 'account not found'; end if;
  update auth.users set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
    || jsonb_build_object('cfa_is_staff', true, 'cfa_staff_type', target_staff_type)
    where id = target_user;
  update public.profiles set is_staff = true, staff_type = target_staff_type
    where id = target_user;
end;
$$;
revoke all on function public.provision_invited_staff(uuid, text) from public, anon, authenticated;
grant execute on function public.provision_invited_staff(uuid, text) to service_role;

create or replace function public.current_user_role()
returns text language sql stable security definer set search_path = public as $$
  select case when is_staff then staff_type else 'fencer' end
  from public.profiles where id = auth.uid();
$$;
comment on function public.current_user_role() is
  'Legacy policy compatibility using trusted independent staff fields.';

-- Existing-account links do not move the dependent's household row.
-- Effective billing links therefore determine guardian profile visibility.
create or replace function public.current_payer_can_view_profile(target_profile uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select target_profile = auth.uid() or exists (
    select 1 from public.dependent_billing_links link
    join public.family_links family on family.id = link.family_link_id
    where link.guardian_id = auth.uid() and link.dependent_id = target_profile
      and link.effective_from <= now()
      and (link.effective_to is null or link.effective_to > now())
      and family.status = 'active'
  );
$$;
