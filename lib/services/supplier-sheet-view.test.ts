import { describe, expect, it } from "vitest";
import type { SheetRecord } from "@/lib/repositories/supplier-sheet-repository";
import type { SupplierLine } from "./bulk-order-export";
import { compareSupplierLines } from "./supplier-sheet";
import { toSheetView } from "./supplier-sheet-view";

const glove: SupplierLine = {
  itemCode: "EF124", name: "Sabre Glove", category: "Gloves", size: "M", hand: "LH",
  quantity: 3, unitPriceCents: 45000, lineTotalCents: 135000,
};
const mask: SupplierLine = { ...glove, itemCode: "EF105", name: "Mask", size: "L", hand: "", quantity: 1 };

function record(overrides: Partial<SheetRecord>): SheetRecord {
  return {
    id: "s", bulkOrderId: "b", status: "needs_approval", lines: [glove, mask], linesHash: "h", paidOrderCount: 2,
    snapshotPath: "p", generatedAt: "2026-10-05T10:00:00Z", lastCheck: null, sheetApprovedAt: null,
    aiSummary: null, aiFindings: null, emailDraft: null, modelUsed: null, proofedAt: null, approvedAt: null,
    gmailDraftId: null, sentAt: null, ...overrides,
  };
}

describe("toSheetView", () => {
  it("counts rows and items and lists what the check changed", () => {
    const diff = compareSupplierLines([{ ...glove, quantity: 3 }, mask], [{ ...glove, quantity: 1 }]);
    const view = toSheetView(record({ lastCheck: { checkedAt: "x", matches: false, description: "1 row added, 1 quantity changed.", diff } }));
    expect(view.rowCount).toBe(2);
    expect(view.itemCount).toBe(4);
    expect(view.diffRows).toEqual([
      { label: "EF105 L", change: "added, qty 1" },
      { label: "EF124 M LH", change: "qty 1 to 3" },
    ]);
  });

  it("shows no findings or diff before the AI proof", () => {
    const view = toSheetView(record({ status: "generated" }));
    expect(view.findings).toEqual([]);
    expect(view.diffRows).toEqual([]);
    expect(view.checkMatches).toBeNull();
  });
});
