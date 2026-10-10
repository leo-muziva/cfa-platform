-- The drop-in fee (0047) is refunded when the lesson it was charged on is
-- cancelled, by anyone and at any time. It is charged once per day, so it
-- only stays charged while the guest still has a lesson that day:
--   * cancelled, and the guest has another lesson the same day: the fee moves
--     to that lesson instead of being refunded.
--   * rescheduled: the fee moves to the new lesson, unless the guest already
--     has a drop-in fee on the new day, then it is refunded.
-- Refunds go through apply_lesson_charge_policy like lesson fees: an unpaid
-- fee is voided, a paid one becomes an adjustment and account credit.
-- A trigger covers every cancel path (member, coach, admin, closure,
-- reschedule) without copying those functions. Expired holds already void
-- their charges before the status changes, so they are skipped here.

create function public.release_drop_in_fees()
returns trigger language plpgsql security definer set search_path=public as $$
declare c public.charges; v_day date; v_other uuid;
begin
  for c in select * from public.charges
    where booking_id=new.id and type='drop_in' and lifecycle_state not in ('voided','waived') for update loop
    v_other:=null;
    if new.status='rescheduled' and new.rescheduled_to_booking_id is not null then
      select (starts_at at time zone 'Africa/Johannesburg')::date into v_day
        from public.bookings where id=new.rescheduled_to_booking_id;
      if not exists(select 1 from public.charges oc join public.bookings ob on ob.id=oc.booking_id
        where oc.fencer_id=c.fencer_id and oc.type='drop_in' and oc.id<>c.id
          and oc.lifecycle_state not in ('voided','waived')
          and (ob.starts_at at time zone 'Africa/Johannesburg')::date=v_day) then
        v_other:=new.rescheduled_to_booking_id;
      end if;
    else
      v_day:=(new.starts_at at time zone 'Africa/Johannesburg')::date;
      select b.id into v_other from public.bookings b
        join public.booking_participants bp on bp.booking_id=b.id and bp.participant_id=c.fencer_id
        where b.id<>new.id and b.status='scheduled' and b.payment_state is distinct from 'expired'
          and (b.starts_at at time zone 'Africa/Johannesburg')::date=v_day
          and not exists(select 1 from public.charges oc where oc.booking_id=b.id and oc.type='drop_in'
            and oc.fencer_id=c.fencer_id and oc.lifecycle_state not in ('voided','waived'))
        order by b.starts_at limit 1;
    end if;
    if v_other is not null then
      update public.charges set booking_id=v_other,updated_at=now() where id=c.id;
      insert into public.audit_events(event_type,actor_id,subject_profile_id,entity_type,entity_id,metadata)
      values('lesson.drop_in_fee_moved',auth.uid(),c.fencer_id,'booking',v_other,
        jsonb_build_object('charge_id',c.id,'from_booking_id',new.id));
    else
      perform public.apply_lesson_charge_policy(c.id,0,'Drop-in fee refund');
      insert into public.audit_events(event_type,actor_id,subject_profile_id,entity_type,entity_id,metadata)
      values('lesson.drop_in_fee_refunded',auth.uid(),c.fencer_id,'booking',new.id,
        jsonb_build_object('charge_id',c.id,'amount_cents',c.amount_cents));
    end if;
  end loop;
  return null;
end $$;
revoke all on function public.release_drop_in_fees() from public,anon,authenticated;

create trigger bookings_release_drop_in_fees
  after update of status on public.bookings
  for each row
  when (old.status='scheduled' and new.status in ('cancelled','rescheduled'))
  execute function public.release_drop_in_fees();
