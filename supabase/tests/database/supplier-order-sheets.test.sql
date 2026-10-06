begin;
select no_plan();

-- Supplier order sheets and the AI audit trail (0034) are admin only.
-- Synthetic seed actors; everything rolls back.
--   11111111 admin staff   22222222 coach staff   44444444 guardian payer

insert into public.bulk_orders(id, reference, status) values
  ('34340000-0000-4000-8000-0000000000b1', 'BO-TEST0034', 'placed');
insert into public.supplier_order_sheets(id, bulk_order_id, lines_hash, snapshot_path) values
  ('34340000-0000-4000-8000-0000000000c1', '34340000-0000-4000-8000-0000000000b1', 'hash', 'test/path.xlsx');
insert into public.ai_runs(id, sheet_id, status) values
  ('34340000-0000-4000-8000-0000000000d1', '34340000-0000-4000-8000-0000000000c1', 'succeeded');
insert into public.ai_run_steps(run_id, step_number, tool_name) values
  ('34340000-0000-4000-8000-0000000000d1', 0, 'getSheetLines');

-- ============================================================
-- Anonymous visitors see nothing
-- ============================================================
set local role anon;
select throws_ok($$select count(*) from public.supplier_order_sheets$$, '42501', null, 'anon cannot read sheets');
select throws_ok($$select count(*) from public.ai_runs$$, '42501', null, 'anon cannot read AI runs');
reset role;

-- ============================================================
-- Members and coaches see nothing and cannot write
-- ============================================================
set local role authenticated;
select set_config('request.jwt.claim.sub', '44444444-4444-4444-8444-444444444444', true);
select is((select count(*) from public.supplier_order_sheets), 0::bigint, 'member cannot read sheets');
select is((select count(*) from public.ai_runs), 0::bigint, 'member cannot read AI runs');
select is((select count(*) from public.ai_run_steps), 0::bigint, 'member cannot read AI run steps');
select throws_ok($$insert into public.supplier_order_sheets(bulk_order_id, lines_hash, snapshot_path)
  values ('34340000-0000-4000-8000-0000000000b1', 'x', 'x')$$, '42501', null, 'member cannot create a sheet');
select throws_ok($$select public.log_supplier_sheet_event('34340000-0000-4000-8000-0000000000c1', 'supplier_sheet.sent', '{}')$$,
  'P0001', 'forbidden', 'member cannot write sheet audit events');

select set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', true);
select is((select count(*) from public.supplier_order_sheets), 0::bigint, 'coach cannot read sheets');
select is((select count(*) from public.ai_runs), 0::bigint, 'coach cannot read AI runs');
update public.supplier_order_sheets set status = 'sent' where id = '34340000-0000-4000-8000-0000000000c1';
reset role;
select is((select status from public.supplier_order_sheets where id = '34340000-0000-4000-8000-0000000000c1'),
  'generated', 'coach update changed nothing');

-- ============================================================
-- Admins read and update, but cannot delete
-- ============================================================
set local role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
select is((select count(*) from public.supplier_order_sheets where id = '34340000-0000-4000-8000-0000000000c1'),
  1::bigint, 'admin reads sheets');
select is((select count(*) from public.ai_run_steps where run_id = '34340000-0000-4000-8000-0000000000d1'),
  1::bigint, 'admin reads AI run steps');
select lives_ok($$update public.supplier_order_sheets set status = 'proofed'
  where id = '34340000-0000-4000-8000-0000000000c1'$$, 'admin updates a sheet');
select throws_ok($$update public.supplier_order_sheets set status = 'shipped'
  where id = '34340000-0000-4000-8000-0000000000c1'$$, '23514', null, 'sheet status must be a known value');
select throws_ok($$delete from public.supplier_order_sheets where id = '34340000-0000-4000-8000-0000000000c1'$$,
  '42501', null, 'admin cannot delete sheets');
select throws_ok($$update public.ai_run_steps set tool_name = 'x'$$, '42501', null, 'AI run steps cannot be edited');

-- One running AI proof per sheet.
select lives_ok($$insert into public.ai_runs(sheet_id) values ('34340000-0000-4000-8000-0000000000c1')$$,
  'admin starts an AI run');
select throws_ok($$insert into public.ai_runs(sheet_id) values ('34340000-0000-4000-8000-0000000000c1')$$,
  '23505', null, 'a second running AI run for the same sheet is refused');

-- Audit events: only supplier_sheet.* names, only for real sheets.
select lives_ok($$select public.log_supplier_sheet_event('34340000-0000-4000-8000-0000000000c1', 'supplier_sheet.proofed', '{"findings":2}')$$,
  'admin writes a sheet audit event');
select throws_ok($$select public.log_supplier_sheet_event('34340000-0000-4000-8000-0000000000c1', 'payment.succeeded', '{}')$$,
  'P0001', 'invalid_event', 'other event types cannot be written');
select throws_ok($$select public.log_supplier_sheet_event('34340000-0000-4000-8000-0000000000ff', 'supplier_sheet.sent', '{}')$$,
  'P0001', 'sheet_not_found', 'events need a real sheet');
select is((select count(*) from public.audit_events where entity_id = '34340000-0000-4000-8000-0000000000c1'
  and event_type = 'supplier_sheet.proofed'), 1::bigint, 'the event was recorded');
reset role;

-- ============================================================
-- Storage bucket is private
-- ============================================================
select is((select public from storage.buckets where id = 'supplier-sheets'), false, 'supplier sheet bucket is private');

select * from finish();
rollback;
