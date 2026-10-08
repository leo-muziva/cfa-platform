-- Shop buyers got no confirmation once PayFast settled their order. The app
-- now emails one after the payment webhook. Payment providers retry their
-- notifications, so the send is claimed in the database first: only the
-- call that flips confirmation_emailed_at from null may send, and a failed
-- send releases the claim so a later notification can try again.

alter table public.orders add column confirmation_emailed_at timestamptz;

create function public.claim_shop_order_confirmation(target_provider text, target_reference text)
returns table(order_id uuid, recipient_email text, recipient_name text, items jsonb, total_cents bigint)
language plpgsql security definer set search_path=public as $$
declare v_order uuid;
begin
  update public.orders o set confirmation_emailed_at=now()
  from public.payment_attempts a
  where a.provider=target_provider and a.provider_reference=target_reference and a.status='succeeded'
    and a.order_id=o.id and o.status not in ('draft','pending_payment','cancelled')
    and o.confirmation_emailed_at is null
  returning o.id into v_order;
  if v_order is null then return; end if;
  return query
  select o.id, p.email, coalesce(nullif(trim(p.full_name),''), 'CFA member'),
    coalesce((select jsonb_agg(jsonb_build_object(
        'name', pr.name, 'quantity', i.quantity, 'size', i.size, 'handedness', i.handedness,
        'lineCents', round(i.unit_price*100*i.quantity)::bigint) order by i.created_at)
      from public.order_items i join public.products pr on pr.id=i.product_id where i.order_id=o.id), '[]'::jsonb),
    coalesce((select sum(round(i.unit_price*100*i.quantity))::bigint from public.order_items i where i.order_id=o.id), 0)
  from public.orders o join public.profiles p on p.id=o.user_id
  where o.id=v_order;
end $$;

create function public.release_shop_order_confirmation(target_order uuid)
returns void language sql security definer set search_path=public as $$
  update public.orders set confirmation_emailed_at=null where id=target_order;
$$;

revoke all on function public.claim_shop_order_confirmation(text,text) from public, anon, authenticated;
revoke all on function public.release_shop_order_confirmation(uuid) from public, anon, authenticated;
grant execute on function public.claim_shop_order_confirmation(text,text) to service_role;
grant execute on function public.release_shop_order_confirmation(uuid) to service_role;
