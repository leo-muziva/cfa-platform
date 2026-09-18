begin;

select plan(6);

-- profiles.role is gone, so staff_type is the only thing that can say "coach".
select hasnt_column('public','profiles','role','the retired role column is gone');
select hasnt_function('public','current_user_role','the role helper is gone');

-- Promote a fencer exactly the way the admin UI does: adminUpdateProfile writes
-- is_staff and staff_type and nothing else. Before 0014 this left role='fencer'
-- and locked the new coach out of their own agenda.
update public.profiles set is_staff=true, staff_type='coach'
where id='33333333-3333-4333-8333-333333333333';

set local role authenticated;
select set_config('request.jwt.claim.sub','33333333-3333-4333-8333-333333333333',true);
select lives_ok($$select * from public.list_coach_lesson_agenda()$$,
  'a coach promoted through the admin UI can read their own agenda');
select throws_ok($$select * from public.list_coach_lesson_agenda(
  '22222222-2222-4222-8222-222222222222')$$,
  'P0001','forbidden',
  'a coach still cannot read another coach''s agenda');
reset role;

-- And nothing was opened up on the way past.
set local role authenticated;
select set_config('request.jwt.claim.sub','44444444-4444-4444-8444-444444444444',true);
select throws_ok($$select * from public.list_coach_lesson_agenda()$$,
  'P0001','forbidden',
  'a member who is not staff is still refused');
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
select lives_ok($$select * from public.list_coach_lesson_agenda(
  '22222222-2222-4222-8222-222222222222')$$,
  'an admin can still read any coach agenda');
reset role;

select * from finish();
rollback;
