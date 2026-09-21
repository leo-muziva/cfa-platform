-- Responsibility changes affect future billing only; historical ledger rows are never rewritten.
create table public.family_change_requests (
  id uuid primary key default gen_random_uuid(),
  family_link_id uuid not null references public.family_links(id),
  dependent_id uuid not null references public.profiles(id),
  old_guardian_id uuid not null references public.profiles(id),
  new_guardian_id uuid references public.profiles(id),
  requested_by uuid not null references public.profiles(id),
  kind text not null check (kind in ('unlink','transfer')),
  status text not null check (status in ('awaiting_acceptance','pending_review','approved','rejected')),
  reason text not null check (length(trim(reason)) between 3 and 1000),
  accepted_at timestamptz,
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  review_note text,
  created_at timestamptz not null default now(),
  check ((kind='unlink' and new_guardian_id is null) or
    (kind='transfer' and new_guardian_id is not null and new_guardian_id not in (old_guardian_id,dependent_id)))
);
create unique index one_pending_family_change on public.family_change_requests(family_link_id)
  where status in ('awaiting_acceptance','pending_review');
alter table public.family_change_requests enable row level security;
create policy "family change parties and staff read" on public.family_change_requests for select to authenticated
  using (auth.uid() in (dependent_id,old_guardian_id,new_guardian_id)
    or exists(select 1 from public.profiles where id=auth.uid() and is_staff));
revoke all on public.family_change_requests from anon, authenticated;
grant select on public.family_change_requests to authenticated;

create or replace function public.request_family_change(target_link uuid, change_kind text, new_payer_email text, request_reason text)
returns uuid language plpgsql security definer set search_path=public as $$
declare link public.family_links; target_payer uuid; request_id uuid;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if change_kind is null or change_kind not in ('unlink','transfer') or request_reason is null
    or length(trim(request_reason)) not between 3 and 1000 then raise exception 'invalid request'; end if;
  select * into link from public.family_links where id=target_link and status='active' for update;
  if not found or not (auth.uid() in (link.guardian_id,link.dependent_id)
    or exists(select 1 from public.profiles where id=auth.uid() and is_staff)) then raise exception 'forbidden'; end if;
  if change_kind='transfer' then
    select p.id into target_payer from public.profiles p where lower(p.email)=lower(trim(new_payer_email))
      and p.id not in (link.guardian_id,link.dependent_id)
      and p.date_of_birth <= (now() at time zone 'Africa/Johannesburg')::date - interval '18 years'
      and public.active_billing_payer(p.id)=p.id;
    if target_payer is null then raise exception 'eligible new payer unavailable'; end if;
  end if;
  insert into public.family_change_requests(family_link_id,dependent_id,old_guardian_id,new_guardian_id,requested_by,kind,status,reason)
  values(link.id,link.dependent_id,link.guardian_id,target_payer,auth.uid(),change_kind,
    case when change_kind='transfer' then 'awaiting_acceptance' else 'pending_review' end,trim(request_reason)) returning id into request_id;
  insert into public.audit_events(event_type,actor_id,subject_profile_id,entity_type,entity_id)
    values('family.change_requested',auth.uid(),link.dependent_id,'family_change_request',request_id);
  return request_id;
end $$;

-- Retain old callers safely: ending a relationship now submits a request.
create or replace function public.end_family_link(link_id uuid)
returns void language plpgsql security definer set search_path=public as $$
begin
  perform public.request_family_change(link_id,'unlink',null,'Relationship unlink requested');
end $$;

create or replace function public.accept_family_transfer(target_request uuid, accept_transfer boolean)
returns void language plpgsql security definer set search_path=public as $$
declare request public.family_change_requests;
begin
  select * into request from public.family_change_requests where id=target_request for update;
  if not found or auth.uid() is distinct from request.new_guardian_id or request.status<>'awaiting_acceptance'
    or accept_transfer is null then raise exception 'transfer acceptance unavailable'; end if;
  update public.family_change_requests set status=case when accept_transfer then 'pending_review' else 'rejected' end,
    accepted_at=case when accept_transfer then now() else null end where id=request.id;
  insert into public.audit_events(event_type,actor_id,subject_profile_id,entity_type,entity_id)
    values(case when accept_transfer then 'family.transfer_accepted' else 'family.transfer_declined' end,
      auth.uid(),request.dependent_id,'family_change_request',request.id);
end $$;

create or replace function public.review_family_change(target_request uuid, approve_change boolean, staff_note text)
returns void language plpgsql security definer set search_path=public as $$
declare request public.family_change_requests; link public.family_links; new_link uuid; payer_household uuid; change_time timestamptz := now();
begin
  if auth.uid() is null or not exists(select 1 from public.profiles where id=auth.uid() and is_staff) then raise exception 'forbidden'; end if;
  if approve_change is null or staff_note is null or length(trim(staff_note)) not between 3 and 1000 then raise exception 'review note required'; end if;
  select * into request from public.family_change_requests where id=target_request for update;
  if not found or request.status<>'pending_review' then raise exception 'request is not ready for review'; end if;
  if approve_change then
    select * into link from public.family_links where id=request.family_link_id for update;
    perform 1 from public.profiles where id in (request.dependent_id,request.new_guardian_id) order by id for update;
    if link.status<>'active' or not exists(select 1 from public.dependent_billing_links
      where family_link_id=link.id and effective_to is null) then raise exception 'relationship changed; submit a new request'; end if;
    if request.kind='unlink' and not exists(select 1 from public.profiles where id=request.dependent_id
      and date_of_birth <= (change_time at time zone 'Africa/Johannesburg')::date - interval '18 years') then
      raise exception 'minor or unverified adult requires an accepted transfer';
    end if;
    if request.kind='transfer' then
      if request.accepted_at is null or not exists(select 1 from public.profiles where id=request.new_guardian_id
        and date_of_birth <= (change_time at time zone 'Africa/Johannesburg')::date - interval '18 years'
        and public.active_billing_payer(id)=id) then raise exception 'new payer is no longer eligible'; end if;
      select id into payer_household from public.households where payer_id=request.new_guardian_id;
      if payer_household is null then raise exception 'payer household unavailable'; end if;
    end if;
    update public.family_links set status='ended',ended_at=change_time where id=link.id;
    update public.dependent_billing_links set effective_to=greatest(change_time,effective_from+interval '1 microsecond')
      where family_link_id=link.id and effective_to is null;
    if request.kind='transfer' then
      update public.family_links set status='rejected',rejected_at=change_time
        where guardian_id=request.new_guardian_id and dependent_id=request.dependent_id and status='pending';
      insert into public.family_links(guardian_id,dependent_id,status,requested_by,accepted_by,accepted_at)
        values(request.new_guardian_id,request.dependent_id,'active',request.dependent_id,request.new_guardian_id,request.accepted_at) returning id into new_link;
      insert into public.dependent_billing_links(household_id,guardian_id,dependent_id,family_link_id,effective_from)
        values(payer_household,request.new_guardian_id,request.dependent_id,new_link,change_time);
    end if;
  end if;
  update public.family_change_requests set status=case when approve_change then 'approved' else 'rejected' end,
    reviewed_by=auth.uid(),reviewed_at=change_time,review_note=trim(staff_note) where id=request.id;
  insert into public.audit_events(event_type,actor_id,subject_profile_id,entity_type,entity_id,metadata)
    values(case when approve_change then 'family.change_approved' else 'family.change_rejected' end,
      auth.uid(),request.dependent_id,'family_change_request',request.id,
      jsonb_build_object('old_guardian_id',request.old_guardian_id,'new_guardian_id',request.new_guardian_id,'note',trim(staff_note)));
end $$;
revoke all on function public.request_family_change(uuid,text,text,text), public.accept_family_transfer(uuid,boolean),
  public.review_family_change(uuid,boolean,text), public.end_family_link(uuid) from public, anon;
grant execute on function public.request_family_change(uuid,text,text,text), public.accept_family_transfer(uuid,boolean),
  public.review_family_change(uuid,boolean,text), public.end_family_link(uuid) to authenticated;

-- Retire the household-moving bypass; responsibility changes use the audited workflow.
revoke all on function public.attach_dependent(uuid,uuid) from public, anon, authenticated;

create or replace function public.protect_linked_minor_birth_date()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if new.date_of_birth is distinct from old.date_of_birth
    and (old.date_of_birth is null or old.date_of_birth > (now() at time zone 'Africa/Johannesburg')::date - interval '18 years')
    and exists(select 1 from public.dependent_billing_links where dependent_id=old.id and effective_to is null)
    and auth.uid() is not null
    and not exists(select 1 from public.profiles where id=auth.uid() and is_staff) then
    raise exception 'staff must correct a linked minor birth date';
  end if;
  return new;
end $$;
create trigger protect_linked_minor_birth_date before update of date_of_birth on public.profiles
  for each row execute function public.protect_linked_minor_birth_date();

-- All relationship writers lock profiles in the same order before checking cardinality.
-- A payer cannot become a dependent while still responsible for another account.
create or replace function public.respond_family_link(link_id uuid, response text)
returns void language plpgsql security definer set search_path=public as $$
declare link public.family_links; household uuid;
begin
  if response is null or response not in ('accept','reject') then raise exception 'invalid response'; end if;
  select * into link from public.family_links where id=link_id and dependent_id=auth.uid()
    and status='pending' for update;
  if not found then raise exception 'pending link not found'; end if;
  if response='reject' then
    update public.family_links set status='rejected',rejected_at=now() where id=link.id;
  else
    perform 1 from public.profiles where id in (link.guardian_id,link.dependent_id) order by id for update;
    if public.active_billing_payer(link.guardian_id)<>link.guardian_id then
      raise exception 'guardian must be an independent payer';
    end if;
    if exists(select 1 from public.dependent_billing_links where guardian_id=link.dependent_id and effective_to is null) then
      raise exception 'transfer existing dependent responsibilities first';
    end if;
    if exists(select 1 from public.dependent_billing_links where dependent_id=link.dependent_id and effective_to is null) then
      raise exception 'dependent already has a billing guardian';
    end if;
    select id into household from public.households where payer_id=link.guardian_id;
    if household is null then raise exception 'payer household unavailable'; end if;
    update public.family_links set status='active',accepted_by=auth.uid(),accepted_at=now() where id=link.id;
    insert into public.dependent_billing_links(household_id,guardian_id,dependent_id,family_link_id)
      values(household,link.guardian_id,link.dependent_id,link.id);
    insert into public.audit_events(event_type,actor_id,subject_profile_id,entity_type,entity_id)
      values('billing.responsibility_started',auth.uid(),link.dependent_id,'dependent_billing_link',link.id);
  end if;
  insert into public.audit_events(event_type,actor_id,subject_profile_id,entity_type,entity_id)
    values('family.link_'||case response when 'accept' then 'accepted' else 'rejected' end,
      auth.uid(),link.dependent_id,'family_link',link.id);
end $$;
revoke all on function public.respond_family_link(uuid,text) from public, anon;
grant execute on function public.respond_family_link(uuid,text) to authenticated;

-- Prefer the open responsibility when imported records share the transfer timestamp.
create or replace function public.active_billing_payer(target_participant uuid, at_time timestamptz default now())
returns uuid language sql stable security definer set search_path=public as $$
  select coalesce(
    (select dbl.guardian_id from public.dependent_billing_links dbl
     where dbl.dependent_id=target_participant and dbl.effective_from<=at_time
       and (dbl.effective_to is null or dbl.effective_to>at_time)
     order by (dbl.effective_to is null) desc,dbl.effective_from desc limit 1),
    target_participant
  );
$$;
