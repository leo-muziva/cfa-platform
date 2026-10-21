begin;
select plan(4);

insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data,raw_app_meta_data)
values('96000000-0000-4000-8000-000000000001','self-cancel@cfa.test',now(),'{"full_name":"Self Cancel"}','{}');
update public.profiles set membership_status='member', date_of_birth='1990-01-01', profile_completed_at=now()
where id='96000000-0000-4000-8000-000000000001';
insert into public.memberships(profile_id,membership_type_id,status)
select '96000000-0000-4000-8000-000000000001',id,'active' from public.membership_types where code='month_to_month';

set local role authenticated;
select set_config('request.jwt.claim.sub','96000000-0000-4000-8000-000000000001',true);
select throws_ok($$select public.change_membership_status('96000000-0000-4000-8000-000000000001','active')$$,
  'P0001','members may only cancel','a member cannot reactivate themselves');
select lives_ok($$select public.change_membership_status('96000000-0000-4000-8000-000000000001','cancelled')$$,
  'a member can cancel their own membership');
reset role;
select is((select membership_status from public.profiles where id='96000000-0000-4000-8000-000000000001'),
  'guest','self-cancel returns the profile to guest');

set local role authenticated;
select set_config('request.jwt.claim.sub','96000000-0000-4000-8000-000000000001',true);
select lives_ok($$select public.submit_membership_application((select id from public.membership_types where code='month_to_month'))$$,
  'a cancelled member can apply again');
reset role;
select * from finish();
rollback;
