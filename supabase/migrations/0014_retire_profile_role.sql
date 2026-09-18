-- Retire profiles.role.
--
-- The platform has had two ways to ask "is this person a coach" since 0003:
-- the original profiles.role column, and is_staff/staff_type. Everything
-- written since reads the latter, and no application code has ever written the
-- former -- adminUpdateProfile and adminProfileUpdateSchema only set
-- staff_type. They stayed in step purely because seed.sql sets both by hand.
--
-- That is not cosmetic. list_coach_lesson_agenda gates on
-- current_user_role()='coach', which reads the stale column, so a coach
-- promoted through the admin UI gets 'forbidden' on their own agenda. Verified
-- locally: promoting a fencer the way the app does leaves role='fencer',
-- staff_type='coach', and the agenda call raises.
--
-- Two live callers, both in 0011, and no RLS policy reads the column, so the
-- column can go once they are moved across.

-- Coach agenda. Same body; the staff check now matches list_my_lesson_bookings
-- directly below it in 0011, which already used staff_type.
create or replace function public.list_coach_lesson_agenda(target_coach uuid default null)
returns table(
  booking_id uuid,coach_id uuid,starts_at timestamptz,ends_at timestamptz,
  weapon text,status text,participant_names text[]
) language plpgsql stable security definer set search_path=public as $$
declare requested_coach uuid:=coalesce(target_coach,auth.uid());
begin
  if not public.current_user_is_admin() and (
    not exists(select 1 from public.profiles p
      where p.id=auth.uid() and p.is_staff and p.staff_type='coach')
    or requested_coach<>auth.uid())
  then raise exception using message='forbidden',errcode='P0001'; end if;
  return query
  select b.id,b.coach_id,b.starts_at,b.ends_at,b.weapon,b.status,
    array_agg(p.full_name order by bp.ordinal)
  from public.bookings b join public.booking_participants bp on bp.booking_id=b.id
  join public.profiles p on p.id=bp.participant_id
  where b.booking_model='lesson_v2' and b.coach_id=requested_coach
  group by b.id order by b.starts_at;
end $$;

-- Cancellation notices to payers, same substitution.
create or replace function public.notify_payer_of_cfa_lesson_change()
returns trigger language plpgsql security definer set search_path=public as $$
declare payer uuid;
begin
  if new.booking_model='lesson_v2' and new.status is distinct from old.status
    and new.status in ('cancelled','rescheduled')
    and (new.cancellation_actor_type in ('coach','admin','closure','system')
      or public.current_user_is_admin()
      or exists(select 1 from public.profiles p
        where p.id=auth.uid() and p.is_staff and p.staff_type='coach')) then
    for payer in select distinct public.active_billing_payer(bp.participant_id)
      from public.booking_participants bp where bp.booking_id=new.id loop
      insert into public.lesson_notifications(recipient_id,booking_id,notification_type,message)
      values(payer,new.id,case when new.status='cancelled' then 'booking_cancelled' else 'booking_changed' end,
        case when new.status='cancelled' then 'CFA cancelled a lesson at no charge.'
          else 'CFA changed a lesson booking.' end);
    end loop;
  end if;
  return new;
end $$;

-- The field guard from 0003 still protects everything that matters; it just
-- stops naming a column that is about to not exist.
create or replace function public.protect_profile_security_fields()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() = old.id and not public.current_user_is_admin() and (
    new.email is distinct from old.email or
    new.is_active is distinct from old.is_active or
    new.membership_status is distinct from old.membership_status or
    new.membership_type_id is distinct from old.membership_type_id or
    new.is_staff is distinct from old.is_staff or
    new.staff_type is distinct from old.staff_type
  ) then
    raise exception 'protected profile fields may only be changed by an administrator';
  end if;
  return new;
end;
$$;

drop function if exists public.current_user_role();
alter table public.profiles drop column role;
