-- The booking panel quote read single_lesson_price_cents from the settings,
-- but create_lesson_booking_v3 charges each fencer the standard_30 lesson
-- product price (0038 says the settings price no longer has an effect). Both
-- are R300 today; this makes the quote use the same price the booking charges,
-- so they can't drift apart. Same as 0022 otherwise.
create or replace function public.get_lesson_quote_v3(target_participant_ids uuid[])
returns table(participant_count integer,total_cents text,currency text) language plpgsql stable security definer set search_path=public as $$
declare v_count integer; v_payer uuid;
begin
  if coalesce(array_length(target_participant_ids,1),0) not in (1,2)
    or (select count(distinct x) from unnest(target_participant_ids) x)<>array_length(target_participant_ids,1)
  then raise exception using message='invalid_participants',errcode='P0001'; end if;
  if exists(select 1 from unnest(target_participant_ids) p where not public.lesson_actor_can_manage_participant(p))
  then raise exception using message='participant_unauthorized',errcode='P0001'; end if;
  v_count:=array_length(target_participant_ids,1);
  v_payer:=public.active_billing_payer(target_participant_ids[1]);
  if exists(select 1 from unnest(target_participant_ids) p where public.active_billing_payer(p)<>v_payer)
  then raise exception using message='mixed_payers',errcode='P0001'; end if;
  if not public.current_user_is_admin() and (
    v_payer<>auth.uid()
  ) then raise exception using message='forbidden',errcode='P0001'; end if;
  -- one charge per fencer at the lesson product price, as the booking does
  return query select v_count,(p.customer_price_cents*v_count)::text,'ZAR'::text
    from public.lesson_products p where p.code='standard_30' and p.is_active;
end $$;
revoke all on function public.get_lesson_quote_v3(uuid[]) from public,anon;
grant execute on function public.get_lesson_quote_v3(uuid[]) to authenticated;
