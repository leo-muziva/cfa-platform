begin;
select plan(6);
insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data,raw_app_meta_data)
values
('93000000-0000-4000-8000-000000000001','requesting-guardian@cfa.test',now(),'{"full_name":"Requesting Guardian"}','{}'),
('93000000-0000-4000-8000-000000000002','invited-dependent@cfa.test',now(),'{"full_name":"Invited Dependent"}','{}'),
('93000000-0000-4000-8000-000000000003','bystander@cfa.test',now(),'{"full_name":"Bystander"}','{}');
update public.profiles set full_name='Requesting Guardian' where id='93000000-0000-4000-8000-000000000001';
insert into public.family_links(id,guardian_id,dependent_id,status,requested_by)
values('93000000-0000-4000-8000-000000000010','93000000-0000-4000-8000-000000000001',
  '93000000-0000-4000-8000-000000000002','pending','93000000-0000-4000-8000-000000000001');

set local role anon;
select throws_ok($$select * from public.list_my_family_link_counterparts()$$,'42501',null,'anonymous cannot list counterparts');
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub','93000000-0000-4000-8000-000000000002',true);
select is((select count(*)::int from public.profiles where id='93000000-0000-4000-8000-000000000001'),0,
  'dependent still cannot read the guardian profile row directly');
select is((select counterpart_name from public.list_my_family_link_counterparts() where link_id='93000000-0000-4000-8000-000000000010'),
  'Requesting Guardian','pending request shows the requester name to the dependent');
select is((select counterpart_email from public.list_my_family_link_counterparts() where link_id='93000000-0000-4000-8000-000000000010'),
  'requesting-guardian@cfa.test','pending request shows the requester email to the dependent');

select set_config('request.jwt.claim.sub','93000000-0000-4000-8000-000000000001',true);
select is((select counterpart_email from public.list_my_family_link_counterparts() where link_id='93000000-0000-4000-8000-000000000010'),
  'invited-dependent@cfa.test','guardian sees the account they invited');

select set_config('request.jwt.claim.sub','93000000-0000-4000-8000-000000000003',true);
select is((select count(*)::int from public.list_my_family_link_counterparts()),0,'unrelated account sees no counterparts');
select * from finish();
rollback;
