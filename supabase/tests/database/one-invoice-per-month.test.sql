begin;
select plan(10);

-- Synthetic payer made here; everything rolls back. 1111 is a seed admin.
insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data,raw_app_meta_data)
values('99000000-0000-4000-8000-000000000001','one-invoice@cfa.test',now(),'{"full_name":"One Invoice Payer"}','{}');
update public.profiles set date_of_birth='1985-01-01', profile_completed_at=now()
where id='99000000-0000-4000-8000-000000000001';

insert into public.charges(fencer_id,payer_id,type,amount,status,period,description,lifecycle_state)
values('99000000-0000-4000-8000-000000000001','99000000-0000-4000-8000-000000000001',
  'joining_fee',300,'unpaid',date_trunc('month',current_date)::date,'First charge','finalized');
select ok(public.generate_monthly_invoices(current_date)=1,'the first run makes the month''s invoice');

-- A second charge in the same month, before anything was sent.
insert into public.charges(fencer_id,payer_id,type,amount,status,period,description,lifecycle_state)
values('99000000-0000-4000-8000-000000000001','99000000-0000-4000-8000-000000000001',
  'joining_fee',250,'unpaid',date_trunc('month',current_date)::date,'Second charge','finalized');
select ok(public.generate_monthly_invoices(current_date)=1,'a re-run updates the open invoice');
select results_eq(
  $$select count(*)::int, max(total)::numeric,
      (select count(*)::int from public.invoice_lines l join public.invoices i on i.id=l.invoice_id
        where i.payer_id='99000000-0000-4000-8000-000000000001')
    from public.invoices where payer_id='99000000-0000-4000-8000-000000000001'$$,
  $$select 1, 550::numeric, 2$$,
  'both charges are on one invoice with the combined total');
select is(public.generate_monthly_invoices(current_date),0,'a re-run with nothing new changes nothing');

-- The 25th run takes over an unsent staff invoice so it goes out with the rest.
insert into public.charges(fencer_id,payer_id,type,amount,status,period,description,lifecycle_state)
values('99000000-0000-4000-8000-000000000001','99000000-0000-4000-8000-000000000001',
  'joining_fee',50,'unpaid',(date_trunc('month',(now() at time zone 'Africa/Johannesburg')))::date,'Third charge','finalized');
select ok(public.run_scheduled_invoices()>=1,'the scheduled run bills the third charge');
select results_eq(
  $$select count(*)::int, max(total)::numeric, max(generated_by) from public.invoices where payer_id='99000000-0000-4000-8000-000000000001'$$,
  $$select 1, 600::numeric, 'schedule'::text$$,
  'the scheduled run adds to the same invoice and will email it');

-- Once sent, the invoice is locked and later charges get a new invoice.
select public.complete_invoice_email((select id from public.invoices where payer_id='99000000-0000-4000-8000-000000000001'));
select ok(not public.invoice_is_open((select id from public.invoices where payer_id='99000000-0000-4000-8000-000000000001')),
  'a sent invoice is locked');
insert into public.charges(fencer_id,payer_id,type,amount,status,period,description,lifecycle_state)
values('99000000-0000-4000-8000-000000000001','99000000-0000-4000-8000-000000000001',
  'joining_fee',75,'unpaid',date_trunc('month',current_date)::date,'After sending','finalized');
select ok(public.generate_monthly_invoices(current_date)=1,'a run after sending still bills the new charge');
select results_eq(
  $$select sequence::int, total::numeric from public.invoices where payer_id='99000000-0000-4000-8000-000000000001' order by sequence$$,
  $$select 1, 600::numeric union all select 2, 75::numeric$$,
  'the sent invoice is unchanged and the new charge is on its own invoice');

-- An adjustment against an unsent invoice also locks it.
insert into public.invoice_adjustments(invoice_id,charge_id,amount_cents,reason,created_by)
select i.id, l.charge_id, 100, 'test adjustment', '11111111-1111-4111-8111-111111111111'
from public.invoices i join public.invoice_lines l on l.invoice_id=i.id
where i.payer_id='99000000-0000-4000-8000-000000000001' and i.sequence=2;
select ok(not public.invoice_is_open((select id from public.invoices where payer_id='99000000-0000-4000-8000-000000000001' and sequence=2)),
  'an invoice with an adjustment is locked');

select * from finish();
rollback;
