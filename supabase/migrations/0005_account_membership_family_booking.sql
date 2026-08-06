-- Account, membership, family billing, booking access and audit lifecycle.
-- Forward-only: historical profiles, households, bookings and ledger rows are preserved.

create table public.memberships (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null unique references public.profiles(id) on delete restrict,
  membership_type_id uuid not null references public.membership_types(id) on delete restrict,
  status text not null check (status in ('active','suspended','expired','cancelled')),
  started_at timestamptz not null default now(),
  status_changed_at timestamptz not null default now(),
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.memberships(profile_id,membership_type_id,status,started_at)
select p.id,p.membership_type_id,'active',coalesce(p.updated_at,p.created_at,now())
from public.profiles p
where p.membership_status='member' and p.membership_type_id is not null
on conflict(profile_id) do nothing;

create table public.membership_applications (
  id uuid primary key default gen_random_uuid(),
  applicant_id uuid not null references public.profiles(id) on delete restrict,
  membership_type_id uuid not null references public.membership_types(id) on delete restrict,
  version integer not null,
  status text not null default 'pending'
    check (status in ('pending','changes_requested','rejected','approved')),
  submitted_details jsonb not null,
  visible_response text,
  private_notes text,
  reviewer_id uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(applicant_id,version)
);
create unique index one_open_membership_application
  on public.membership_applications(applicant_id)
  where status in ('pending','changes_requested');

insert into public.membership_applications(
  applicant_id,membership_type_id,version,status,submitted_details,
  reviewer_id,reviewed_at,created_at
)
select mr.applicant_id,mr.membership_type_id,
  row_number() over(partition by mr.applicant_id order by mr.created_at,mr.id),
  case mr.status when 'declined' then 'rejected' else mr.status end,
  jsonb_build_object('membership_type_id',mr.membership_type_id),
  mr.reviewed_by,mr.reviewed_at,mr.created_at
from public.membership_requests mr
on conflict(applicant_id,version) do nothing;

create table public.family_links (
  id uuid primary key default gen_random_uuid(),
  guardian_id uuid not null references public.profiles(id) on delete restrict,
  dependent_id uuid not null references public.profiles(id) on delete restrict,
  status text not null default 'pending'
    check (status in ('pending','active','rejected','ended')),
  requested_by uuid not null references public.profiles(id) on delete restrict,
  accepted_by uuid references public.profiles(id) on delete restrict,
  requested_at timestamptz not null default now(),
  accepted_at timestamptz,
  rejected_at timestamptz,
  ended_at timestamptz,
  check (guardian_id <> dependent_id),
  check (requested_by in (guardian_id,dependent_id))
);
create unique index one_current_family_pair on public.family_links(guardian_id,dependent_id)
  where status in ('pending','active');

create table public.dependent_billing_links (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete restrict,
  guardian_id uuid not null references public.profiles(id) on delete restrict,
  dependent_id uuid not null references public.profiles(id) on delete restrict,
  family_link_id uuid not null references public.family_links(id) on delete restrict,
  effective_from timestamptz not null default now(),
  effective_to timestamptz,
  created_at timestamptz not null default now(),
  check (guardian_id <> dependent_id),
  check (effective_to is null or effective_to > effective_from)
);
create unique index one_active_billing_guardian
  on public.dependent_billing_links(dependent_id) where effective_to is null;

insert into public.family_links(
  guardian_id,dependent_id,status,requested_by,accepted_by,requested_at,accepted_at
)
select h.payer_id,hm.profile_id,'active',h.payer_id,hm.profile_id,
  coalesce(hm.created_at,h.created_at),coalesce(hm.payer_consent_at,hm.created_at,h.created_at)
from public.household_members hm join public.households h on h.id=hm.household_id
where hm.household_role='dependent' and hm.profile_id<>h.payer_id
on conflict do nothing;

insert into public.dependent_billing_links(
  household_id,guardian_id,dependent_id,family_link_id,effective_from
)
select h.id,h.payer_id,fl.dependent_id,fl.id,fl.accepted_at
from public.family_links fl join public.households h on h.payer_id=fl.guardian_id
where fl.status='active'
on conflict do nothing;

create table public.audit_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  actor_id uuid references public.profiles(id) on delete set null,
  subject_profile_id uuid references public.profiles(id) on delete set null,
  entity_type text not null,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.lesson_slots add column access_rule text not null default 'guest_allowed'
  check (access_rule in ('guest_allowed','active_members_only'));
alter table public.invoice_lines add column participant_id uuid references public.profiles(id) on delete restrict;
update public.invoice_lines il set participant_id=c.fencer_id
from public.charges c where c.id=il.charge_id and il.participant_id is null;
alter table public.invoice_lines alter column participant_id set not null;

create or replace function public.active_billing_payer(target_participant uuid, at_time timestamptz default now())
returns uuid language sql stable security definer set search_path=public as $$
  select coalesce(
    (select dbl.guardian_id from public.dependent_billing_links dbl
     where dbl.dependent_id=target_participant and dbl.effective_from<=at_time
       and (dbl.effective_to is null or dbl.effective_to>at_time)
     order by dbl.effective_from desc limit 1),
    target_participant
  );
$$;

create or replace function public.submit_membership_application(target_type uuid)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_id uuid; v_version integer;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if exists(select 1 from public.memberships where profile_id=auth.uid() and status='active') then
    raise exception 'active membership already exists';
  end if;
  if exists(select 1 from public.membership_applications where applicant_id=auth.uid()
    and status in ('pending','changes_requested')) then raise exception 'open application already exists'; end if;
  select coalesce(max(version),0)+1 into v_version from public.membership_applications
    where applicant_id=auth.uid();
  insert into public.membership_applications(applicant_id,membership_type_id,version,submitted_details)
  values(auth.uid(),target_type,v_version,jsonb_build_object('membership_type_id',target_type))
  returning id into v_id;
  insert into public.audit_events(event_type,actor_id,subject_profile_id,entity_type,entity_id)
  values('membership.application_submitted',auth.uid(),auth.uid(),'membership_application',v_id);
  return v_id;
end $$;

create or replace function public.resubmit_membership_application(application_id uuid, target_type uuid)
returns uuid language plpgsql security definer set search_path=public as $$
declare old_row public.membership_applications; v_id uuid; v_version integer;
begin
  select * into old_row from public.membership_applications
    where id=application_id and applicant_id=auth.uid() and status='changes_requested' for update;
  if not found then raise exception 'changes-requested application not found'; end if;
  update public.membership_applications set status='rejected',updated_at=now() where id=application_id;
  select max(version)+1 into v_version from public.membership_applications where applicant_id=auth.uid();
  insert into public.membership_applications(applicant_id,membership_type_id,version,status,submitted_details)
  values(auth.uid(),target_type,v_version,'pending',jsonb_build_object('membership_type_id',target_type))
  returning id into v_id;
  insert into public.audit_events(event_type,actor_id,subject_profile_id,entity_type,entity_id,
    metadata) values('membership.application_resubmitted',auth.uid(),auth.uid(),
    'membership_application',v_id,jsonb_build_object('previous_application_id',application_id));
  return v_id;
end $$;

create or replace function public.review_membership_application(
  application_id uuid, decision text, visible_response text default null, private_notes text default null
) returns void language plpgsql security definer set search_path=public as $$
declare app public.membership_applications; new_status text; payer uuid; mt public.membership_types;
begin
  if not public.current_user_is_admin() then raise exception 'forbidden'; end if;
  if decision not in ('approve','request_changes','reject') then raise exception 'invalid decision'; end if;
  select * into app from public.membership_applications
    where id=application_id and status='pending' for update;
  if not found then raise exception 'pending application not found'; end if;
  new_status:=case decision when 'approve' then 'approved'
    when 'request_changes' then 'changes_requested' else 'rejected' end;
  update public.membership_applications set status=new_status,
    visible_response=nullif(trim(visible_response),''),
    private_notes=nullif(trim(private_notes),''),
    reviewer_id=auth.uid(),reviewed_at=now(),updated_at=now() where id=application_id;
  if decision='approve' then
    insert into public.memberships(profile_id,membership_type_id,status)
    values(app.applicant_id,app.membership_type_id,'active')
    on conflict(profile_id) do update set membership_type_id=excluded.membership_type_id,
      status='active',started_at=now(),status_changed_at=now(),cancelled_at=null,updated_at=now();
    update public.profiles set membership_status='member',membership_type_id=app.membership_type_id
      where id=app.applicant_id;
    payer:=public.active_billing_payer(app.applicant_id);
    select * into mt from public.membership_types where id=app.membership_type_id;
    insert into public.charges(fencer_id,payer_id,type,amount,status,period,description)
    values(app.applicant_id,payer,'membership',mt.price,'unpaid',
      date_trunc('month',current_date)::date,mt.name);
    if mt.joining_fee>0 then
      insert into public.charges(fencer_id,payer_id,type,amount,status,period,description)
      values(app.applicant_id,payer,'joining_fee',mt.joining_fee,'unpaid',
        date_trunc('month',current_date)::date,'First-time joining fee');
    end if;
  end if;
  insert into public.audit_events(event_type,actor_id,subject_profile_id,entity_type,entity_id,metadata)
  values('membership.application_'||new_status,auth.uid(),app.applicant_id,
    'membership_application',application_id,jsonb_build_object('decision',decision));
end $$;

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
  if public.current_user_is_admin() then
    update public.profiles set membership_status=case when target_status='active' then 'member' else 'guest' end
      where id=target_profile;
  end if;
  insert into public.audit_events(event_type,actor_id,subject_profile_id,entity_type,entity_id,metadata)
  values('membership.status_changed',auth.uid(),target_profile,'membership',v_id,
    jsonb_build_object('from',old_status,'to',target_status));
end $$;

create or replace function public.request_family_link_by_email(target_email text)
returns void language plpgsql security definer set search_path=public as $$
declare dependent uuid; v_id uuid;
begin
  select id into dependent from public.profiles where lower(email)=lower(trim(target_email));
  if dependent is null or dependent=auth.uid() then return; end if; -- no account enumeration
  insert into public.family_links(guardian_id,dependent_id,requested_by)
  values(auth.uid(),dependent,auth.uid()) returning id into v_id;
  insert into public.audit_events(event_type,actor_id,subject_profile_id,entity_type,entity_id)
  values('family.link_requested',auth.uid(),dependent,'family_link',v_id);
exception when unique_violation then return;
end $$;

create or replace function public.request_family_link_to_profile(target_dependent uuid)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_id uuid;
begin
  if auth.uid() is null or target_dependent=auth.uid() then raise exception 'invalid dependent'; end if;
  insert into public.family_links(guardian_id,dependent_id,requested_by)
  values(auth.uid(),target_dependent,auth.uid()) returning id into v_id;
  insert into public.audit_events(event_type,actor_id,subject_profile_id,entity_type,entity_id)
  values('family.dependent_invited',auth.uid(),target_dependent,'family_link',v_id);
  return v_id;
end $$;

create or replace function public.respond_family_link(link_id uuid, response text)
returns void language plpgsql security definer set search_path=public as $$
declare link public.family_links; household uuid;
begin
  if response not in ('accept','reject') then raise exception 'invalid response'; end if;
  select * into link from public.family_links where id=link_id and dependent_id=auth.uid()
    and status='pending' for update;
  if not found then raise exception 'pending link not found'; end if;
  if response='reject' then
    update public.family_links set status='rejected',rejected_at=now() where id=link_id;
  else
    if exists(select 1 from public.dependent_billing_links where dependent_id=link.dependent_id
      and effective_to is null) then raise exception 'dependent already has a billing guardian'; end if;
    update public.family_links set status='active',accepted_by=auth.uid(),accepted_at=now() where id=link_id;
    select id into household from public.households where payer_id=link.guardian_id;
    insert into public.dependent_billing_links(household_id,guardian_id,dependent_id,family_link_id)
    values(household,link.guardian_id,link.dependent_id,link.id);
    insert into public.audit_events(event_type,actor_id,subject_profile_id,entity_type,entity_id)
    values('billing.responsibility_started',auth.uid(),link.dependent_id,'dependent_billing_link',link.id);
  end if;
  insert into public.audit_events(event_type,actor_id,subject_profile_id,entity_type,entity_id)
  values('family.link_'||case response when 'accept' then 'accepted' else 'rejected' end,
    auth.uid(),link.dependent_id,'family_link',link_id);
end $$;

create or replace function public.end_family_link(link_id uuid)
returns void language plpgsql security definer set search_path=public as $$
declare link public.family_links;
begin
  select * into link from public.family_links where id=link_id and status='active'
    and auth.uid() in (guardian_id,dependent_id) for update;
  if not found then raise exception 'active link not found'; end if;
  update public.family_links set status='ended',ended_at=now() where id=link_id;
  update public.dependent_billing_links set effective_to=now()
    where family_link_id=link_id and effective_to is null;
  insert into public.audit_events(event_type,actor_id,subject_profile_id,entity_type,entity_id)
  values('billing.responsibility_ended',auth.uid(),link.dependent_id,'dependent_billing_link',link_id);
  insert into public.audit_events(event_type,actor_id,subject_profile_id,entity_type,entity_id)
  values('family.link_ended',auth.uid(),link.dependent_id,'family_link',link_id);
end $$;

create or replace function public.create_lesson_booking(
  target_slot uuid, target_fencer uuid, requested_payment text
) returns uuid language plpgsql security definer set search_path=public as $$
declare actor public.profiles; fencer public.profiles; slot public.lesson_slots;
declare payer uuid; final_payment text; booking_id uuid;
begin
  select * into actor from public.profiles where id=auth.uid() and is_active;
  select * into fencer from public.profiles where id=target_fencer and is_active;
  select * into slot from public.lesson_slots where id=target_slot and is_open and starts_at>now() for update;
  if actor.id is null or fencer.id is null or slot.id is null then raise exception 'not available'; end if;
  if not public.current_user_is_admin() and target_fencer<>actor.id and not exists(
    select 1 from public.family_links where guardian_id=actor.id and dependent_id=target_fencer and status='active'
  ) then raise exception 'participant not authorized'; end if;
  if slot.access_rule='active_members_only' and not exists(
    select 1 from public.memberships where profile_id=target_fencer and status='active'
  ) then raise exception 'active membership required'; end if;
  if slot.capacity is not null and (select count(*) from public.bookings
    where lesson_slot_id=slot.id and status<>'cancelled')>=slot.capacity then raise exception 'slot is full'; end if;
  payer:=public.active_billing_payer(target_fencer);
  final_payment:=case when payer<>actor.id then 'pay_later' else requested_payment end;
  if final_payment not in ('pay_now','pay_later') then raise exception 'invalid payment option'; end if;
  insert into public.bookings(lesson_slot_id,booked_by_id,fencer_id,payment_option)
    values(target_slot,actor.id,target_fencer,final_payment) returning id into booking_id;
  insert into public.charges(fencer_id,payer_id,booking_id,type,amount,status,period,description)
  values(target_fencer,payer,booking_id,'lesson',slot.price,'unpaid',
    date_trunc('month',slot.starts_at)::date,'Individual lesson');
  return booking_id;
end $$;

create or replace function public.run_monthly_invoices(target_period date)
returns integer language plpgsql security definer set search_path=public as $$
declare payer_row record; v_invoice_id uuid; made integer:=0;
begin
  if not public.current_user_is_admin() then raise exception 'forbidden'; end if;
  target_period:=date_trunc('month',target_period)::date;
  insert into public.charges(fencer_id,payer_id,type,amount,status,period,description)
  select m.profile_id,public.active_billing_payer(m.profile_id), 'membership',mt.price,'unpaid',
    target_period,mt.name
  from public.memberships m join public.membership_types mt on mt.id=m.membership_type_id
  where m.status='active' and mt.code='month_to_month' and m.started_at<target_period+interval '1 month'
  on conflict do nothing;
  for payer_row in select distinct c.payer_id from public.charges c
    left join public.bookings b on b.id=c.booking_id
    where c.status='unpaid' and c.period=target_period and
      (c.type in ('membership','joining_fee') or (c.type='lesson' and b.payment_option='pay_later')) loop
    insert into public.invoices(payer_id,period) values(payer_row.payer_id,target_period)
    on conflict(payer_id,period) do update set payer_id=excluded.payer_id returning id into v_invoice_id;
    insert into public.invoice_lines(invoice_id,charge_id,participant_id,description,amount)
    select v_invoice_id,c.id,c.fencer_id,c.description,c.amount from public.charges c
    left join public.bookings b on b.id=c.booking_id
    where c.payer_id=payer_row.payer_id and c.period=target_period and c.status='unpaid'
      and (c.type in ('membership','joining_fee') or (c.type='lesson' and b.payment_option='pay_later'))
    on conflict(charge_id) do nothing;
    update public.invoices i set total=(select coalesce(sum(amount),0) from public.invoice_lines where invoice_id=v_invoice_id)
      where i.id=v_invoice_id;
    made:=made+1;
  end loop;
  return made;
end $$;

create unique index one_monthly_membership_charge
  on public.charges(fencer_id,period) where type='membership';

alter table public.memberships enable row level security;
alter table public.membership_applications enable row level security;
alter table public.family_links enable row level security;
alter table public.dependent_billing_links enable row level security;
alter table public.audit_events enable row level security;
create policy "members read own membership" on public.memberships for select
  using(profile_id=auth.uid() or public.current_user_is_admin());
create policy "applicants read own applications" on public.membership_applications for select
  using(applicant_id=auth.uid() or public.current_user_is_admin());
create policy "family parties read links" on public.family_links for select
  using(auth.uid() in (guardian_id,dependent_id) or public.current_user_is_admin());
create policy "guardians read active billing links" on public.dependent_billing_links for select
  using(auth.uid() in (guardian_id,dependent_id) or public.current_user_is_admin());
create policy "admins read audit events" on public.audit_events for select
  using(public.current_user_is_admin());

drop policy if exists "booking participants read" on public.bookings;
create policy "booking participants read" on public.bookings for select using(
  fencer_id=auth.uid() or booked_by_id=auth.uid() or public.current_user_is_admin() or exists(
    select 1 from public.family_links fl where fl.guardian_id=auth.uid()
      and fl.dependent_id=bookings.fencer_id and fl.status='active'
  )
);

grant execute on function public.submit_membership_application(uuid) to authenticated;
grant execute on function public.resubmit_membership_application(uuid,uuid) to authenticated;
grant execute on function public.review_membership_application(uuid,text,text,text) to authenticated;
grant execute on function public.change_membership_status(uuid,text) to authenticated;
grant execute on function public.request_family_link_by_email(text) to authenticated;
grant execute on function public.request_family_link_to_profile(uuid) to authenticated;
grant execute on function public.respond_family_link(uuid,text) to authenticated;
grant execute on function public.end_family_link(uuid) to authenticated;
