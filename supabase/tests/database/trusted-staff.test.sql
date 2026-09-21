begin;
select plan(12);

insert into auth.users (id, email, raw_user_meta_data, raw_app_meta_data)
values ('91000000-0000-4000-8000-000000000001', 'crafted-staff@cfa.test',
  '{"full_name":"Synthetic Account","cfa_is_staff":true,"cfa_staff_type":"admin"}', '{}');
update auth.users set email_confirmed_at = now()
where id = '91000000-0000-4000-8000-000000000001';
select is((select is_staff from public.profiles where id = '91000000-0000-4000-8000-000000000001'),
  false, 'crafted signup metadata does not grant staff access');
select is((select staff_type from public.profiles where id = '91000000-0000-4000-8000-000000000001'),
  null::text, 'crafted staff type is discarded');

set local role authenticated;
select set_config('request.jwt.claim.sub', '91000000-0000-4000-8000-000000000001', true);
select throws_ok($$select public.provision_invited_staff('91000000-0000-4000-8000-000000000001', 'admin')$$,
  '42501', 'permission denied for function provision_invited_staff', 'ordinary users cannot provision staff');
select throws_ok($$update public.profiles set is_staff = true, staff_type = 'admin'
  where id = '91000000-0000-4000-8000-000000000001'$$,
  'P0001', 'protected profile fields may only be changed by an administrator', 'direct profile escalation is rejected');
reset role;
select set_config('request.jwt.claim.sub', '', true);
set local role anon;
select throws_ok($$select public.provision_invited_staff('91000000-0000-4000-8000-000000000001', 'admin')$$,
  '42501', 'permission denied for function provision_invited_staff', 'anonymous callers cannot provision staff');
reset role;
set local role service_role;
select lives_ok($$select public.provision_invited_staff('91000000-0000-4000-8000-000000000001', 'coach')$$,
  'trusted provisioning works after confirmation');
reset role;
select is((select staff_type from public.profiles where id = '91000000-0000-4000-8000-000000000001'),
  'coach', 'trusted provisioning updates an existing profile');
update auth.users set email_confirmed_at = null, raw_user_meta_data = '{"cfa_is_staff":true,"cfa_staff_type":"admin"}'
where id = '91000000-0000-4000-8000-000000000001';
update auth.users set email_confirmed_at = now()
where id = '91000000-0000-4000-8000-000000000001';
select is((select staff_type from public.profiles where id = '91000000-0000-4000-8000-000000000001'),
  'coach', 'confirmation preserves the existing assignment');
set local role authenticated;
select set_config('request.jwt.claim.sub', '91000000-0000-4000-8000-000000000001', true);
select is(public.current_user_role(), 'coach', 'legacy policies use the trusted staff dimension');
reset role;
select set_config('request.jwt.claim.sub', '', true);
insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data, raw_app_meta_data)
values ('91000000-0000-4000-8000-000000000002', 'confirmed-crafted@cfa.test', now(),
  '{"cfa_is_staff":true,"cfa_staff_type":"admin"}', '{}');
select is((select is_staff from public.profiles where id = '91000000-0000-4000-8000-000000000002'),
  false, 'confirmed inserts also reject user-controlled staff claims');
insert into auth.users (id, email, raw_app_meta_data)
values ('91000000-0000-4000-8000-000000000003', 'pending-staff@cfa.test', '{}');
set local role service_role;
select lives_ok($$select public.provision_invited_staff('91000000-0000-4000-8000-000000000003', 'admin')$$,
  'trusted provisioning works before confirmation');
reset role;
update auth.users set email_confirmed_at = now()
where id = '91000000-0000-4000-8000-000000000003';
select is((select staff_type from public.profiles where id = '91000000-0000-4000-8000-000000000003'),
  'admin', 'confirmation applies the server-controlled pending assignment');
select * from finish();
rollback;
