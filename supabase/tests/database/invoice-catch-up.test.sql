begin;
select plan(6);

insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data,raw_app_meta_data)
values('97000000-0000-4000-8000-000000000001','catch-up@cfa.test',now(),'{"full_name":"Catch Up Payer"}','{}');
update public.profiles set date_of_birth='1985-01-01', profile_completed_at=now()
where id='97000000-0000-4000-8000-000000000001';

-- A charge finalized after last month's run had already happened.
insert into public.charges(id,fencer_id,payer_id,type,amount,status,period,description,lifecycle_state)
values('97000000-0000-4000-8000-000000000010','97000000-0000-4000-8000-000000000001','97000000-0000-4000-8000-000000000001',
  'joining_fee',350,'unpaid',(date_trunc('month',current_date)-interval '1 month')::date,'Joining fee','finalized');

select is(public.generate_monthly_invoices(current_date),1,'this month''s run bills the payer');
select is((select i.period from public.invoice_lines l join public.invoices i on i.id=l.invoice_id
  where l.charge_id='97000000-0000-4000-8000-000000000010'),date_trunc('month',current_date)::date,
  'an earlier unbilled charge is caught up on the current invoice');
select is(public.generate_monthly_invoices(current_date),0,'a re-run with nothing new bills nobody');
select is((select count(*)::int from public.invoice_lines where charge_id='97000000-0000-4000-8000-000000000010'),1,
  'a re-run never duplicates a line');

-- Payer settles the invoice, then a new charge lands in the same month.
update public.charges set status='paid' where id='97000000-0000-4000-8000-000000000010';
update public.invoices set status='paid',paid_at=now() where payer_id='97000000-0000-4000-8000-000000000001';
insert into public.charges(fencer_id,payer_id,type,amount,status,period,description,lifecycle_state)
values('97000000-0000-4000-8000-000000000001','97000000-0000-4000-8000-000000000001',
  'joining_fee',100,'unpaid',date_trunc('month',current_date)::date,'Late addition','finalized');
select is(public.generate_monthly_invoices(current_date),1,'the new charge is billed');
select is((select status from public.invoices where payer_id='97000000-0000-4000-8000-000000000001'),'unpaid',
  'a paid invoice that gains a line is reopened so it can be paid');
select * from finish();
rollback;
