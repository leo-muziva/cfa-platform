import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/repositories/supplier-sheet-repository", () => ({
  getBulkOrderSummary: vi.fn(),
  getBulkOrderLines: vi.fn(),
  getSheet: vi.fn(),
  insertSheet: vi.fn(),
  updateSheet: vi.fn(),
  logSheetEvent: vi.fn(),
  uploadSheetFile: vi.fn(),
  downloadSheetFile: vi.fn(),
  createSheetSignedUrl: vi.fn(),
  getCatalogueRows: vi.fn(),
  getPastBulkOrderQuantities: vi.fn(),
  countOrdersWithOpenRefunds: vi.fn(),
  getLastAiRunStart: vi.fn(),
  startAiRun: vi.fn(),
  finishAiRun: vi.fn(),
}));
// No AI keys in tests: the review falls back to the basic checks.
vi.mock("@/lib/ai/models", () => ({ getReviewModels: () => [] }));
const createDraft = vi.fn();
vi.mock("@/lib/providers/composio-gmail", () => ({
  getGmailDraftProvider: (env: Record<string, string | undefined>) =>
    env.COMPOSIO_API_KEY ? { createDraft } : null,
}));

import * as repo from "@/lib/repositories/supplier-sheet-repository";
import type { SheetRecord } from "@/lib/repositories/supplier-sheet-repository";
import type { ExportOrder } from "./bulk-order-export";
import { groupSupplierLines } from "./bulk-order-export";
import { buildSupplierWorkbook } from "./supplier-sheet-workbook";
import {
  approveAndCreateDraft,
  approveUpdatedSheet,
  generateSheet,
  markSheetSent,
  runAiProof,
} from "./supplier-sheet-service";

const mocked = vi.mocked(repo);
const BULK = { id: "6f1c0a4e-1111-4111-8111-111111111111", reference: "BO-TEST", status: "collecting" };
const ADMIN = "11111111-1111-4111-8111-111111111111";

function orders(qty: number): ExportOrder[] {
  return [{
    status: "paid",
    customer: null,
    items: [{ itemCode: "EF124", name: "Sabre Glove", category: "Gloves", size: "M", handedness: "right", quantity: qty, unitPrice: 450 }],
  }];
}

function sheet(overrides: Partial<SheetRecord> = {}): SheetRecord {
  return {
    id: "sheet-1", bulkOrderId: BULK.id, status: "generated", lines: groupSupplierLines(orders(2)),
    linesHash: "h", paidOrderCount: 1, snapshotPath: BULK.id + "/BO-TEST-supplier-order.xlsx",
    generatedAt: "2026-10-05T10:00:00Z", lastCheck: null, sheetApprovedAt: null, aiSummary: null,
    aiFindings: null, emailDraft: null, modelUsed: null, proofedAt: null, approvedAt: null,
    gmailDraftId: null, sentAt: null, ...overrides,
  };
}

async function savedFile(qty: number) {
  return buildSupplierWorkbook(groupSupplierLines(orders(qty)), { reference: "BO-TEST", generatedAt: new Date(), status: "DRAFT" });
}

beforeEach(async () => {
  vi.clearAllMocks();
  mocked.getBulkOrderSummary.mockResolvedValue(BULK);
  mocked.getBulkOrderLines.mockResolvedValue({ orders: orders(2), paidOrderIds: ["order-1"] });
  mocked.uploadSheetFile.mockResolvedValue(true);
  mocked.downloadSheetFile.mockResolvedValue(await savedFile(2));
  mocked.updateSheet.mockImplementation(async (_id, _expected, values) => sheet({ status: values.status ?? "generated" }));
  mocked.insertSheet.mockResolvedValue(sheet());
  mocked.getCatalogueRows.mockResolvedValue([
    { item_code: "EF124", sizes: "S, M, L", needs_handedness: true, price: 450, is_active: true },
  ]);
  mocked.getPastBulkOrderQuantities.mockResolvedValue([]);
  mocked.countOrdersWithOpenRefunds.mockResolvedValue(0);
  mocked.getLastAiRunStart.mockResolvedValue(null);
  mocked.startAiRun.mockResolvedValue({ ok: true, runId: "run-1" });
  mocked.createSheetSignedUrl.mockResolvedValue("https://storage.example/signed");
});

describe("generateSheet", () => {
  it("saves a fixed file and records the lines", async () => {
    mocked.getSheet.mockResolvedValue(null);
    const result = await generateSheet(BULK.id, ADMIN);
    expect(result.ok).toBe(true);
    expect(mocked.uploadSheetFile).toHaveBeenCalledWith(BULK.id + "/BO-TEST-supplier-order.xlsx", expect.any(Buffer));
    expect(mocked.insertSheet.mock.calls[0][1]).toMatchObject({ status: "generated", paid_order_count: 1 });
  });

  it("refuses when there are no paid orders yet", async () => {
    mocked.getSheet.mockResolvedValue(null);
    mocked.getBulkOrderLines.mockResolvedValue({ orders: [], paidOrderIds: [] });
    expect(await generateSheet(BULK.id, ADMIN)).toEqual({ ok: false, code: "no_paid_orders", message: undefined });
  });

  it("will not rebuild a sheet that was already sent", async () => {
    mocked.getSheet.mockResolvedValue(sheet({ status: "sent" }));
    expect(await generateSheet(BULK.id, ADMIN)).toMatchObject({ ok: false, code: "already_sent" });
  });
});

describe("runAiProof", () => {
  it("cannot run before a spreadsheet has been generated", async () => {
    mocked.getSheet.mockResolvedValue(null);
    expect(await runAiProof(BULK.id, ADMIN)).toMatchObject({ ok: false, code: "no_sheet" });
    expect(mocked.startAiRun).not.toHaveBeenCalled();
  });

  it("waits for staff when an updated sheet is not yet approved", async () => {
    mocked.getSheet.mockResolvedValue(sheet({ status: "needs_approval" }));
    expect(await runAiProof(BULK.id, ADMIN)).toMatchObject({ ok: false, code: "needs_approval" });
    expect(mocked.startAiRun).not.toHaveBeenCalled();
  });

  it("rebuilds the sheet and stops when a late order is missing from the file", async () => {
    mocked.getSheet.mockResolvedValue(sheet());
    mocked.getBulkOrderLines.mockResolvedValue({ orders: orders(3), paidOrderIds: ["order-1", "order-2"] });
    const result = await runAiProof(BULK.id, ADMIN);
    expect(result.ok && result.data.kind).toBe("needs_approval");
    expect(mocked.updateSheet.mock.calls[0][2]).toMatchObject({ status: "needs_approval", paid_order_count: 2 });
    expect(mocked.startAiRun).not.toHaveBeenCalled();
  });

  it("runs the review when the file matches the database and logs the run", async () => {
    mocked.getSheet.mockResolvedValue(sheet());
    const result = await runAiProof(BULK.id, ADMIN);
    expect(result.ok && result.data.kind).toBe("proofed");
    expect(mocked.finishAiRun).toHaveBeenCalledWith("run-1", expect.objectContaining({ status: "rules_only" }), expect.any(Array));
    const proofed = mocked.updateSheet.mock.calls.find((c) => c[2].status === "proofed");
    expect(proofed?.[2]).toMatchObject({ model_used: "basic checks only" });
  });

  it("reuses the running proof when a second click comes in", async () => {
    mocked.getSheet.mockResolvedValue(sheet());
    mocked.startAiRun.mockResolvedValue({ ok: false, reason: "already_running" });
    expect(await runAiProof(BULK.id, ADMIN)).toMatchObject({ ok: false, code: "ai_running" });
  });

  it("asks staff to wait between proofs", async () => {
    mocked.getSheet.mockResolvedValue(sheet());
    mocked.getLastAiRunStart.mockResolvedValue(new Date());
    expect(await runAiProof(BULK.id, ADMIN)).toMatchObject({ ok: false, code: "too_soon" });
  });
});

describe("approveUpdatedSheet", () => {
  it("only applies to a sheet waiting for approval", async () => {
    mocked.getSheet.mockResolvedValue(sheet({ status: "proofed" }));
    expect(await approveUpdatedSheet(BULK.id, ADMIN)).toMatchObject({ ok: false, code: "not_needs_approval" });
  });

  it("records the approval and then starts the AI review", async () => {
    mocked.getSheet
      .mockResolvedValueOnce(sheet({ status: "needs_approval" }))
      .mockResolvedValue(sheet({ status: "generated" }));
    const result = await approveUpdatedSheet(BULK.id, ADMIN);
    expect(mocked.updateSheet.mock.calls[0][2]).toMatchObject({ status: "generated", sheet_approved_by: ADMIN });
    expect(result.ok && result.data.kind).toBe("proofed");
  });
});

describe("approveAndCreateDraft", () => {
  const env = { SUPPLIER_EMAIL: "orders@supplier.example", COMPOSIO_API_KEY: "k" };

  it("needs a finished AI proof first", async () => {
    mocked.getSheet.mockResolvedValue(sheet({ status: "generated" }));
    expect(await approveAndCreateDraft(BULK.id, ADMIN, { emailBody: "Hi" }, env)).toMatchObject({ ok: false, code: "not_proofed" });
  });

  it("explains when Gmail or the supplier address is not set up", async () => {
    mocked.getSheet.mockResolvedValue(sheet({ status: "proofed" }));
    expect(await approveAndCreateDraft(BULK.id, ADMIN, { emailBody: "Hi" }, { COMPOSIO_API_KEY: "k" })).toMatchObject({
      code: "supplier_email_missing",
    });
    expect(await approveAndCreateDraft(BULK.id, ADMIN, { emailBody: "Hi" }, { SUPPLIER_EMAIL: "a@b.co" })).toMatchObject({
      code: "gmail_not_connected",
    });
  });

  it("re-checks the database and refuses if an order arrived after the proof", async () => {
    mocked.getSheet.mockResolvedValue(sheet({ status: "proofed" }));
    mocked.getBulkOrderLines.mockResolvedValue({ orders: orders(5), paidOrderIds: ["order-1", "order-2"] });
    expect(await approveAndCreateDraft(BULK.id, ADMIN, { emailBody: "Hi" }, env)).toMatchObject({ code: "needs_approval" });
    expect(createDraft).not.toHaveBeenCalled();
  });

  it("creates the draft with the configured recipient and the saved file", async () => {
    mocked.getSheet.mockResolvedValue(sheet({ status: "proofed" }));
    createDraft.mockResolvedValue({ ok: true, draftId: "r-123" });
    const result = await approveAndCreateDraft(BULK.id, ADMIN, { emailBody: "Please process." }, env);
    expect(result.ok).toBe(true);
    expect(createDraft).toHaveBeenCalledWith({
      recipient: "orders@supplier.example",
      subject: "Cape Fencing Academy order BO-TEST",
      body: "Please process.",
      attachmentUrl: "https://storage.example/signed",
    });
    expect(mocked.updateSheet.mock.calls.at(-1)?.[2]).toMatchObject({ status: "approved", gmail_draft_id: "r-123" });
  });
});

describe("markSheetSent", () => {
  it("only marks an approved sheet as sent", async () => {
    mocked.getSheet.mockResolvedValue(sheet({ status: "proofed" }));
    expect(await markSheetSent(BULK.id)).toMatchObject({ ok: false, code: "not_approved" });
    mocked.getSheet.mockResolvedValue(sheet({ status: "approved" }));
    expect(await markSheetSent(BULK.id)).toMatchObject({ ok: true });
  });
});
