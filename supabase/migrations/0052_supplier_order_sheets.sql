-- Supplier order sheets and the AI proof.
--
-- Staff press "Generate orders spreadsheet" to save a fixed xlsx of a bulk
-- order's paid lines, then "AI proof" to re-check it against the database
-- and get an AI review before a Gmail draft is made. Nothing here runs on a
-- schedule or a trigger: every step is a staff button.
--
-- ai_runs / ai_run_steps are a quiet audit trail of each AI call. They hold
-- product data only, never member names, emails or phone numbers.

-- ============================================================
-- 1. Sheets
-- ============================================================
create table public.supplier_order_sheets (
  id uuid primary key default gen_random_uuid(),
  bulk_order_id uuid not null unique references public.bulk_orders(id) on delete cascade,
  -- generated: saved, not yet proofed
  -- needs_approval: the database check rebuilt it; staff must approve the new version
  -- proofed: matches the database and the AI review is done
  -- approved: Gmail draft created
  -- sent: staff confirmed it went to the supplier
  status text not null default 'generated'
    check (status in ('generated', 'needs_approval', 'proofed', 'approved', 'sent')),
  lines jsonb not null default '[]'::jsonb,
  lines_hash text not null,
  paid_order_count integer not null default 0 check (paid_order_count >= 0),
  snapshot_path text not null,
  generated_by uuid references public.profiles(id) on delete set null,
  generated_at timestamptz not null default now(),
  last_check jsonb,
  sheet_approved_by uuid references public.profiles(id) on delete set null,
  sheet_approved_at timestamptz,
  ai_summary text,
  ai_findings jsonb,
  email_draft text,
  model_used text,
  proofed_at timestamptz,
  approved_by uuid references public.profiles(id) on delete set null,
  approved_at timestamptz,
  gmail_draft_id text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger supplier_order_sheets_updated_at
  before update on public.supplier_order_sheets
  for each row execute function public.set_updated_at();

alter table public.supplier_order_sheets enable row level security;
create policy "Admins read supplier sheets"
  on public.supplier_order_sheets for select using (public.current_user_is_admin());
create policy "Admins create supplier sheets"
  on public.supplier_order_sheets for insert with check (public.current_user_is_admin());
create policy "Admins update supplier sheets"
  on public.supplier_order_sheets for update
  using (public.current_user_is_admin()) with check (public.current_user_is_admin());
revoke delete, truncate on public.supplier_order_sheets from anon, authenticated;
revoke all on public.supplier_order_sheets from anon;

-- ============================================================
-- 2. AI audit trail
-- ============================================================
create table public.ai_runs (
  id uuid primary key default gen_random_uuid(),
  sheet_id uuid not null references public.supplier_order_sheets(id) on delete cascade,
  triggered_by uuid references public.profiles(id) on delete set null,
  status text not null default 'running'
    check (status in ('running', 'succeeded', 'fell_back', 'rules_only', 'failed')),
  provider text,
  model text,
  input_tokens integer,
  output_tokens integer,
  latency_ms integer,
  -- Set when the output referenced lines or rules that do not exist, or
  -- other signs the model was steered by text in the data.
  flagged boolean not null default false,
  flag_reason text,
  error text,
  created_at timestamptz not null default now(),
  finished_at timestamptz
);
create index ai_runs_sheet_idx on public.ai_runs (sheet_id, created_at desc);
-- One AI proof at a time per sheet: a second click reuses the running one.
create unique index ai_runs_one_running_idx on public.ai_runs (sheet_id) where status = 'running';

create table public.ai_run_steps (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.ai_runs(id) on delete cascade,
  step_number integer not null check (step_number >= 0),
  provider text,
  tool_name text,
  tool_args jsonb,
  row_count integer,
  duration_ms integer,
  created_at timestamptz not null default now()
);
create index ai_run_steps_run_idx on public.ai_run_steps (run_id, step_number);

alter table public.ai_runs enable row level security;
alter table public.ai_run_steps enable row level security;
create policy "Admins read AI runs" on public.ai_runs for select using (public.current_user_is_admin());
create policy "Admins create AI runs" on public.ai_runs for insert with check (public.current_user_is_admin());
create policy "Admins update AI runs" on public.ai_runs for update
  using (public.current_user_is_admin()) with check (public.current_user_is_admin());
create policy "Admins read AI run steps" on public.ai_run_steps for select using (public.current_user_is_admin());
create policy "Admins create AI run steps" on public.ai_run_steps for insert with check (public.current_user_is_admin());
revoke all on public.ai_runs, public.ai_run_steps from anon;
revoke delete, truncate on public.ai_runs, public.ai_run_steps from authenticated;
revoke update on public.ai_run_steps from authenticated;

-- ============================================================
-- 3. Audit events for sheet changes
-- ============================================================
-- audit_events has no client insert policy, so staff actions go through
-- this function. Only supplier_sheet.* events can be written this way.
create function public.log_supplier_sheet_event(target_sheet uuid, event text, details jsonb default '{}'::jsonb)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.current_user_is_admin() then
    raise exception 'forbidden';
  end if;
  if event !~ '^supplier_sheet\.[a-z_]+$' then
    raise exception 'invalid_event';
  end if;
  if not exists (select 1 from public.supplier_order_sheets where id = target_sheet) then
    raise exception 'sheet_not_found';
  end if;
  insert into public.audit_events(event_type, actor_id, entity_type, entity_id, metadata)
  values (event, auth.uid(), 'supplier_order_sheet', target_sheet, coalesce(details, '{}'::jsonb));
end;
$$;
revoke all on function public.log_supplier_sheet_event(uuid, text, jsonb) from public, anon;
grant execute on function public.log_supplier_sheet_event(uuid, text, jsonb) to authenticated;

-- ============================================================
-- 4. Private storage for the saved xlsx files
-- ============================================================
insert into storage.buckets (id, name, public)
values ('supplier-sheets', 'supplier-sheets', false)
on conflict (id) do nothing;

create policy "Admins read supplier sheet files"
  on storage.objects for select
  using (bucket_id = 'supplier-sheets' and public.current_user_is_admin());
create policy "Admins upload supplier sheet files"
  on storage.objects for insert
  with check (bucket_id = 'supplier-sheets' and public.current_user_is_admin());
create policy "Admins replace supplier sheet files"
  on storage.objects for update
  using (bucket_id = 'supplier-sheets' and public.current_user_is_admin())
  with check (bucket_id = 'supplier-sheets' and public.current_user_is_admin());
