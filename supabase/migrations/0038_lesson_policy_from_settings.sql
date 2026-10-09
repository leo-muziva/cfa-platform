-- Lesson settings were partly decorative: create_lesson_booking_v3 (0023)
-- hardcoded 12h free / 6h half-fee terms, so editing the settings page had
-- no effect. New bookings now copy their cancellation terms from the
-- settings singleton. Existing bookings keep the terms they were booked on.

-- 1. Make the stored settings match what was actually being enforced, so
--    behaviour does not change on deploy.
update public.lesson_booking_settings set
  cancellation_window_hours=12,
  cancellation_partial_window_hours=6,
  cancellation_partial_fee_multiplier=.5,
  late_cancellation_fee_multiplier=1
where singleton;

alter table public.lesson_booking_settings
  add constraint lesson_booking_settings_partial_inside_free_window
  check (cancellation_partial_window_hours <= cancellation_window_hours);

-- 2. Booking copies terms from settings instead of literals.
create or replace function public.create_lesson_booking_v3(target_coach uuid,target_starts_at timestamptz,target_participant_ids uuid[],target_weapon text,target_payment_option text default 'pay_later',target_product_code text default 'standard_30')
returns uuid language plpgsql security definer set search_path=public as $$
declare v_booking uuid; v_product public.lesson_products; v_participant uuid; v_payer uuid; v_entitlement public.lesson_entitlements;
  v_settings public.lesson_booking_settings;
begin
  select * into v_product from public.lesson_products where code=target_product_code and is_active;
  if not found then raise exception using message='invalid_product',errcode='P0001'; end if;
  select * into v_settings from public.lesson_booking_settings where singleton;
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
    booked_cancellation_window_hours=v_settings.cancellation_window_hours,
    booked_partial_cancellation_window_hours=v_settings.cancellation_partial_window_hours,
    booked_partial_fee_multiplier=v_settings.cancellation_partial_fee_multiplier,
    booked_late_fee_multiplier=v_settings.late_cancellation_fee_multiplier
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

-- 3. Cancellation used late_cancellation_fee_multiplier only as a literal 1;
--    honour the booked late multiplier for the inside-partial-window band.
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
    else coalesce(b.booked_late_fee_multiplier,1) end;
  update public.bookings set status='cancelled',cancellation_actor_id=auth.uid(),cancellation_actor_type=target_actor_type,cancellation_reason=nullif(trim(target_reason),''),cancelled_at=now(),updated_at=now() where id=b.id;
  for c in select * from public.charges where booking_id=b.id and type='lesson' and lifecycle_state not in ('voided','waived') loop
    perform public.apply_lesson_charge_policy(c.id,round(b.booked_unit_price_cents*multiplier)::bigint,'Lesson cancellation');
  end loop;
  update public.lesson_booking_allocations set status='voided',voided_at=now() where booking_id=b.id and multiplier=0;
  insert into public.audit_events(event_type,actor_id,subject_profile_id,entity_type,entity_id,metadata) values('lesson.booking_cancelled',auth.uid(),b.fencer_id,'booking',b.id,jsonb_build_object('actor_type',target_actor_type,'fee_multiplier',multiplier));
end $$;

-- 4. Settings RPC accepts the enforced fields. single_lesson_price_cents and
--    booking_horizon_days stay accepted for old callers but have no effect:
--    price comes from lesson_products, horizon from calendar months.
create or replace function public.update_lesson_booking_settings(settings_patch jsonb)
returns public.lesson_booking_settings language plpgsql security definer set search_path=public as $$
declare result public.lesson_booking_settings;
begin
  if not public.current_user_is_admin() then raise exception using message='forbidden',errcode='P0001'; end if;
  if settings_patch ?| array['payment_mode','double_lesson_multiplier','double_lesson_atomic','closure_mode',
    'lesson_duration_minutes','arrears_blocking_enabled','future_booking_cap_per_fencer']
  then raise exception using message='locked_setting',errcode='P0001'; end if;
  update public.lesson_booking_settings set
    cancellation_window_hours=coalesce((settings_patch->>'cancellation_window_hours')::integer,cancellation_window_hours),
    cancellation_partial_window_hours=coalesce((settings_patch->>'cancellation_partial_window_hours')::integer,cancellation_partial_window_hours),
    cancellation_partial_fee_multiplier=coalesce((settings_patch->>'cancellation_partial_fee_multiplier')::numeric,cancellation_partial_fee_multiplier),
    late_cancellation_fee_multiplier=coalesce((settings_patch->>'late_cancellation_fee_multiplier')::numeric,late_cancellation_fee_multiplier),
    no_show_fee_multiplier=coalesce((settings_patch->>'no_show_fee_multiplier')::numeric,no_show_fee_multiplier),
    booking_horizon_days=coalesce((settings_patch->>'booking_horizon_days')::integer,booking_horizon_days),
    booking_horizon_calendar_months=coalesce((settings_patch->>'booking_horizon_calendar_months')::integer,booking_horizon_calendar_months),
    booking_cutoff_minutes=coalesce((settings_patch->>'booking_cutoff_minutes')::integer,booking_cutoff_minutes),
    single_lesson_price_cents=coalesce((settings_patch->>'single_lesson_price_cents')::integer,single_lesson_price_cents),
    updated_by=auth.uid(),updated_at=now()
  where singleton returning * into result;
  return result;
exception when check_violation or invalid_text_representation then
  raise exception using message='invalid_settings',errcode='P0001';
end $$;

-- 5. Member lesson list exposes the booked fee bands as percentages so the
--    cancel step can warn before confirming. Still money-free for dependents.
drop function public.list_my_lesson_bookings();
create function public.list_my_lesson_bookings()
returns table(
  booking_id uuid,coach_id uuid,coach_name text,starts_at timestamptz,ends_at timestamptz,
  weapon text,status text,participant_names text[],cancelled_at timestamptz,cancellation_reason text,cancellation_deadline timestamptz,
  rescheduled_from_booking_id uuid,rescheduled_to_booking_id uuid,awaiting_payment boolean,hold_expires_at timestamptz,
  partial_fee_deadline timestamptz,partial_fee_percent integer,late_fee_percent integer
) language plpgsql stable security definer set search_path=public as $$
begin
  if auth.uid() is null
  then raise exception using message='forbidden',errcode='P0001'; end if;
  return query
  select b.id,b.coach_id,coach.full_name,b.starts_at,b.ends_at,b.weapon,
    case when b.payment_state='held' and b.hold_expires_at<=now() then 'cancelled' else b.status end,
    array_agg(participant.full_name order by bp.ordinal),
    case when b.payment_state='held' and b.hold_expires_at<=now() then b.hold_expires_at else b.cancelled_at end,
    case when b.payment_state='held' and b.hold_expires_at<=now() then 'Payment hold expired' else b.cancellation_reason end,
    b.starts_at-make_interval(hours => b.booked_cancellation_window_hours),
    b.rescheduled_from_booking_id,b.rescheduled_to_booking_id,
    coalesce(b.payment_state='held' and b.status='scheduled' and b.hold_expires_at>now(),false),
    case when b.payment_state='held' then b.hold_expires_at end,
    case when coalesce(b.booked_partial_cancellation_window_hours,0)>0
      then b.starts_at-make_interval(hours => b.booked_partial_cancellation_window_hours) end,
    round(coalesce(b.booked_partial_fee_multiplier,.5)*100)::integer,
    round(coalesce(b.booked_late_fee_multiplier,1)*100)::integer
  from public.bookings b join public.booking_participants bp on bp.booking_id=b.id
  join public.profiles participant on participant.id=bp.participant_id
  join public.profiles coach on coach.id=b.coach_id
  where b.booking_model='lesson_v2' and public.lesson_actor_can_manage_booking(b.id)
  group by b.id,coach.full_name order by b.starts_at;
end $$;
revoke all on function public.list_my_lesson_bookings() from public,anon;
grant execute on function public.list_my_lesson_bookings() to authenticated;
