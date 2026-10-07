import "server-only";
import { groupSupplierLines, type SupplierLine } from "@/lib/services/bulk-order-export";
import {
  compareSupplierLines,
  describeSheetDiff,
  parseSizes,
  runSupplierRules,
  supplierLinesHash,
  type CatalogueEntry,
} from "@/lib/services/supplier-sheet";
import { buildSupplierWorkbook, readSupplierWorkbook, SupplierWorkbookError } from "@/lib/services/supplier-sheet-workbook";
import { runSupplierReview, type ReviewContext } from "@/lib/ai/supplier-review-agent";
import { getReviewModels } from "@/lib/ai/models";
import { getGmailDraftProvider } from "@/lib/providers/composio-gmail";
import * as repo from "@/lib/repositories/supplier-sheet-repository";
import type { SheetCheck, SheetRecord } from "@/lib/repositories/supplier-sheet-repository";

// The supplier order flow. Every step is a staff button; nothing here runs
// on a schedule. The order of steps is enforced here, not just by which
// buttons the page shows:
//   Generate  ->  AI proof (database check, then AI review)  ->  Gmail draft  ->  Mark sent
// If the check finds the sheet out of date, it rebuilds it and stops until
// staff approve the updated sheet.

export type SheetErrorCode =
  | "bulk_order_not_found"
  | "bulk_order_closed"
  | "no_paid_orders"
  | "no_sheet"
  | "already_sent"
  | "needs_approval"
  | "not_needs_approval"
  | "not_proofed"
  | "not_approved"
  | "ai_running"
  | "too_soon"
  | "file_unreadable"
  | "storage_failed"
  | "gmail_not_connected"
  | "supplier_email_missing"
  | "gmail_failed"
  | "changed";

export type SheetResult<T> = { ok: true; data: T } | { ok: false; code: SheetErrorCode; message?: string };

export type ProofOutcome =
  | { kind: "needs_approval"; check: SheetCheck; sheet: SheetRecord }
  | { kind: "proofed"; sheet: SheetRecord };

const AI_COOLDOWN_MS = 30_000;
const SIGNED_URL_SECONDS = 300;

function fail<T>(code: SheetErrorCode, message?: string): SheetResult<T> {
  return { ok: false, code, message };
}

export function supplierFilePath(bulkOrderId: string, reference: string): string {
  return bulkOrderId + "/" + reference + "-supplier-order.xlsx";
}

export function reviewFilePath(bulkOrderId: string, reference: string): string {
  return bulkOrderId + "/" + reference + "-supplier-order-review.xlsx";
}

async function loadDatabaseLines(bulkOrderId: string) {
  const loaded = await repo.getBulkOrderLines(bulkOrderId);
  if (!loaded) return null;
  return { lines: groupSupplierLines(loaded.orders), paidOrderIds: loaded.paidOrderIds };
}

function makeCheck(dbLines: SupplierLine[], fileLines: SupplierLine[]): SheetCheck {
  const diff = compareSupplierLines(dbLines, fileLines);
  return { checkedAt: new Date().toISOString(), matches: diff.matches, description: describeSheetDiff(diff), diff };
}

// Builds the xlsx from the current paid orders and saves it as a fixed file.
async function saveSupplierFile(bulk: repo.BulkOrderSummary, lines: SupplierLine[]): Promise<string | null> {
  const path = supplierFilePath(bulk.id, bulk.reference);
  const file = await buildSupplierWorkbook(lines, { reference: bulk.reference, generatedAt: new Date(), status: "DRAFT" });
  return (await repo.uploadSheetFile(path, file)) ? path : null;
}

const CLEARED_REVIEW = {
  ai_summary: null,
  ai_findings: null,
  email_draft: null,
  model_used: null,
  proofed_at: null,
  approved_by: null,
  approved_at: null,
  gmail_draft_id: null,
} as const;

// [1] Generate orders spreadsheet. Re-clicking rebuilds it from the latest
// paid orders and clears any earlier AI review, since it no longer applies.
export async function generateSheet(bulkOrderId: string, actorId: string): Promise<SheetResult<SheetRecord>> {
  const bulk = await repo.getBulkOrderSummary(bulkOrderId);
  if (!bulk) return fail("bulk_order_not_found");
  if (bulk.status === "cancelled" || bulk.status === "distributed") return fail("bulk_order_closed");

  const existing = await repo.getSheet(bulkOrderId);
  if (existing?.status === "sent") return fail("already_sent");

  const db = await loadDatabaseLines(bulkOrderId);
  if (!db) return fail("bulk_order_not_found");
  if (db.lines.length === 0) return fail("no_paid_orders");

  const path = await saveSupplierFile(bulk, db.lines);
  if (!path) return fail("storage_failed");

  const now = new Date().toISOString();
  const values = {
    status: "generated" as const,
    lines: db.lines,
    lines_hash: supplierLinesHash(db.lines),
    paid_order_count: db.paidOrderIds.length,
    snapshot_path: path,
    generated_by: actorId,
    generated_at: now,
    last_check: null,
    sheet_approved_by: null,
    sheet_approved_at: null,
    ...CLEARED_REVIEW,
  };

  const sheet = existing
    ? await repo.updateSheet(existing.id, ["generated", "needs_approval", "proofed", "approved"], values)
    : await repo.insertSheet(bulkOrderId, values);
  if (!sheet) return fail("changed");

  await repo.logSheetEvent(sheet.id, existing ? "supplier_sheet.regenerated" : "supplier_sheet.generated", {
    lines: db.lines.length,
    paid_orders: db.paidOrderIds.length,
  });
  return { ok: true, data: sheet };
}

// The database check: re-read every paid order and compare it with what is
// actually in the saved file. A mismatch rebuilds the file and waits for
// staff to approve it.
async function checkAgainstDatabase(
  bulk: repo.BulkOrderSummary,
  sheet: SheetRecord
): Promise<SheetResult<{ check: SheetCheck; sheet: SheetRecord; paidOrderIds: string[]; lines: SupplierLine[] }>> {
  const db = await loadDatabaseLines(bulk.id);
  if (!db) return fail("bulk_order_not_found");

  const file = await repo.downloadSheetFile(sheet.snapshotPath);
  if (!file) return fail("file_unreadable", "The saved spreadsheet could not be downloaded.");

  let fileLines: SupplierLine[];
  try {
    fileLines = await readSupplierWorkbook(file);
  } catch (error) {
    return fail("file_unreadable", error instanceof SupplierWorkbookError ? error.message : undefined);
  }

  const check = makeCheck(db.lines, fileLines);
  if (check.matches) {
    return { ok: true, data: { check, sheet, paidOrderIds: db.paidOrderIds, lines: db.lines } };
  }

  if (db.lines.length === 0) return fail("no_paid_orders");
  const path = await saveSupplierFile(bulk, db.lines);
  if (!path) return fail("storage_failed");

  const updated = await repo.updateSheet(sheet.id, ["generated", "proofed", "approved"], {
    status: "needs_approval",
    lines: db.lines,
    lines_hash: supplierLinesHash(db.lines),
    paid_order_count: db.paidOrderIds.length,
    snapshot_path: path,
    last_check: check,
    sheet_approved_by: null,
    sheet_approved_at: null,
    ...CLEARED_REVIEW,
  });
  if (!updated) return fail("changed");

  await repo.logSheetEvent(sheet.id, "supplier_sheet.rebuilt_after_check", {
    added: check.diff.added.length,
    removed: check.diff.removed.length,
    changed: check.diff.changed.length,
  });
  return { ok: true, data: { check, sheet: updated, paidOrderIds: db.paidOrderIds, lines: db.lines } };
}

async function buildReviewContext(
  bulk: repo.BulkOrderSummary,
  lines: SupplierLine[],
  paidOrderIds: string[]
): Promise<ReviewContext> {
  const codes = Array.from(new Set(lines.map((l) => l.itemCode)));
  const [catalogueRows, pastBatches, pendingRefundOrders] = await Promise.all([
    repo.getCatalogueRows(codes),
    repo.getPastBulkOrderQuantities(bulk.id),
    repo.countOrdersWithOpenRefunds(paidOrderIds),
  ]);

  const catalogue = new Map<string, CatalogueEntry>(
    catalogueRows.map(function (row) {
      return [row.item_code, {
        itemCode: row.item_code,
        sizes: parseSizes(row.sizes),
        needsHandedness: row.needs_handedness,
        priceCents: Math.round(Number(row.price) * 100),
        isActive: row.is_active,
      }];
    })
  );

  // Average over the past bulk orders that included the item.
  const sums = new Map<string, { total: number; batches: number }>();
  for (const batch of pastBatches) {
    for (const [code, qty] of batch) {
      const current = sums.get(code) ?? { total: 0, batches: 0 };
      sums.set(code, { total: current.total + qty, batches: current.batches + 1 });
    }
  }
  const pastAverageQuantity = new Map(Array.from(sums, ([code, s]) => [code, s.total / s.batches]));

  return {
    reference: bulk.reference,
    paidOrderCount: paidOrderIds.length,
    lines,
    catalogue,
    pastAverageQuantity,
    ruleFindings: runSupplierRules({ lines, catalogue, pastAverageQuantity, pendingRefundOrders }),
  };
}

// The AI review itself, on a sheet that matches the database.
async function reviewSheet(
  bulk: repo.BulkOrderSummary,
  sheet: SheetRecord,
  lines: SupplierLine[],
  paidOrderIds: string[],
  check: SheetCheck,
  actorId: string
): Promise<SheetResult<SheetRecord>> {
  const lastRun = await repo.getLastAiRunStart(sheet.id);
  if (lastRun && Date.now() - lastRun.getTime() < AI_COOLDOWN_MS) return fail("too_soon");

  const run = await repo.startAiRun(sheet.id, actorId);
  if (!run.ok) return fail(run.reason === "already_running" ? "ai_running" : "changed");

  const started = Date.now();
  const context = await buildReviewContext(bulk, lines, paidOrderIds);
  const review = await runSupplierReview(context, getReviewModels());

  await repo.finishAiRun(
    run.runId,
    {
      status: review.status,
      provider: review.provider,
      model: review.modelId,
      inputTokens: review.inputTokens,
      outputTokens: review.outputTokens,
      latencyMs: Date.now() - started,
      flagged: review.flagged,
      flagReason: review.flagReasons.join("; ") || null,
      error: review.errors.join("; ") || null,
    },
    review.steps
  );

  // Staff copy with a "Review notes" sheet. The supplier copy stays clean.
  const reviewFile = await buildSupplierWorkbook(
    lines,
    { reference: bulk.reference, generatedAt: new Date(), status: "DRAFT" },
    review.findings.map((f) => ({ severity: f.severity, itemCode: f.itemCode, message: f.message, suggestion: f.suggestion }))
  );
  await repo.uploadSheetFile(reviewFilePath(bulk.id, bulk.reference), reviewFile);

  const updated = await repo.updateSheet(sheet.id, ["generated", "proofed"], {
    status: "proofed",
    last_check: check,
    ai_summary: review.summary,
    ai_findings: review.findings,
    email_draft: review.emailDraft,
    model_used: review.provider ? review.provider + ":" + review.modelId : "basic checks only",
    proofed_at: new Date().toISOString(),
  });
  if (!updated) return fail("changed");

  await repo.logSheetEvent(sheet.id, "supplier_sheet.proofed", {
    status: review.status,
    provider: review.provider,
    findings: review.findings.length,
    flagged: review.flagged,
  });
  return { ok: true, data: updated };
}

// [2] AI proof.
export async function runAiProof(bulkOrderId: string, actorId: string): Promise<SheetResult<ProofOutcome>> {
  const bulk = await repo.getBulkOrderSummary(bulkOrderId);
  if (!bulk) return fail("bulk_order_not_found");
  const sheet = await repo.getSheet(bulkOrderId);
  if (!sheet) return fail("no_sheet");
  if (sheet.status === "sent") return fail("already_sent");
  if (sheet.status === "needs_approval") return fail("needs_approval");

  const checked = await checkAgainstDatabase(bulk, sheet);
  if (!checked.ok) return checked;
  if (!checked.data.check.matches) {
    return { ok: true, data: { kind: "needs_approval", check: checked.data.check, sheet: checked.data.sheet } };
  }

  // An approved sheet that still matches goes back to proofed with a fresh review.
  let current = checked.data.sheet;
  if (current.status === "approved") {
    const reset = await repo.updateSheet(current.id, ["approved"], { status: "proofed", approved_by: null, approved_at: null, gmail_draft_id: null });
    if (!reset) return fail("changed");
    current = reset;
  }

  const reviewed = await reviewSheet(bulk, current, checked.data.lines, checked.data.paidOrderIds, checked.data.check, actorId);
  if (!reviewed.ok) return reviewed;
  return { ok: true, data: { kind: "proofed", sheet: reviewed.data } };
}

// [2b] Staff approve the rebuilt sheet; the AI review then starts.
export async function approveUpdatedSheet(bulkOrderId: string, actorId: string): Promise<SheetResult<ProofOutcome>> {
  const sheet = await repo.getSheet(bulkOrderId);
  if (!sheet) return fail("no_sheet");
  if (sheet.status !== "needs_approval") return fail("not_needs_approval");

  const approved = await repo.updateSheet(sheet.id, ["needs_approval"], {
    status: "generated",
    sheet_approved_by: actorId,
    sheet_approved_at: new Date().toISOString(),
  });
  if (!approved) return fail("changed");
  await repo.logSheetEvent(sheet.id, "supplier_sheet.update_approved", {});

  return runAiProof(bulkOrderId, actorId);
}

export interface DraftInput {
  emailBody: string;
}

// [3] Approve and create the Gmail draft. The database is checked one last
// time so a late order cannot slip past the proof.
export async function approveAndCreateDraft(
  bulkOrderId: string,
  actorId: string,
  input: DraftInput,
  env: Record<string, string | undefined> = process.env
): Promise<SheetResult<SheetRecord>> {
  const bulk = await repo.getBulkOrderSummary(bulkOrderId);
  if (!bulk) return fail("bulk_order_not_found");
  const sheet = await repo.getSheet(bulkOrderId);
  if (!sheet) return fail("no_sheet");
  if (sheet.status !== "proofed") return fail("not_proofed");

  const recipient = env.SUPPLIER_EMAIL?.trim();
  if (!recipient) return fail("supplier_email_missing");
  const gmail = getGmailDraftProvider(env);
  if (!gmail) return fail("gmail_not_connected");

  const checked = await checkAgainstDatabase(bulk, sheet);
  if (!checked.ok) return checked;
  if (!checked.data.check.matches) return fail("needs_approval");

  const url = await repo.createSheetSignedUrl(sheet.snapshotPath, SIGNED_URL_SECONDS, bulk.reference + "-supplier-order.xlsx");
  if (!url) return fail("storage_failed");

  const draft = await gmail.createDraft({
    recipient,
    subject: "Cape Fencing Academy order " + bulk.reference,
    body: input.emailBody,
    attachmentUrl: url,
  });
  if (!draft.ok) return fail("gmail_failed", draft.error);

  const updated = await repo.updateSheet(sheet.id, ["proofed"], {
    status: "approved",
    email_draft: input.emailBody,
    approved_by: actorId,
    approved_at: new Date().toISOString(),
    gmail_draft_id: draft.draftId,
  });
  if (!updated) return fail("changed");

  await repo.logSheetEvent(sheet.id, "supplier_sheet.draft_created", { gmail_draft_id: draft.draftId });
  return { ok: true, data: updated };
}

// [4] Mark as sent. The caller then moves the bulk order to "placed".
export async function markSheetSent(bulkOrderId: string): Promise<SheetResult<SheetRecord>> {
  const sheet = await repo.getSheet(bulkOrderId);
  if (!sheet) return fail("no_sheet");
  if (sheet.status !== "approved") return fail("not_approved");

  const updated = await repo.updateSheet(sheet.id, ["approved"], { status: "sent", sent_at: new Date().toISOString() });
  if (!updated) return fail("changed");
  await repo.logSheetEvent(sheet.id, "supplier_sheet.sent", {});
  return { ok: true, data: updated };
}

// Signed link for staff to download the saved file (with review notes
// when the AI proof has run).
export async function getSheetDownloadUrl(bulkOrderId: string): Promise<SheetResult<string>> {
  const bulk = await repo.getBulkOrderSummary(bulkOrderId);
  if (!bulk) return fail("bulk_order_not_found");
  const sheet = await repo.getSheet(bulkOrderId);
  if (!sheet) return fail("no_sheet");

  const hasReview = sheet.aiFindings !== null;
  const path = hasReview ? reviewFilePath(bulk.id, bulk.reference) : sheet.snapshotPath;
  const name = bulk.reference + (hasReview ? "-supplier-order-with-notes.xlsx" : "-supplier-order.xlsx");
  const url = await repo.createSheetSignedUrl(path, SIGNED_URL_SECONDS, name);
  return url ? { ok: true, data: url } : fail("storage_failed");
}
