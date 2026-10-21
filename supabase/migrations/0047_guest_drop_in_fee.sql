-- Guests (drop-ins) pay the club drop-in fee once per day when they book a
-- lesson. The amount lives on the lesson settings singleton so staff can
-- change it (0 turns it off). It is a separate charge on the booking, so the
-- pay-now checkout total, hold settlement and hold expiry all include it
-- without changes. Cancelling a lesson does not refund it: cancellation
-- policy only adjusts the lesson charge.

alter table public.lesson_booking_settings
  add column drop_in_fee_cents bigint not null default 12000 check (drop_in_fee_cents >= 0);

alter table public.charges drop constraint charges_type_check;
alter table public.charges add constraint charges_type_check
  check (type in ('lesson', 'rental', 'membership', 'joining_fee', 'lesson_adjustment', 'shop', 'drop_in'));

-- Same as 0038, plus the drop-in fee after the lesson charges are priced.
create or replace function public.create_lesson_booking_v3(target_coach uuid,target_starts_at timestamptz,target_participant_ids uuid[],target_weapon text,target_payment_option text default 'pay_later',target_product_code text default 'standard_30')
returns uuid language plpgsql security definer set search_path=public as $$
declare v_booking uuid; v_product public.lesson_products; v_participant uuid; v_payer uuid; v_entitlement public.lesson_entitlements;
  v_settings public.lesson_booking_settings; v_local_date date; v_guest uuid;
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
  -- Drop-in fee: each guest pays it once per Cape Town day, on the first
  -- lesson booked that day. A voided fee (expired hold) no longer counts, so
  -- the next booking that day picks it up again.
  v_local_date:=(target_starts_at at time zone 'Africa/Johannesburg')::date;
  if v_settings.drop_in_fee_cents>0 then
    for v_guest in select p.id from unnest(target_participant_ids) participant
      join public.profiles p on p.id=participant where p.membership_status='guest' order by p.id loop
      perform pg_advisory_xact_lock(hashtextextended('drop-in/'||v_guest::text||'/'||v_local_date::text,0));
      if not exists(select 1 from public.charges c join public.bookings b on b.id=c.booking_id
        where c.fencer_id=v_guest and c.type='drop_in' and c.lifecycle_state not in ('voided','waived')
          and (b.starts_at at time zone 'Africa/Johannesburg')::date=v_local_date) then
        insert into public.charges(fencer_id,payer_id,booking_id,type,amount,amount_cents,status,period,description,lifecycle_state)
        values(v_guest,public.active_billing_payer(v_guest),v_booking,'drop_in',v_settings.drop_in_fee_cents/100.0,
          v_settings.drop_in_fee_cents,'unpaid',date_trunc('month',v_local_date)::date,'Drop-in fee','provisional');
        insert into public.audit_events(event_type,actor_id,subject_profile_id,entity_type,entity_id,metadata)
        values('lesson.drop_in_fee_charged',auth.uid(),v_guest,'booking',v_booking,
          jsonb_build_object('amount_cents',v_settings.drop_in_fee_cents,'local_date',v_local_date));
      end if;
    end loop;
  end if;
  return v_booking;
end $$;
revoke all on function public.create_lesson_booking_v3(uuid,timestamptz,uuid[],text,text,text) from public,anon;
grant execute on function public.create_lesson_booking_v3(uuid,timestamptz,uuid[],text,text,text) to authenticated;

-- Same as 0038, plus drop_in_fee_cents.
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
    drop_in_fee_cents=coalesce((settings_patch->>'drop_in_fee_cents')::bigint,drop_in_fee_cents),
    updated_by=auth.uid(),updated_at=now()
  where singleton returning * into result;
  return result;
exception when check_violation or invalid_text_representation then
  raise exception using message='invalid_settings',errcode='P0001';
end $$;

-- Lesson settings are admin-only under RLS, but the booking page has to tell
-- guests about the fee before they book.
create function public.get_drop_in_fee_cents() returns bigint
language sql stable security definer set search_path=public as $$
  select drop_in_fee_cents from public.lesson_booking_settings where singleton;
$$;
revoke all on function public.get_drop_in_fee_cents() from public,anon;
grant execute on function public.get_drop_in_fee_cents() to authenticated;
