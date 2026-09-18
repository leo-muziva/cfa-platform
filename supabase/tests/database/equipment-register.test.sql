begin;

select plan(14);

select has_table('public','equipment_types','equipment types table exists');
select has_table('public','equipment_items','equipment items table exists');
select is((select count(*)::integer from public.equipment_types),17,'seventeen equipment types are seeded');
select is((select count(*)::integer from public.equipment_items),117,'the full 117-item register is seeded');
select is((select count(*)::integer from public.equipment_items i
  join public.equipment_types t on t.id=i.type_id
  where t.code_prefix<>left(i.code,2)),0,
  'every item hangs off the type its code prefix belongs to');

-- The demo seed names a holder for everything that is out. Without this the
-- register quietly drifts back to every row reading "not recorded", which looks
-- identical to the feature not working.
select is((select count(*)::integer from public.equipment_items
  where status='with_member' and assigned_to is null), 0,
  'every item that is out has a holder recorded');
select ok((select count(distinct assigned_to) from public.equipment_items
  where assigned_to is not null) > 1,
  'holders are spread across more than one person');

-- A fencer with no staff flag: the register should not exist as far as they know.
set local role authenticated;
select set_config('request.jwt.claim.sub','33333333-3333-4333-8333-333333333333',true);
select is((select count(*)::integer from public.equipment_items),0,'a member cannot read the register');
select is((select count(*)::integer from public.equipment_types),0,'a member cannot read equipment types');
reset role;

-- A coach keeps the register day to day, but does not get to remove kit.
set local role authenticated;
select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);
select is((select count(*)::integer from public.equipment_items),117,'a coach reads the whole register');
select lives_ok($$update public.equipment_items set condition='fair' where code='WF001'$$,
  'a coach can edit an item');
select lives_ok($$insert into public.equipment_items(type_id,code,hand,condition,status)
  select id,'WF900','right','good','in_storage' from public.equipment_types where code_prefix='WF'$$,
  'a coach can add an item');
delete from public.equipment_items where code='WF900';
select is((select count(*)::integer from public.equipment_items where code='WF900'),1,
  'a coach delete is refused by RLS, silently and without removing the row');
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
delete from public.equipment_items where code='WF900';
select is((select count(*)::integer from public.equipment_items where code='WF900'),0,
  'an admin can delete an item');
reset role;

select * from finish();
rollback;
