-- Online payers got no confirmation beyond the status page. A settled payment
-- now emails a receipt, claimed once per payment attempt so PayFast retries
-- never send it twice. Shop orders are left out: they already get the order
-- confirmation from 0042.
--
-- The status page also shows the receipt number, so it reads as a receipt.
alter table public.payment_attempts add column if not exists receipt_emailed_at timestamptz;

create function public.claim_payment_receipt(target_provider text, target_reference text)
returns table(attempt_id uuid, kind text, recipient_email text, recipient_name text,
  amount_cents bigint, receipt_number text, description text, credited boolean)
language plpgsql security definer set search_path=public as $$
declare v_attempt uuid;
begin
  update public.payment_attempts a set receipt_emailed_at=now()
  where a.provider=target_provider and a.provider_reference=target_reference and a.status='succeeded'
    and a.order_id is null and a.receipt_emailed_at is null
  returning a.id into v_attempt;
  if v_attempt is null then return; end if;
  return query
  select a.id,
    case when a.booking_id is not null then 'booking' when a.membership_application_id is not null then 'membership' else 'invoice' end,
    p.email, coalesce(nullif(trim(p.full_name),''),'CFA member'), a.amount_cents, rc.receipt_number,
    case
      when a.booking_id is not null then 'Lesson on '||to_char(b.starts_at at time zone 'Africa/Johannesburg','FMDD FMMonth YYYY "at" HH24:MI')
      when a.membership_application_id is not null then coalesce(mt.name,'Membership')||' membership'
      else 'Invoice '||coalesce(i.invoice_number,'')
    end,
    exists(select 1 from public.ledger_credits c where c.payment_attempt_id=a.id)
  from public.payment_attempts a
  join public.profiles p on p.id=a.payer_id
  left join public.receipts rc on rc.payment_attempt_id=a.id
  left join public.bookings b on b.id=a.booking_id
  left join public.membership_applications ma on ma.id=a.membership_application_id
  left join public.membership_types mt on mt.id=ma.membership_type_id
  left join public.invoices i on i.id=a.invoice_id
  where a.id=v_attempt;
end $$;

create function public.release_payment_receipt(target_attempt uuid)
returns void language sql security definer set search_path=public as $$
  update public.payment_attempts set receipt_emailed_at=null where id=target_attempt;
$$;

revoke all on function public.claim_payment_receipt(text,text) from public,anon,authenticated;
revoke all on function public.release_payment_receipt(uuid) from public,anon,authenticated;
grant execute on function public.claim_payment_receipt(text,text) to service_role;
grant execute on function public.release_payment_receipt(uuid) to service_role;

-- The return type gains receipt_number, so the function is recreated.
drop function public.get_payment_status(uuid);
create function public.get_payment_status(target_attempt uuid)
returns table(attempt_id uuid,status text,kind text,credited boolean,amount_cents text,receipt_number text)
language plpgsql stable security definer set search_path=public as $$
begin
  if not public.payment_actor_is_payer() then raise exception 'forbidden'; end if;
  return query select a.id,a.status,
    case when a.booking_id is not null then 'booking' when a.order_id is not null then 'order'
      when a.membership_application_id is not null then 'membership' else 'invoice' end,
    exists(select 1 from public.ledger_credits c where c.payment_attempt_id=a.id),a.amount_cents::text,
    (select rc.receipt_number from public.receipts rc where rc.payment_attempt_id=a.id)
    from public.payment_attempts a where a.id=target_attempt and a.payer_id=auth.uid();
end $$;
revoke all on function public.get_payment_status(uuid) from public,anon;
grant execute on function public.get_payment_status(uuid) to authenticated;
