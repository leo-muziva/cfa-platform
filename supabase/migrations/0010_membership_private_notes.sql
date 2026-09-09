-- Keep staff-only membership review notes outside applicant-readable rows.
create table public.membership_application_admin_notes (
  application_id uuid primary key references public.membership_applications(id) on delete cascade,
  private_notes text not null check (length(trim(private_notes)) > 0),
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);

insert into public.membership_application_admin_notes(application_id,private_notes,updated_by,updated_at)
select id,trim(private_notes),reviewer_id,coalesce(reviewed_at,updated_at)
from public.membership_applications
where nullif(trim(private_notes),'') is not null
on conflict on constraint membership_application_admin_notes_pkey do update set
  private_notes=excluded.private_notes,
  updated_by=excluded.updated_by,
  updated_at=excluded.updated_at;

alter table public.membership_applications drop column private_notes;

alter table public.membership_application_admin_notes enable row level security;
revoke all on public.membership_application_admin_notes from anon;
grant select on public.membership_application_admin_notes to authenticated;
grant all on public.membership_application_admin_notes to service_role;

create policy "admins read membership application notes"
  on public.membership_application_admin_notes for select to authenticated
  using(public.current_user_is_admin());

create or replace function public.review_membership_application(
  application_id uuid, decision text, visible_response text default null, private_notes text default null
) returns void language plpgsql security definer set search_path=public as $$
declare app public.membership_applications; new_status text; payer uuid; mt public.membership_types;
begin
  if not public.current_user_is_admin() then raise exception 'forbidden'; end if;
  if decision not in ('approve','request_changes','reject') then raise exception 'invalid decision'; end if;
  select * into app from public.membership_applications
    where id=$1 and status='pending' for update;
  if not found then raise exception 'pending application not found'; end if;
  new_status:=case decision when 'approve' then 'approved'
    when 'request_changes' then 'changes_requested' else 'rejected' end;
  update public.membership_applications set status=new_status,
    visible_response=nullif(trim($3),''),
    reviewer_id=auth.uid(),reviewed_at=now(),updated_at=now() where id=$1;
  insert into public.membership_application_admin_notes(application_id,private_notes,updated_by)
  select $1,trim($4),auth.uid()
  where nullif(trim($4),'') is not null
  on conflict on constraint membership_application_admin_notes_pkey do update set
    private_notes=excluded.private_notes,updated_by=excluded.updated_by,updated_at=now();
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
    'membership_application',$1,jsonb_build_object('decision',decision));
end $$;
