import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { ExportOrder, Handedness, SupplierLine } from "@/lib/services/bulk-order-export";
import type { ReviewFinding, ReviewStep } from "@/lib/ai/supplier-review-agent";
import type { SheetDiff } from "@/lib/services/supplier-sheet";

// Data access for supplier order sheets. Every call uses the signed-in
// staff member's client, so RLS (admin only) applies; the service-role key
// is never used here.

export const SHEET_BUCKET = "supplier-sheets";

export type SheetStatus = "generated" | "needs_approval" | "proofed" | "approved" | "sent";

export interface SheetRecord {
  id: string;
  bulkOrderId: string;
  status: SheetStatus;
  lines: SupplierLine[];
  linesHash: string;
  paidOrderCount: number;
  snapshotPath: string;
  generatedAt: string;
  lastCheck: SheetCheck | null;
  sheetApprovedAt: string | null;
  aiSummary: string | null;
  aiFindings: ReviewFinding[] | null;
  emailDraft: string | null;
  modelUsed: string | null;
  proofedAt: string | null;
  approvedAt: string | null;
  gmailDraftId: string | null;
  sentAt: string | null;
}

export interface SheetCheck {
  checkedAt: string;
  matches: boolean;
  description: string;
  diff: SheetDiff;
}

export interface BulkOrderSummary {
  id: string;
  reference: string;
  status: string;
}

type OneOrMany<T> = T | T[] | null;

function one<T>(value: OneOrMany<T>): T | null {
  return Array.isArray(value) ? value[0] ?? null : value;
}

interface SheetRow {
  id: string;
  bulk_order_id: string;
  status: SheetStatus;
  lines: SupplierLine[];
  lines_hash: string;
  paid_order_count: number;
  snapshot_path: string;
  generated_at: string;
  last_check: SheetCheck | null;
  sheet_approved_at: string | null;
  ai_summary: string | null;
  ai_findings: ReviewFinding[] | null;
  email_draft: string | null;
  model_used: string | null;
  proofed_at: string | null;
  approved_at: string | null;
  gmail_draft_id: string | null;
  sent_at: string | null;
}

const SHEET_COLUMNS =
  "id, bulk_order_id, status, lines, lines_hash, paid_order_count, snapshot_path, generated_at, last_check, " +
  "sheet_approved_at, ai_summary, ai_findings, email_draft, model_used, proofed_at, approved_at, gmail_draft_id, sent_at";

function toSheet(row: SheetRow): SheetRecord {
  return {
    id: row.id,
    bulkOrderId: row.bulk_order_id,
    status: row.status,
    lines: row.lines ?? [],
    linesHash: row.lines_hash,
    paidOrderCount: row.paid_order_count,
    snapshotPath: row.snapshot_path,
    generatedAt: row.generated_at,
    lastCheck: row.last_check,
    sheetApprovedAt: row.sheet_approved_at,
    aiSummary: row.ai_summary,
    aiFindings: row.ai_findings,
    emailDraft: row.email_draft,
    modelUsed: row.model_used,
    proofedAt: row.proofed_at,
    approvedAt: row.approved_at,
    gmailDraftId: row.gmail_draft_id,
    sentAt: row.sent_at,
  };
}

export async function getBulkOrderSummary(bulkOrderId: string): Promise<BulkOrderSummary | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("bulk_orders")
    .select("id, reference, status")
    .eq("id", bulkOrderId)
    .maybeSingle();
  return data ? { id: data.id, reference: data.reference, status: data.status } : null;
}

interface RawItem {
  quantity: number;
  size: string | null;
  handedness: Handedness | null;
  unit_price: number | string;
  products: OneOrMany<{ item_code: string; name: string; category: string | null }>;
}

interface RawOrder {
  id: string;
  status: string;
  order_items: RawItem[] | null;
}

// Product lines only. No profile columns are selected, so nothing about
// the customer can reach the spreadsheet or the AI.
export async function getBulkOrderLines(
  bulkOrderId: string
): Promise<{ orders: ExportOrder[]; paidOrderIds: string[] } | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("bulk_orders")
    .select("id, orders (id, status, order_items (quantity, size, handedness, unit_price, products (item_code, name, category)))")
    .eq("id", bulkOrderId)
    .maybeSingle();
  if (error || !data) return null;

  const rawOrders = (data.orders ?? []) as RawOrder[];
  const orders: ExportOrder[] = rawOrders.map(function (order) {
    return {
      status: order.status,
      customer: null,
      items: (order.order_items ?? []).flatMap(function (item) {
        const product = one(item.products);
        if (!product) return [];
        return [{
          itemCode: product.item_code,
          name: product.name,
          category: product.category,
          size: item.size,
          handedness: item.handedness,
          quantity: item.quantity,
          unitPrice: Number(item.unit_price),
        }];
      }),
    };
  });
  const paidOrderIds = rawOrders.filter((o) => o.status === "paid").map((o) => o.id);
  return { orders, paidOrderIds };
}

export async function getSheet(bulkOrderId: string): Promise<SheetRecord | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("supplier_order_sheets")
    .select(SHEET_COLUMNS)
    .eq("bulk_order_id", bulkOrderId)
    .maybeSingle();
  return data ? toSheet(data as unknown as SheetRow) : null;
}

export async function getSheetsForBulkOrders(bulkOrderIds: string[]): Promise<Map<string, SheetRecord>> {
  const result = new Map<string, SheetRecord>();
  if (bulkOrderIds.length === 0) return result;
  const supabase = await createClient();
  const { data } = await supabase.from("supplier_order_sheets").select(SHEET_COLUMNS).in("bulk_order_id", bulkOrderIds);
  for (const row of (data ?? []) as unknown as SheetRow[]) {
    result.set(row.bulk_order_id, toSheet(row));
  }
  return result;
}

export interface SheetWrite {
  status?: SheetStatus;
  lines?: SupplierLine[];
  lines_hash?: string;
  paid_order_count?: number;
  snapshot_path?: string;
  generated_by?: string;
  generated_at?: string;
  last_check?: SheetCheck | null;
  sheet_approved_by?: string | null;
  sheet_approved_at?: string | null;
  ai_summary?: string | null;
  ai_findings?: ReviewFinding[] | null;
  email_draft?: string | null;
  model_used?: string | null;
  proofed_at?: string | null;
  approved_by?: string | null;
  approved_at?: string | null;
  gmail_draft_id?: string | null;
  sent_at?: string | null;
}

export async function insertSheet(bulkOrderId: string, values: SheetWrite): Promise<SheetRecord | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("supplier_order_sheets")
    .insert({ bulk_order_id: bulkOrderId, ...values })
    .select(SHEET_COLUMNS)
    .maybeSingle();
  return data ? toSheet(data as unknown as SheetRow) : null;
}

// Only updates when the sheet is still in one of the expected statuses,
// so two staff members clicking at once cannot both move it.
export async function updateSheet(
  sheetId: string,
  expected: SheetStatus[],
  values: SheetWrite
): Promise<SheetRecord | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("supplier_order_sheets")
    .update(values)
    .eq("id", sheetId)
    .in("status", expected)
    .select(SHEET_COLUMNS);
  const row = (data ?? [])[0];
  return row ? toSheet(row as unknown as SheetRow) : null;
}

export async function logSheetEvent(sheetId: string, event: string, details: Record<string, unknown> = {}): Promise<void> {
  const supabase = await createClient();
  await supabase.rpc("log_supplier_sheet_event", { target_sheet: sheetId, event, details });
}

const XLSX_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export async function uploadSheetFile(path: string, file: Buffer): Promise<boolean> {
  const supabase = await createClient();
  const { error } = await supabase.storage.from(SHEET_BUCKET).upload(path, file, { contentType: XLSX_TYPE, upsert: true });
  return !error;
}

export async function downloadSheetFile(path: string): Promise<Buffer | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.storage.from(SHEET_BUCKET).download(path);
  if (error || !data) return null;
  return Buffer.from(await data.arrayBuffer());
}

export async function createSheetSignedUrl(path: string, seconds: number, downloadName: string): Promise<string | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.storage
    .from(SHEET_BUCKET)
    .createSignedUrl(path, seconds, { download: downloadName });
  return error || !data ? null : data.signedUrl;
}

export interface CatalogueRow {
  item_code: string;
  sizes: string | null;
  needs_handedness: boolean;
  price: number | string;
  is_active: boolean;
}

export async function getCatalogueRows(itemCodes: string[]): Promise<CatalogueRow[]> {
  if (itemCodes.length === 0) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("products")
    .select("item_code, sizes, needs_handedness, price, is_active")
    .in("item_code", itemCodes);
  return (data ?? []) as CatalogueRow[];
}

// Item quantities from the most recent bulk orders already sent to the
// supplier, for spotting unusual quantities.
export async function getPastBulkOrderQuantities(excludeBulkOrderId: string): Promise<Array<Map<string, number>>> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("bulk_orders")
    .select("id, orders (status, order_items (quantity, products (item_code)))")
    .in("status", ["placed", "shipping", "arrived", "distributed"])
    .neq("id", excludeBulkOrderId)
    .order("created_at", { ascending: false })
    .limit(10);

  type PastOrder = { status: string; order_items: Array<{ quantity: number; products: OneOrMany<{ item_code: string }> }> | null };
  return (data ?? []).map(function (bulk) {
    const totals = new Map<string, number>();
    for (const order of (bulk.orders ?? []) as PastOrder[]) {
      if (order.status !== "paid") continue;
      for (const item of order.order_items ?? []) {
        const code = one(item.products)?.item_code;
        if (code) totals.set(code, (totals.get(code) ?? 0) + item.quantity);
      }
    }
    return totals;
  });
}

// Paid orders in the list that still have a refund requested, approved or
// being processed.
export async function countOrdersWithOpenRefunds(orderIds: string[]): Promise<number> {
  if (orderIds.length === 0) return 0;
  const supabase = await createClient();
  const { data } = await supabase
    .from("refund_requests")
    .select("id, payment_attempts!inner (order_id)")
    .in("status", ["requested", "approved", "processing"])
    .in("payment_attempts.order_id", orderIds);
  const orders = new Set<string>();
  for (const row of (data ?? []) as Array<{ payment_attempts: OneOrMany<{ order_id: string | null }> }>) {
    const orderId = one(row.payment_attempts)?.order_id;
    if (orderId) orders.add(orderId);
  }
  return orders.size;
}

export async function getLastAiRunStart(sheetId: string): Promise<Date | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("ai_runs")
    .select("created_at")
    .eq("sheet_id", sheetId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data ? new Date(data.created_at) : null;
}

export type StartRunResult = { ok: true; runId: string } | { ok: false; reason: "already_running" | "failed" };

export async function startAiRun(sheetId: string, userId: string): Promise<StartRunResult> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("ai_runs")
    .insert({ sheet_id: sheetId, triggered_by: userId })
    .select("id")
    .maybeSingle();
  if (error?.code === "23505") return { ok: false, reason: "already_running" };
  if (error || !data) return { ok: false, reason: "failed" };
  return { ok: true, runId: data.id };
}

export interface RunFinish {
  status: "succeeded" | "fell_back" | "rules_only" | "failed";
  provider: string | null;
  model: string | null;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
  flagged: boolean;
  flagReason: string | null;
  error: string | null;
}

export async function finishAiRun(runId: string, finish: RunFinish, steps: ReviewStep[]): Promise<void> {
  const supabase = await createClient();
  if (steps.length > 0) {
    await supabase.from("ai_run_steps").insert(
      steps.map(function (step) {
        return {
          run_id: runId,
          step_number: step.stepNumber,
          provider: step.provider,
          tool_name: step.toolName,
          tool_args: step.toolArgs,
          row_count: step.rowCount,
          duration_ms: step.durationMs,
        };
      })
    );
  }
  await supabase
    .from("ai_runs")
    .update({
      status: finish.status,
      provider: finish.provider,
      model: finish.model,
      input_tokens: finish.inputTokens,
      output_tokens: finish.outputTokens,
      latency_ms: finish.latencyMs,
      flagged: finish.flagged,
      flag_reason: finish.flagReason,
      error: finish.error,
      finished_at: new Date().toISOString(),
    })
    .eq("id", runId);
}

export interface AiRunStepRow {
  step_number: number;
  provider: string | null;
  tool_name: string | null;
  row_count: number | null;
  duration_ms: number | null;
}

export interface AiRunRow {
  id: string;
  status: "running" | "succeeded" | "fell_back" | "rules_only" | "failed";
  provider: string | null;
  model: string | null;
  input_tokens: number | null;
  output_tokens: number | null;
  latency_ms: number | null;
  flagged: boolean;
  flag_reason: string | null;
  error: string | null;
  created_at: string;
  finished_at: string | null;
  triggered_by_profile: { full_name: string | null } | null;
  ai_run_steps: AiRunStepRow[];
}

// Admin-only by RLS. The newest runs first, each with its tool steps.
export async function listAiRuns(sheetId: string, limit = 20): Promise<AiRunRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("ai_runs")
    .select("id,status,provider,model,input_tokens,output_tokens,latency_ms,flagged,flag_reason,error,created_at,finished_at," +
      "triggered_by_profile:profiles!ai_runs_triggered_by_fkey(full_name)," +
      "ai_run_steps(step_number,provider,tool_name,row_count,duration_ms)")
    .eq("sheet_id", sheetId)
    .order("created_at", { ascending: false })
    .order("step_number", { referencedTable: "ai_run_steps", ascending: true })
    .limit(limit);
  return error ? [] : (data as unknown as AiRunRow[]);
}

export interface SheetEventRow {
  event_type: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

// Generate, proof, draft and send events for one sheet, newest first.
export async function listSheetEvents(sheetId: string, limit = 30): Promise<SheetEventRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("audit_events")
    .select("event_type,metadata,created_at")
    .eq("entity_type", "supplier_order_sheet")
    .eq("entity_id", sheetId)
    .order("created_at", { ascending: false })
    .limit(limit);
  return error ? [] : (data as SheetEventRow[]);
}
