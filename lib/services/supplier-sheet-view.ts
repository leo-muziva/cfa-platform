import type { SheetRecord } from "@/lib/repositories/supplier-sheet-repository";
import type { SupplierLine } from "./bulk-order-export";

// What the bulk-orders page shows for a sheet. Plain product data only.

export interface SheetDiffRowView {
  label: string;
  change: string;
}

export interface SheetFindingRowView {
  id: string;
  severity: "high" | "medium" | "low";
  source: "rule" | "ai";
  message: string;
  suggestion: string | null;
}

export interface SheetView {
  status: SheetRecord["status"];
  generatedAt: string;
  rowCount: number;
  itemCount: number;
  paidOrderCount: number;
  checkDescription: string | null;
  checkMatches: boolean | null;
  diffRows: SheetDiffRowView[];
  aiSummary: string | null;
  findings: SheetFindingRowView[];
  emailDraft: string | null;
  modelUsed: string | null;
  approvedAt: string | null;
  sentAt: string | null;
  // paid orders changed after the sheet was built, so the proof no longer applies
  stale: boolean;
}

function label(line: Pick<SupplierLine, "itemCode" | "size" | "hand">): string {
  return [line.itemCode, line.size, line.hand].filter((part) => part !== "").join(" ");
}

const MAX_DIFF_ROWS = 20;

export function toSheetView(sheet: SheetRecord, stale = false): SheetView {
  const diff = sheet.lastCheck?.diff;
  const diffRows: SheetDiffRowView[] = diff
    ? [
        ...diff.added.map((l) => ({ label: label(l), change: "added, qty " + l.quantity })),
        ...diff.removed.map((l) => ({ label: label(l), change: "removed (no longer in paid orders)" })),
        ...diff.changed.map((c) => ({ label: label(c), change: "qty " + c.sheetQuantity + " to " + c.dbQuantity })),
      ].slice(0, MAX_DIFF_ROWS)
    : [];

  return {
    status: sheet.status,
    generatedAt: sheet.generatedAt,
    rowCount: sheet.lines.length,
    itemCount: sheet.lines.reduce((sum, l) => sum + l.quantity, 0),
    paidOrderCount: sheet.paidOrderCount,
    checkDescription: sheet.lastCheck?.description ?? null,
    checkMatches: sheet.lastCheck?.matches ?? null,
    diffRows,
    aiSummary: sheet.aiSummary,
    findings: (sheet.aiFindings ?? []).map((f) => ({
      id: f.id,
      severity: f.severity,
      source: f.source,
      message: f.message,
      suggestion: f.suggestion,
    })),
    emailDraft: sheet.emailDraft,
    modelUsed: sheet.modelUsed,
    approvedAt: sheet.approvedAt,
    sentAt: sheet.sentAt,
    stale,
  };
}
