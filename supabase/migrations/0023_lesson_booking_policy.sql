-- Sponsor-confirmed lesson policy.  Policy and price terms are copied to the
-- booking so later configuration changes cannot rewrite a customer's contract.

alter table public.lesson_booking_settings
  add column cancellation_partial_window_hours integer not null default 6 check (cancellation_partial_window_hours >= 0),
  add column cancellation_partial_fee_multiplier numeric(6,2) not null default .5 check (cancellation_partial_fee_multiplier between 0 and 1),
  add column booking_horizon_calendar_months integer not null default 3 check (booking_horizon_calendar_months between 1 and 12);

update public.lesson_booking_settings
set cancellation_window_hours=12, cancellation_partial_window_hours=6,
  cancellation_partial_fee_multiplier=.5, booking_cutoff_minutes=720,
  booking_horizon_calendar_months=3, future_booking_cap_per_fencer=null
where singleton;

alter table public.bookings
  add column booked_partial_cancellation_window_hours integer,
  add column booked_partial_fee_multiplier numeric(6,2),
  add column booked_product_code text,
  add column booked_coach_allocation_cents bigint,
  add column booked_club_allocation_cents bigint;

-- Existing rows retain the terms already recorded by 0016: a free window and
-- then its historical late multiplier.  They are never silently converted to
-- the new 12/6 policy.
update public.bookings
set booked_partial_cancellation_window_hours=0,
  booked_partial_fee_multiplier=booked_late_fee_multiplier,
  booked_product_code=coalesce(booked_product_code, 'legacy_standard'),
  booked_coach_allocation_cents=coalesce(booked_coach_allocation_cents, 0),
  booked_club_allocation_cents=coalesce(booked_club_allocation_cents, 0)
where booking_model='lesson_v2';

create table public.lesson_products (
  code text primary key check (code in ('standard_30', 'intro', 'beginner_package')),
  display_name text not null,
  customer_price_cents bigint not null check (customer_price_cents >= 0),
  coach_allocation_cents bigint not null check (coach_allocation_cents >= 0),
  club_allocation_cents bigint not null check (club_allocation_cents >= 0),
  requires_pay_now boolean not null default false,
  requires_entitlement boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  check (customer_price_cents = coach_allocation_cents + club_allocation_cents)
);
insert into public.lesson_products(code,display_name,customer_price_cents,coach_allocation_cents,club_allocation_cents,requires_pay_now,requires_entitlement)
values
  ('standard_30','Standard 30-minute lesson',30000,25000,5000,false,false),
  ('intro','Intro lesson',15000,15000,0,true,true),
  ('beginner_package','Beginner-package lesson',0,25000,0,false,true)
on conflict (code) do update set display_name=excluded.display_name, customer_price_cents=excluded.customer_price_cents,
  coach_allocation_cents=excluded.coach_allocation_cents, club_allocation_cents=excluded.club_allocation_cents,
  requires_pay_now=excluded.requires_pay_now, requires_entitlement=excluded.requires_entitlement;

create table public.lesson_entitlements (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  product_code text not null references public.lesson_products(code),
  remaining_uses integer not null check (remaining_uses >= 0),
  granted_at timestamptz not null default now(),
  consumed_at timestamptz,
  consumed_booking_id uuid references public.bookings(id) on delete restrict,
  source text not null check (source in ('new_account','beginner_package','staff')),
  unique(profile_id,product_code,source)
);

create function public.grant_new_account_intro_entitlement() returns trigger language plpgsql security definer set search_path=public as $$
begin
  insert into public.lesson_entitlements(profile_id,product_code,remaining_uses,source)
  values(new.id,'intro',1,'new_account') on conflict(profile_id,product_code,source) do nothing;
  return new;
end $$;
create trigger grant_new_account_intro_entitlement after insert on public.profiles
  for each row execute function public.grant_new_account_intro_entitlement();

create table public.lesson_booking_allocations (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete restrict,
  participant_id uuid not null references public.profiles(id) on delete restrict,
  coach_id uuid not null references public.profiles(id) on delete restrict,
  product_code text not null references public.lesson_products(code),
  coach_payable_cents bigint not null check (coach_payable_cents >= 0),
  club_allocation_cents bigint not null check (club_allocation_cents >= 0),
  status text not null default 'pending' check (status in ('pending','payable','voided')),
  created_at timestamptz not null default now(),
  voided_at timestamptz,
  unique(booking_id,participant_id)
);
alter table public.lesson_booking_allocations enable row level security;
create policy "Financial staff can read lesson allocations" on public.lesson_booking_allocations for select using (public.current_user_is_admin());

-- A three-calendar-month Johannesburg horizon, rather than a rolling-day approximation.
create or replace function public.lesson_time_is_available(
  target_coach uuid, target_starts_at timestamptz, target_weapon text, ignored_booking uuid default null
) returns boolean language sql stable security definer set search_path=public as $$
  with cfg as (select * from public.lesson_booking_settings where singleton), local_time as (
    select target_starts_at at time zone 'Africa/Johannesburg' as local_start,
      (target_starts_at + make_interval(mins => cfg.lesson_duration_minutes)) at time zone 'Africa/Johannesburg' as local_end,
      ((date_trunc('month', now() at time zone 'Africa/Johannesburg')::date + (cfg.booking_horizon_calendar_months || ' months')::interval)::timestamp at time zone 'Africa/Johannesburg') as horizon_end,
      cfg.* from cfg
  ) select exists(select 1 from local_time l where target_weapon in ('foil','epee','sabre')
    and target_starts_at >= now()+make_interval(mins => l.booking_cutoff_minutes) and target_starts_at < l.horizon_end
    and exists(select 1 from public.coach_lesson_profiles cp where cp.coach_id=target_coach and cp.is_active)
    and exists(select 1 from public.profiles p where p.id=target_coach and p.is_active and p.is_staff and p.staff_type='coach')
    and exists(select 1 from public.coach_lesson_weapons cw where cw.coach_id=target_coach and cw.weapon=target_weapon)
    and (exists(select 1 from public.coach_availability_rules r where r.coach_id=target_coach and r.is_active and r.iso_weekday=extract(isodow from l.local_start)::smallint and l.local_start::time>=r.starts_at_local and l.local_end::time<=r.ends_at_local and mod(extract(epoch from (l.local_start::time-r.starts_at_local)),l.lesson_duration_minutes*60)=0)
      or exists(select 1 from public.coach_availability_exceptions e where e.coach_id=target_coach and e.exception_type='extra' and e.starts_at<=target_starts_at and e.ends_at>=target_starts_at+make_interval(mins => l.lesson_duration_minutes) and mod(extract(epoch from (target_starts_at-e.starts_at)),l.lesson_duration_minutes*60)=0))
    and not exists(select 1 from public.coach_availability_exceptions e where e.coach_id=target_coach and e.exception_type='block' and e.starts_at<target_starts_at+make_interval(mins => l.lesson_duration_minutes) and e.ends_at>target_starts_at)
    and not exists(select 1 from public.club_closures c where c.cancelled_at is null and l.local_start::date between c.starts_on and c.ends_on)
    and not exists(select 1 from public.bookings b where b.booking_model='lesson_v2' and b.coach_id=target_coach and b.starts_at<target_starts_at+make_interval(mins => l.lesson_duration_minutes) and b.ends_at>target_starts_at and b.status in ('scheduled','attended','no_show') and (ignored_booking is null or b.id<>ignored_booking)));
$$;

-- Preserve the existing lock/slot implementation behind an internal function.
alter function public.create_lesson_booking_v3(uuid,timestamptz,uuid[],text,text) rename to create_lesson_booking_v3_legacy;

create function public.create_lesson_booking_v3(target_coach uuid,target_starts_at timestamptz,target_participant_ids uuid[],target_weapon text,target_payment_option text default 'pay_later',target_product_code text default 'standard_30')
returns uuid language plpgsql security definer set search_path=public as $$
declare v_booking uuid; v_product public.lesson_products; v_participant uuid; v_payer uuid; v_entitlement public.lesson_entitlements;
begin
  select * into v_product from public.lesson_products where code=target_product_code and is_active;
  if not found then raise exception using message='invalid_product',errcode='P0001'; end if;
  if exists(select 1 from unnest(target_participant_ids) participant join public.profiles p on p.id=participant where p.membership_status='guest') and target_payment_option<>'pay_now'
  then raise exception using message='pay_now_required',errcode='P0001'; end if;
  if v_product.requires_pay_now and target_payment_option<>'pay_now' then raise exception using message='pay_now_required',errcode='P0001'; end if;
  if target_payment_option='pay_now' and public.active_billing_payer(auth.uid())<>auth.uid() then raise exception using message='forbidden',errcode='P0001'; end if;
  v_participant:=target_participant_ids[1]; v_payer:=public.active_billing_payer(v_participant);
  if v_product.requires_entitlement then
    select * into v_entitlement from public.lesson_entitlements where profile_id=v_participant and product_code=v_product.code and remaining_uses>0 order by granted_at for update;
    if not found and v_product.code='beginner_package' and exists(select 1 from public.memberships m join public.membership_types mt on mt.id=m.membership_type_id where m.profile_id=v_participant and m.status='active' and mt.code='beginner_package') then
      insert into public.lesson_entitlements(profile_id,product_code,remaining_uses,source) values(v_participant,'beginner_package',4,'beginner_package') on conflict(profile_id,product_code,source) do nothing;
      select * into v_entitlement from public.lesson_entitlements where profile_id=v_participant and product_code=v_product.code and remaining_uses>0 order by granted_at for update;
    end if;
    if not found then raise exception using message='entitlement_unavailable',errcode='P0001'; end if;
  end if;
  v_booking:=public.create_lesson_booking_v3_legacy(target_coach,target_starts_at,target_participant_ids,target_weapon,target_payment_option);
  update public.bookings set booked_product_code=v_product.code, booked_unit_price_cents=v_product.customer_price_cents,
    booked_coach_allocation_cents=v_product.coach_allocation_cents, booked_club_allocation_cents=v_product.club_allocation_cents,
    booked_cancellation_window_hours=12, booked_partial_cancellation_window_hours=6, booked_partial_fee_multiplier=.5, booked_late_fee_multiplier=1
  where id=v_booking;
  update public.charges set amount_cents=v_product.customer_price_cents, amount=v_product.customer_price_cents/100.0,
    description=v_product.display_name where booking_id=v_booking and type='lesson';
  insert into public.lesson_booking_allocations(booking_id,participant_id,coach_id,product_code,coach_payable_cents,club_allocation_cents)
  select v_booking,bp.participant_id,target_coach,v_product.code,v_product.coach_allocation_cents,v_product.club_allocation_cents from public.booking_participants bp where bp.booking_id=v_booking;
  if v_product.requires_entitlement then update public.lesson_entitlements set remaining_uses=remaining_uses-1,consumed_at=now(),consumed_booking_id=v_booking where id=v_entitlement.id; end if;
  return v_booking;
end $$;
revoke all on function public.create_lesson_booking_v3(uuid,timestamptz,uuid[],text,text,text) from public,anon;
grant execute on function public.create_lesson_booking_v3(uuid,timestamptz,uuid[],text,text,text) to authenticated;

create or replace function public.cancel_lesson_booking_v2(target_booking uuid,target_reason text default null,target_actor_type text default 'member')
returns void language plpgsql security definer set search_path=public as $$
declare b public.bookings; c public.charges; multiplier numeric; no_charge boolean;
begin
  select * into b from public.bookings where id=target_booking and booking_model='lesson_v2' for update;
  if not found or b.status<>'scheduled' then raise exception using message='booking_not_scheduled',errcode='P0001'; end if;
  if b.starts_at<=now() then raise exception using message='booking_already_started',errcode='P0001'; end if;
  if target_actor_type not in ('member','payer','coach','admin','closure','system') then raise exception using message='invalid_actor_type',errcode='P0001'; end if;
  if target_actor_type='coach' and not (b.coach_id=auth.uid() or public.current_user_is_admin()) then raise exception using message='forbidden',errcode='P0001'; end if;
  if target_actor_type in ('admin','closure','system') and not public.current_user_is_admin() then raise exception using message='forbidden',errcode='P0001'; end if;
  if target_actor_type in ('member','payer') and not public.lesson_actor_can_manage_booking(target_booking) then raise exception using message='forbidden',errcode='P0001'; end if;
  no_charge:=target_actor_type in ('coach','admin','closure','system') or b.payment_state='held';
  multiplier:=case when no_charge or b.starts_at>=now()+make_interval(hours=>b.booked_cancellation_window_hours) then 0
    when coalesce(b.booked_partial_cancellation_window_hours,0)>0 and b.starts_at>=now()+make_interval(hours=>b.booked_partial_cancellation_window_hours) then coalesce(b.booked_partial_fee_multiplier,.5)
    else 1 end;
  update public.bookings set status='cancelled',cancellation_actor_id=auth.uid(),cancellation_actor_type=target_actor_type,cancellation_reason=nullif(trim(target_reason),''),cancelled_at=now(),updated_at=now() where id=b.id;
  for c in select * from public.charges where booking_id=b.id and type='lesson' and lifecycle_state not in ('voided','waived') loop
    perform public.apply_lesson_charge_policy(c.id,round(b.booked_unit_price_cents*multiplier)::bigint,'Lesson cancellation');
  end loop;
  update public.lesson_booking_allocations set status='voided',voided_at=now() where booking_id=b.id and multiplier=0;
  insert into public.audit_events(event_type,actor_id,subject_profile_id,entity_type,entity_id,metadata) values('lesson.booking_cancelled',auth.uid(),b.fencer_id,'booking',b.id,jsonb_build_object('actor_type',target_actor_type,'fee_multiplier',multiplier));
end $$;

create table public.lesson_notification_outbox (
  id uuid primary key default gen_random_uuid(), recipient_id uuid not null references public.profiles(id) on delete cascade,
  booking_id uuid not null references public.bookings(id) on delete cascade, channel text not null check (channel in ('email','whatsapp')),
  notification_kind text not null default 'lesson_reminder', scheduled_for timestamptz not null, status text not null default 'scheduled' check (status in ('scheduled','processing','sent','cancelled','failed')),
  idempotency_key text not null unique, delivery_attempts integer not null default 0, provider_reference text, last_error text, sent_at timestamptz, cancelled_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
alter table public.profiles add column reminder_preference text not null default 'email' check (reminder_preference in ('email','whatsapp','both'));
alter table public.lesson_notification_outbox enable row level security;
create policy "Recipients can read their notification outbox" on public.lesson_notification_outbox for select using (recipient_id=auth.uid());

create function public.schedule_lesson_reminders() returns trigger language plpgsql security definer set search_path=public as $$
declare p public.profiles; channel_name text;
begin
  if new.booking_model<>'lesson_v2' or new.status<>'scheduled' or new.starts_at<=now()+interval '24 hours' then return new; end if;
  select * into p from public.profiles where id=public.active_billing_payer(new.fencer_id);
  foreach channel_name in array case p.reminder_preference when 'both' then array['email','whatsapp'] when 'whatsapp' then array['whatsapp'] else array['email'] end loop
    insert into public.lesson_notification_outbox(recipient_id,booking_id,channel,scheduled_for,idempotency_key)
    values(p.id,new.id,channel_name,new.starts_at-interval '24 hours','lesson-reminder:'||new.id||':'||channel_name)
    on conflict(idempotency_key) do nothing;
  end loop;
  return new;
end $$;
create trigger schedule_lesson_reminders after insert on public.bookings for each row execute function public.schedule_lesson_reminders();
create function public.cancel_stale_lesson_reminders() returns trigger language plpgsql security definer set search_path=public as $$
begin
  if new.status in ('cancelled','rescheduled') and old.status='scheduled' then update public.lesson_notification_outbox set status='cancelled',cancelled_at=now(),updated_at=now() where booking_id=new.id and status in ('scheduled','processing'); end if;
  return new;
end $$;
create trigger cancel_stale_lesson_reminders after update of status on public.bookings for each row execute function public.cancel_stale_lesson_reminders();

-- The provider is intentionally feature-gated.  A worker can claim rows only
-- after an approved provider enables the setting; this function never claims
-- or marks a delivery sent while it remains disabled.
create function public.claim_due_lesson_reminders(batch_size integer default 25)
returns setof public.lesson_notification_outbox language plpgsql security definer set search_path=public as $$
begin
  if not exists(select 1 from public.lesson_booking_settings where singleton and external_reminders_enabled) then return; end if;
  if not public.current_user_is_admin() then raise exception 'forbidden'; end if;
  return query update public.lesson_notification_outbox set status='processing',delivery_attempts=delivery_attempts+1,updated_at=now()
    where id in (select id from public.lesson_notification_outbox where status in ('scheduled','failed') and scheduled_for<=now() order by scheduled_for for update skip locked limit batch_size) returning *;
end $$;
revoke all on function public.claim_due_lesson_reminders(integer) from public,anon,authenticated;
grant execute on function public.claim_due_lesson_reminders(integer) to service_role;

create function public.payer_has_lesson_booking_arrears(target_payer uuid)
returns boolean language sql stable security definer set search_path=public as $$
  with latest_cycle as (
    select max(period) as period from public.invoices
    where payer_id=target_payer
      and (issued_at at time zone 'Africa/Johannesburg')::date >=
        (date_trunc('month', issued_at at time zone 'Africa/Johannesburg')::date + 24)
  )
  select exists(select 1 from public.invoices i cross join latest_cycle c
    where i.payer_id=target_payer and i.status in ('unpaid','overdue')
      and c.period is not null and i.period<c.period);
$$;

create table public.lesson_booking_staff_alerts (
  id uuid primary key default gen_random_uuid(), booking_id uuid not null unique references public.bookings(id) on delete cascade,
  payer_id uuid not null references public.profiles(id) on delete restrict, alert_type text not null default 'arrears_booking',
  created_at timestamptz not null default now()
);
alter table public.lesson_booking_staff_alerts enable row level security;
create policy "Financial staff can read booking arrears alerts" on public.lesson_booking_staff_alerts for select using (public.current_user_is_admin());

create function public.record_lesson_booking_arrears_alert() returns trigger language plpgsql security definer set search_path=public as $$
declare payer uuid;
begin
  if new.booking_model='lesson_v2' and new.status='scheduled' then
    payer:=public.active_billing_payer(new.fencer_id);
    if public.payer_has_lesson_booking_arrears(payer) then
      insert into public.lesson_booking_staff_alerts(booking_id,payer_id) values(new.id,payer) on conflict(booking_id) do nothing;
    end if;
  end if;
  return new;
end $$;
create trigger record_lesson_booking_arrears_alert after insert on public.bookings for each row execute function public.record_lesson_booking_arrears_alert();

create function public.reject_intro_lesson_booking(target_booking uuid,target_reason text)
returns void language plpgsql security definer set search_path=public as $$
declare b public.bookings;
begin
  if nullif(trim(target_reason),'') is null then raise exception using message='rejection_reason_required',errcode='P0001'; end if;
  select * into b from public.bookings where id=target_booking and booked_product_code='intro' for update;
  if not found then raise exception using message='not_found',errcode='P0001'; end if;
  if not (public.current_user_is_admin() or (auth.uid()=b.coach_id and exists(select 1 from public.profiles where id=auth.uid() and is_staff and staff_type='coach'))) then raise exception using message='forbidden',errcode='P0001'; end if;
  perform public.cancel_lesson_booking_v2(target_booking,target_reason,'coach');
  insert into public.audit_events(event_type,actor_id,subject_profile_id,entity_type,entity_id,metadata)
    values('lesson.intro_rejected',auth.uid(),b.fencer_id,'booking',b.id,jsonb_build_object('reason',target_reason));
end $$;
revoke all on function public.reject_intro_lesson_booking(uuid,text) from public,anon;
grant execute on function public.reject_intro_lesson_booking(uuid,text) to authenticated;

create or replace function public.reschedule_lesson_booking_v2(target_booking uuid,target_starts_at timestamptz)
returns uuid language plpgsql security definer set search_path=public as $$
declare old_b public.bookings; new_booking uuid; participant_ids uuid[]; c public.charges; multiplier numeric;
begin
  select * into old_b from public.bookings where id=target_booking and booking_model='lesson_v2' for update;
  if not found or old_b.status<>'scheduled' then raise exception using message='booking_not_scheduled',errcode='P0001'; end if;
  if old_b.starts_at<=now() then raise exception using message='booking_already_started',errcode='P0001'; end if;
  if not public.lesson_actor_can_manage_booking(target_booking) then raise exception using message='forbidden',errcode='P0001'; end if;
  if old_b.payment_state='held' then raise exception using message='booking_not_scheduled',errcode='P0001'; end if;
  select array_agg(participant_id order by ordinal) into participant_ids from public.booking_participants where booking_id=old_b.id;
  new_booking:=public.create_lesson_booking_v2(old_b.coach_id,target_starts_at,participant_ids,old_b.weapon);
  update public.bookings set status='rescheduled',rescheduled_to_booking_id=new_booking,updated_at=now() where id=old_b.id;
  update public.bookings set rescheduled_from_booking_id=old_b.id,booked_unit_price_cents=old_b.booked_unit_price_cents,
    booked_cancellation_window_hours=old_b.booked_cancellation_window_hours,booked_partial_cancellation_window_hours=old_b.booked_partial_cancellation_window_hours,
    booked_partial_fee_multiplier=old_b.booked_partial_fee_multiplier,booked_late_fee_multiplier=old_b.booked_late_fee_multiplier,
    booked_no_show_multiplier=old_b.booked_no_show_multiplier,booked_product_code=old_b.booked_product_code,
    booked_coach_allocation_cents=old_b.booked_coach_allocation_cents,booked_club_allocation_cents=old_b.booked_club_allocation_cents,updated_at=now() where id=new_booking;
  update public.charges new_charge set replaced_charge_id=old_charge.id,payer_id=old_charge.payer_id,amount_cents=old_b.booked_unit_price_cents,amount=old_b.booked_unit_price_cents/100.0,updated_at=now()
    from public.charges old_charge where new_charge.booking_id=new_booking and old_charge.booking_id=old_b.id and old_charge.fencer_id=new_charge.fencer_id;
  insert into public.lesson_booking_allocations(booking_id,participant_id,coach_id,product_code,coach_payable_cents,club_allocation_cents)
    select new_booking,participant_id,old_b.coach_id,old_b.booked_product_code,old_b.booked_coach_allocation_cents,old_b.booked_club_allocation_cents from public.booking_participants where booking_id=new_booking
    on conflict(booking_id,participant_id) do nothing;
  multiplier:=case when old_b.starts_at>=now()+make_interval(hours=>old_b.booked_cancellation_window_hours) then 0
    when coalesce(old_b.booked_partial_cancellation_window_hours,0)>0 and old_b.starts_at>=now()+make_interval(hours=>old_b.booked_partial_cancellation_window_hours) then coalesce(old_b.booked_partial_fee_multiplier,.5)
    else 1 end;
  for c in select * from public.charges where booking_id=old_b.id and type='lesson' and lifecycle_state not in ('voided','waived') loop perform public.apply_lesson_charge_policy(c.id,round(old_b.booked_unit_price_cents*multiplier)::bigint,'Lesson reschedule'); end loop;
  if multiplier=0 then update public.lesson_booking_allocations set status='voided',voided_at=now() where booking_id=old_b.id; end if;
  insert into public.audit_events(event_type,actor_id,subject_profile_id,entity_type,entity_id,metadata) values('lesson.booking_rescheduled',auth.uid(),old_b.fencer_id,'booking',new_booking,jsonb_build_object('from_booking_id',old_b.id,'fee_multiplier',multiplier));
  return new_booking;
end $$;
