begin;
select no_plan();
insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data,raw_app_meta_data)
values
('92000000-0000-4000-8000-000000000001','old-payer@cfa.test',now(),'{}','{}'),
('92000000-0000-4000-8000-000000000002','new-payer@cfa.test',now(),'{}','{}'),
('92000000-0000-4000-8000-000000000003','minor@cfa.test',now(),'{}','{}'),
('92000000-0000-4000-8000-000000000004','outsider@cfa.test',now(),'{}','{}'),
('92000000-0000-4000-8000-000000000005','family-coach@cfa.test',now(),'{}','{"cfa_is_staff":true,"cfa_staff_type":"coach"}');
update public.profiles set date_of_birth='1980-01-01' where id in
('92000000-0000-4000-8000-000000000001','92000000-0000-4000-8000-000000000002');
update public.profiles set date_of_birth=(current_date-interval '14 years')::date where id='92000000-0000-4000-8000-000000000003';
insert into public.family_links(id,guardian_id,dependent_id,status,requested_by,accepted_by,accepted_at)
values('92000000-0000-4000-8000-000000000010','92000000-0000-4000-8000-000000000001','92000000-0000-4000-8000-000000000003','active','92000000-0000-4000-8000-000000000001','92000000-0000-4000-8000-000000000003',now());
insert into public.dependent_billing_links(household_id,guardian_id,dependent_id,family_link_id)
select id,payer_id,'92000000-0000-4000-8000-000000000003','92000000-0000-4000-8000-000000000010'
from public.households where payer_id='92000000-0000-4000-8000-000000000001';
insert into public.charges(id,fencer_id,payer_id,type,amount_cents,period,description)
values('92000000-0000-4000-8000-000000000020','92000000-0000-4000-8000-000000000003',
  '92000000-0000-4000-8000-000000000001','membership',55000,date_trunc('month',current_date)::date,'Synthetic historical family charge');
set local role anon;
select throws_ok($$select public.end_family_link('92000000-0000-4000-8000-000000000010')$$,'42501',null,'anonymous cannot request changes');
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','92000000-0000-4000-8000-000000000004',true);
select throws_ok($$select public.end_family_link('92000000-0000-4000-8000-000000000010')$$,'P0001','forbidden','unrelated account cannot unlink');
select set_config('request.jwt.claim.sub','92000000-0000-4000-8000-000000000003',true);
select lives_ok($$select public.end_family_link('92000000-0000-4000-8000-000000000010')$$,'dependent can request staff review');
select is(public.active_billing_payer('92000000-0000-4000-8000-000000000003'),'92000000-0000-4000-8000-000000000001'::uuid,'request does not grant financial independence');
select throws_ok($$update public.profiles set date_of_birth='1980-01-01' where id='92000000-0000-4000-8000-000000000003'$$,'P0001','staff must correct a linked minor birth date','minor cannot edit age to bypass restrictions');
select throws_ok($$select public.review_family_change((select id from public.family_change_requests where dependent_id=auth.uid()),true,'Self approved')$$,'P0001','forbidden','dependent cannot approve request');
select set_config('request.jwt.claim.sub','92000000-0000-4000-8000-000000000004',true);
select is((select count(*)::integer from public.family_change_requests),0,'unrelated account cannot read request');
select set_config('request.jwt.claim.sub','92000000-0000-4000-8000-000000000005',true);
select throws_ok($$select public.review_family_change((select id from public.family_change_requests where dependent_id='92000000-0000-4000-8000-000000000003'),true,'Checked request')$$,'P0001','minor or unverified adult requires an accepted transfer','staff cannot unlink minor into self-payment');
select lives_ok($$select public.review_family_change((select id from public.family_change_requests where dependent_id='92000000-0000-4000-8000-000000000003'),false,'Please arrange a transfer')$$,'coach may reject request');
select set_config('request.jwt.claim.sub','92000000-0000-4000-8000-000000000001',true);
select lives_ok($$select public.request_family_change('92000000-0000-4000-8000-000000000010','transfer','new-payer@cfa.test','Change guardian')$$,'old payer requests transfer');
select set_config('request.jwt.claim.sub','92000000-0000-4000-8000-000000000005',true);
select throws_ok($$select public.review_family_change((select id from public.family_change_requests where status='awaiting_acceptance'),true,'Reviewed')$$,'P0001','request is not ready for review','staff cannot approve before new payer accepts');
select set_config('request.jwt.claim.sub','92000000-0000-4000-8000-000000000003',true);
select throws_ok($$select public.accept_family_transfer((select id from public.family_change_requests where status='awaiting_acceptance'),true)$$,'P0001','transfer acceptance unavailable','dependent cannot accept for payer');
select set_config('request.jwt.claim.sub','92000000-0000-4000-8000-000000000002',true);
select lives_ok($$select public.accept_family_transfer((select id from public.family_change_requests where status='awaiting_acceptance'),true)$$,'new payer accepts responsibility');
select is(public.active_billing_payer('92000000-0000-4000-8000-000000000003'),'92000000-0000-4000-8000-000000000001'::uuid,'payer acceptance alone does not transfer');
select set_config('request.jwt.claim.sub','92000000-0000-4000-8000-000000000005',true);
select lives_ok($$select public.review_family_change((select id from public.family_change_requests where status='pending_review'),true,'Accepted transfer reviewed')$$,'coach can approve accepted transfer');
select is(public.active_billing_payer('92000000-0000-4000-8000-000000000003'),'92000000-0000-4000-8000-000000000002'::uuid,'approval starts new payer responsibility');
select throws_ok($$select public.review_family_change((select id from public.family_change_requests where status='approved'),true,'Repeat approval')$$,'P0001','request is not ready for review','repeat approval cannot duplicate active links');
select throws_ok($$select public.attach_dependent('92000000-0000-4000-8000-000000000003','92000000-0000-4000-8000-000000000001')$$,'42501',null,'legacy attach bypass is retired');
reset role;
select is((select count(*)::integer from public.dependent_billing_links where dependent_id='92000000-0000-4000-8000-000000000003' and effective_to is null),1,'exactly one active payer remains');
select is((select count(*)::integer from public.dependent_billing_links where dependent_id='92000000-0000-4000-8000-000000000003' and guardian_id='92000000-0000-4000-8000-000000000001' and effective_to is not null),1,'historical payer link retained');
select is((select count(*)::integer from public.audit_events where subject_profile_id='92000000-0000-4000-8000-000000000003' and event_type='family.change_approved'),1,'approval is audited once');
select is((select payer_id from public.charges where id='92000000-0000-4000-8000-000000000020'),
  '92000000-0000-4000-8000-000000000001'::uuid,'transfer preserves historical charge payer');
select is((select amount_cents from public.charges where id='92000000-0000-4000-8000-000000000020'),55000::bigint,'transfer preserves historical amount');
insert into public.family_links(id,guardian_id,dependent_id,requested_by) values
('92000000-0000-4000-8000-000000000011','92000000-0000-4000-8000-000000000003','92000000-0000-4000-8000-000000000004','92000000-0000-4000-8000-000000000003'),
('92000000-0000-4000-8000-000000000012','92000000-0000-4000-8000-000000000001','92000000-0000-4000-8000-000000000002','92000000-0000-4000-8000-000000000001');
set local role authenticated;
select set_config('request.jwt.claim.sub','92000000-0000-4000-8000-000000000004',true);
select throws_ok($$select public.respond_family_link('92000000-0000-4000-8000-000000000011','accept')$$,'P0001','guardian must be an independent payer','dependent cannot become someone else payer');
select set_config('request.jwt.claim.sub','92000000-0000-4000-8000-000000000002',true);
select throws_ok($$select public.respond_family_link('92000000-0000-4000-8000-000000000012','accept')$$,'P0001','transfer existing dependent responsibilities first','payer must transfer dependents before becoming dependent');
select throws_ok($$update public.family_change_requests set status='approved' where new_guardian_id=auth.uid()$$,'42501',null,'new payer cannot directly approve a request');
select throws_ok($$select public.respond_family_link('92000000-0000-4000-8000-000000000012',null)$$,'P0001','invalid response','null acceptance is rejected');
reset role;
select * from finish();
rollback;
