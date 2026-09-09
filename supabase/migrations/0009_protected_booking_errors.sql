create or replace function public.create_lesson_booking(
  target_slot uuid, target_fencer uuid, requested_payment text
) returns uuid language plpgsql security definer set search_path=public as $$
declare actor public.profiles; fencer public.profiles; slot public.lesson_slots;
declare payer uuid; final_payment text; booking_id uuid;
begin
  select * into actor from public.profiles where id=auth.uid() and is_active;
  select * into fencer from public.profiles where id=target_fencer and is_active;
  select * into slot from public.lesson_slots
    where id=target_slot and is_open and starts_at>now() for update;
  if actor.id is null or fencer.id is null or slot.id is null then
    raise exception using message='booking_unavailable', errcode='P0001';
  end if;
  if not public.current_user_is_admin() and target_fencer<>actor.id and not exists(
    select 1 from public.family_links
    where guardian_id=actor.id and dependent_id=target_fencer and status='active'
  ) then
    raise exception using message='booking_unauthorized_participant', errcode='P0001';
  end if;
  if slot.access_rule='active_members_only' and not exists(
    select 1 from public.memberships where profile_id=target_fencer and status='active'
  ) then
    raise exception using message='booking_membership_required', errcode='P0001';
  end if;
  if exists(
    select 1 from public.bookings
    where lesson_slot_id=slot.id and fencer_id=target_fencer
  ) then
    raise exception using message='booking_duplicate', errcode='P0001';
  end if;
  if slot.capacity is not null and (
    select count(*) from public.bookings
    where lesson_slot_id=slot.id and status<>'cancelled'
  )>=slot.capacity then
    raise exception using message='booking_full', errcode='P0001';
  end if;
  payer:=public.active_billing_payer(target_fencer);
  final_payment:=case when payer<>actor.id then 'pay_later' else requested_payment end;
  if final_payment not in ('pay_now','pay_later') then
    raise exception using message='booking_invalid_payment', errcode='P0001';
  end if;
  insert into public.bookings(lesson_slot_id,booked_by_id,fencer_id,payment_option)
    values(target_slot,actor.id,target_fencer,final_payment) returning id into booking_id;
  insert into public.charges(fencer_id,payer_id,booking_id,type,amount,status,period,description)
  values(target_fencer,payer,booking_id,'lesson',slot.price,'unpaid',
    date_trunc('month',slot.starts_at)::date,'Individual lesson');
  return booking_id;
end $$;
