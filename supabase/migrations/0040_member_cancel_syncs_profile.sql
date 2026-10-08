-- A member who cancelled their own membership kept profiles.membership_status
-- = 'member', because only admin changes synced the profile. Booking rules
-- read the profile flag (guest pay-now, members-only hours), so a cancelled
-- member could still book as a member. Sync the profile for every change.
create or replace function public.change_membership_status(target_profile uuid, target_status text)
returns void language plpgsql security definer set search_path=public as $$
declare old_status text; v_id uuid;
begin
  if target_status not in ('active','suspended','expired','cancelled') then raise exception 'invalid status'; end if;
  if auth.uid()=target_profile and target_status<>'cancelled' then raise exception 'members may only cancel'; end if;
  if auth.uid()<>target_profile and not public.current_user_is_admin() then raise exception 'forbidden'; end if;
  select id,status into v_id,old_status from public.memberships where profile_id=target_profile for update;
  if not found then raise exception 'membership not found'; end if;
  update public.memberships set status=target_status,status_changed_at=now(),
    cancelled_at=case when target_status='cancelled' then now() else null end,updated_at=now()
    where id=v_id;
  update public.profiles set membership_status=case when target_status='active' then 'member' else 'guest' end
    where id=target_profile;
  insert into public.audit_events(event_type,actor_id,subject_profile_id,entity_type,entity_id,metadata)
  values('membership.status_changed',auth.uid(),target_profile,'membership',v_id,
    jsonb_build_object('from',old_status,'to',target_status));
end $$;

-- The self-service guard still blocks members raising their own status. The
-- one change it now lets through is dropping back to guest once the
-- membership row is no longer active, which is exactly a self-cancel.
create or replace function public.protect_profile_security_fields()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if auth.uid() = old.id and not public.current_user_is_admin() and (
    new.email is distinct from old.email or
    new.role is distinct from old.role or
    new.is_active is distinct from old.is_active or
    (new.membership_status is distinct from old.membership_status and not (
      old.membership_status='member' and new.membership_status='guest'
      and not exists(select 1 from public.memberships m where m.profile_id=old.id and m.status='active'))) or
    new.membership_type_id is distinct from old.membership_type_id or
    new.is_staff is distinct from old.is_staff or
    new.staff_type is distinct from old.staff_type
  ) then
    raise exception 'protected profile fields may only be changed by an administrator';
  end if;
  return new;
end;
$$;

-- Repair profiles left behind by earlier self-cancellations.
update public.profiles p set membership_status='guest'
from public.memberships m
where m.profile_id=p.id and m.status<>'active' and p.membership_status='member';
