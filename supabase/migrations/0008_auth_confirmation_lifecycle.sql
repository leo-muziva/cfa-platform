-- A pending auth user is required so Supabase can deliver and validate email
-- links. The application profile is created only after confirmation, which
-- keeps unconfirmed users out of all CFA workflows protected by profile RLS.

delete from public.profiles p
using auth.users u
where p.id = u.id
  and u.email_confirmed_at is null;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  invited_staff boolean := coalesce(new.raw_user_meta_data->>'cfa_is_staff', 'false') = 'true';
  invited_staff_type text := new.raw_user_meta_data->>'cfa_staff_type';
begin
  if new.email_confirmed_at is not null then
    invited_staff := invited_staff and invited_staff_type in ('admin', 'coach');

    insert into public.profiles (id, email, full_name, is_staff, staff_type)
    values (
      new.id,
      new.email,
      coalesce(new.raw_user_meta_data->>'full_name', ''),
      invited_staff,
      case when invited_staff then invited_staff_type else null end
    )
    on conflict (id) do nothing;
  end if;

  return new;
end;
$$;

create or replace function public.handle_user_email_confirmed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  invited_staff boolean := coalesce(new.raw_user_meta_data->>'cfa_is_staff', 'false') = 'true';
  invited_staff_type text := new.raw_user_meta_data->>'cfa_staff_type';
begin
  invited_staff := invited_staff and invited_staff_type in ('admin', 'coach');

  insert into public.profiles (id, email, full_name, is_staff, staff_type)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    invited_staff,
    case when invited_staff then invited_staff_type else null end
  )
  on conflict (id) do update
    set email = excluded.email,
        full_name = case
          when public.profiles.full_name is null or public.profiles.full_name = ''
            then excluded.full_name
          else public.profiles.full_name
        end,
        is_staff = excluded.is_staff,
        staff_type = excluded.staff_type;

  return new;
end;
$$;

drop trigger if exists on_auth_user_email_confirmed on auth.users;
create trigger on_auth_user_email_confirmed
  after update of email_confirmed_at on auth.users
  for each row
  when (old.email_confirmed_at is null and new.email_confirmed_at is not null)
  execute function public.handle_user_email_confirmed();
