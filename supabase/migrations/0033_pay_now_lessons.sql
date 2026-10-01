-- Pay-now lessons: members can see that a lesson is waiting for payment and
-- payers can resume checkout for it, instead of only getting one chance
-- straight after booking. Also lets scheduled jobs run invoicing.
--
-- Hold expiry itself stays in expire_lesson_holds (0022). Until that job
-- runs, a held booking whose hold has passed is reported as cancelled so a
-- stale hold never looks like a booked lesson.

-- ============================================================
-- 1. Member lesson list with payment-hold state
-- ============================================================
-- Still money-free: dependents may see that a lesson awaits payment and
-- until when, never an amount.
drop function public.list_my_lesson_bookings();
create function public.list_my_lesson_bookings()
returns table(
  booking_id uuid,coach_id uuid,coach_name text,starts_at timestamptz,ends_at timestamptz,
  weapon text,status text,participant_names text[],cancelled_at timestamptz,cancellation_reason text,cancellation_deadline timestamptz,
  rescheduled_from_booking_id uuid,rescheduled_to_booking_id uuid,awaiting_payment boolean,hold_expires_at timestamptz
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
    case when b.payment_state='held' then b.hold_expires_at end
  from public.bookings b join public.booking_participants bp on bp.booking_id=b.id
  join public.profiles participant on participant.id=bp.participant_id
  join public.profiles coach on coach.id=b.coach_id
  where b.booking_model='lesson_v2' and public.lesson_actor_can_manage_booking(b.id)
  group by b.id,coach.full_name order by b.starts_at;
end $$;
revoke all on function public.list_my_lesson_bookings() from public,anon;
grant execute on function public.list_my_lesson_bookings() to authenticated;

-- ============================================================
-- 2. Payer view of lessons that can still be paid
-- ============================================================
-- Same payer rule as prepare_payment_checkout (0025): every provisional
-- charge on the booking belongs to the caller. Non-payers get no rows.
create function public.list_my_payable_lesson_holds()
returns table(
  booking_id uuid,coach_name text,starts_at timestamptz,weapon text,participant_names text[],
  amount_cents text,hold_expires_at timestamptz
) language plpgsql stable security definer set search_path=public as $$
begin
  if auth.uid() is null then raise exception using message='forbidden',errcode='P0001'; end if;
  return query
  select b.id,coach.full_name,b.starts_at,b.weapon,
    (select array_agg(p.full_name order by bp.ordinal) from public.booking_participants bp
      join public.profiles p on p.id=bp.participant_id where bp.booking_id=b.id),
    (select coalesce(sum(public.payment_charge_outstanding(c.id)),0)::text from public.charges c
      where c.booking_id=b.id and c.lifecycle_state='provisional'),
    b.hold_expires_at
  from public.bookings b join public.profiles coach on coach.id=b.coach_id
  where b.booking_model='lesson_v2' and b.payment_option='pay_now' and b.payment_state='held'
    and b.status='scheduled' and b.hold_expires_at>now()
    and exists(select 1 from public.charges c where c.booking_id=b.id and c.payer_id=auth.uid())
    and not exists(select 1 from public.charges c where c.booking_id=b.id and c.payer_id<>auth.uid())
  order by b.hold_expires_at;
end $$;
revoke all on function public.list_my_payable_lesson_holds() from public,anon;
grant execute on function public.list_my_payable_lesson_holds() to authenticated;

-- ============================================================
-- 3. Invoicing for all staff and for the scheduled job
-- ============================================================
-- The billing rules are unchanged from 0011; only who may run them changes.
-- Financial operations are open to all active staff (see 0031).
create function public.generate_monthly_invoices(target_period date)
returns integer language plpgsql security definer set search_path=public as $$
declare payer_row record; v_invoice_id uuid; made integer:=0;
begin
  target_period:=date_trunc('month',target_period)::date;
  insert into public.charges(fencer_id,payer_id,type,amount,status,period,description)
  select m.profile_id,public.active_billing_payer(m.profile_id),'membership',mt.price,'unpaid',target_period,mt.name
  from public.memberships m join public.membership_types mt on mt.id=m.membership_type_id
  where m.status='active' and mt.code='month_to_month' and m.started_at<target_period+interval '1 month'
  on conflict do nothing;
  for payer_row in select distinct c.payer_id from public.charges c left join public.bookings b on b.id=c.booking_id
    where c.status='unpaid' and c.lifecycle_state='finalized' and c.period=target_period
      and (c.type in ('membership','joining_fee') or (c.type='lesson' and b.payment_option='pay_later')) loop
    insert into public.invoices(payer_id,period) values(payer_row.payer_id,target_period)
    on conflict(payer_id,period) do update set payer_id=excluded.payer_id returning id into v_invoice_id;
    insert into public.invoice_lines(invoice_id,charge_id,participant_id,description,amount)
    select v_invoice_id,c.id,c.fencer_id,c.description,c.amount from public.charges c left join public.bookings b on b.id=c.booking_id
    where c.payer_id=payer_row.payer_id and c.period=target_period and c.status='unpaid'
      and c.lifecycle_state='finalized'
      and (c.type in ('membership','joining_fee') or (c.type='lesson' and b.payment_option='pay_later'))
    on conflict(charge_id) do nothing;
    delete from public.invoice_lines il using public.charges c where il.invoice_id=v_invoice_id
      and il.charge_id=c.id and c.status='unpaid' and c.lifecycle_state in ('voided','waived');
    update public.invoices set total=(select coalesce(sum(amount),0) from public.invoice_lines where invoice_id=v_invoice_id)
      where id=v_invoice_id;
    made:=made+1;
  end loop;
  return made;
end $$;
revoke all on function public.generate_monthly_invoices(date) from public,anon,authenticated;

create or replace function public.run_monthly_invoices(target_period date)
returns integer language plpgsql security definer set search_path=public as $$
begin
  if not public.current_user_is_active_staff() then raise exception 'forbidden'; end if;
  return public.generate_monthly_invoices(target_period);
end $$;

-- Invoices the current CFA business month (Africa/Johannesburg), so a run
-- just after midnight on the 25th never lands in the previous UTC month.
create function public.run_scheduled_invoices() returns integer
language sql security definer set search_path=public as $$
  select public.generate_monthly_invoices(date_trunc('month',(now() at time zone 'Africa/Johannesburg'))::date);
$$;
revoke all on function public.run_scheduled_invoices() from public,anon,authenticated;
grant execute on function public.run_scheduled_invoices() to service_role;
