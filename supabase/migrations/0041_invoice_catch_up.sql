-- Monthly invoicing only picked up charges whose period equalled the run's
-- month. A pay-later lesson after the 25th, or an outcome recorded after the
-- run, finalized a charge for a month that had already been invoiced, and no
-- later run ever looked back, so it was never billed. Each run now also
-- collects every earlier finalized, unpaid charge that is not yet on any
-- invoice, and bills it on this month's invoice.
--
-- Adding lines to an invoice the payer had already paid left it marked paid,
-- which hid the new amount from checkout. Such an invoice is reopened.
create or replace function public.generate_monthly_invoices(target_period date)
returns integer language plpgsql security definer set search_path=public as $$
declare payer_row record; v_invoice_id uuid; made integer:=0; added integer;
begin
  target_period:=date_trunc('month',target_period)::date;
  insert into public.charges(fencer_id,payer_id,type,amount,status,period,description)
  select m.profile_id,public.active_billing_payer(m.profile_id),'membership',mt.price,'unpaid',target_period,mt.name
  from public.memberships m join public.membership_types mt on mt.id=m.membership_type_id
  where m.status='active' and mt.code='month_to_month' and m.started_at<target_period+interval '1 month'
  on conflict do nothing;
  for payer_row in select distinct c.payer_id from public.charges c left join public.bookings b on b.id=c.booking_id
    where c.status='unpaid' and c.lifecycle_state='finalized' and c.period<=target_period
      and (c.type in ('membership','joining_fee') or (c.type='lesson' and b.payment_option='pay_later'))
      and not exists(select 1 from public.invoice_lines il where il.charge_id=c.id) loop
    insert into public.invoices(payer_id,period) values(payer_row.payer_id,target_period)
    on conflict(payer_id,period) do update set payer_id=excluded.payer_id returning id into v_invoice_id;
    insert into public.invoice_lines(invoice_id,charge_id,participant_id,description,amount)
    select v_invoice_id,c.id,c.fencer_id,
      case when c.period<target_period then c.description||' ('||to_char(c.period,'FMMonth YYYY')||')' else c.description end,
      c.amount from public.charges c left join public.bookings b on b.id=c.booking_id
    where c.payer_id=payer_row.payer_id and c.period<=target_period and c.status='unpaid'
      and c.lifecycle_state='finalized'
      and (c.type in ('membership','joining_fee') or (c.type='lesson' and b.payment_option='pay_later'))
      and not exists(select 1 from public.invoice_lines il where il.charge_id=c.id)
    on conflict(charge_id) do nothing;
    get diagnostics added = row_count;
    delete from public.invoice_lines il using public.charges c where il.invoice_id=v_invoice_id
      and il.charge_id=c.id and c.status='unpaid' and c.lifecycle_state in ('voided','waived');
    update public.invoices set total=(select coalesce(sum(amount),0) from public.invoice_lines where invoice_id=v_invoice_id),
      status=case when status='paid' and added>0 then 'unpaid' else status end,
      paid_at=case when status='paid' and added>0 then null else paid_at end
      where id=v_invoice_id;
    made:=made+1;
  end loop;
  return made;
end $$;
revoke all on function public.generate_monthly_invoices(date) from public,anon,authenticated;
