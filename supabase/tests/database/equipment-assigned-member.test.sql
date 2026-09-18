begin;

select plan(7);

select has_function('public','equipment_member_options','holder name lookup exists');

-- The whole reason this function exists: a coach can resolve a member's name
-- for the register without being able to read profiles.
set local role authenticated;
select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);
select ok((select count(*) from public.equipment_member_options()) > 0,
  'a coach can list member names for the holder picker');
select is((select count(*)::integer from public.profiles
  where id='33333333-3333-4333-8333-333333333333'), 0,
  'a coach still cannot read that member''s profile row directly');
select lives_ok($$update public.equipment_items
  set status='with_member', assigned_to='33333333-3333-4333-8333-333333333333'
  where code='WF001'$$,
  'a coach can record who has an item');
select is((select o.full_name from public.equipment_items i
  join public.equipment_member_options() o on o.id=i.assigned_to
  where i.code='WF001'), 'Fiona Fencer',
  'the recorded holder resolves to a name');
reset role;

-- A fencer is not staff, so the function tells them nothing at all.
set local role authenticated;
select set_config('request.jwt.claim.sub','33333333-3333-4333-8333-333333333333',true);
select is((select count(*)::integer from public.equipment_member_options()), 0,
  'an ordinary member gets no names back');
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
select ok((select count(*) from public.equipment_member_options()) > 0,
  'an admin can list member names too');
reset role;

select * from finish();
rollback;
