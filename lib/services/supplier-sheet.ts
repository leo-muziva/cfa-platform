// Pure rules for the supplier order sheet: the line fingerprint, the
// database-versus-sheet comparison and the plain-code checks the AI proof
// starts from. No database or AI calls, so all of it is unit tested.

import { createHash } from "node:crypto";
import type { SupplierLine } from "./bulk-order-export";

export type Severity = "high" | "medium" | "low";

// Two lines are the same supplier line when code, size, hand and price
// match. A price change therefore shows as one row out and one row in.
export function lineKey(line: Pick<SupplierLine, "itemCode" | "size" | "hand" | "unitPriceCents">): string {
  return [line.itemCode, line.size, line.hand, line.unitPriceCents].join("|");
}

// Fingerprint of what the supplier would receive. Order of rows does not
// matter; quantities do.
export function supplierLinesHash(lines: SupplierLine[]): string {
  const canonical = lines
    .map(function (l) {
      return lineKey(l) + "=" + l.quantity;
    })
    .sort()
    .join("\n");
  return createHash("sha256").update(canonical).digest("hex");
}

// A line whose quantity differs between the saved file and the database.
export interface QuantityChange {
  key: string;
  itemCode: string;
  size: string;
  hand: string;
  sheetQuantity: number;
  dbQuantity: number;
}

// Result of comparing the database lines with the saved file's lines.
export interface SheetDiff {
  matches: boolean;
  added: SupplierLine[];
  removed: SupplierLine[];
  changed: QuantityChange[];
}

/**
 * Compares what the database says should be ordered with what is in the
 * saved file: lines only in the database are "added", lines only in the
 * file are "removed", and matching lines with a different quantity are
 * "changed".
 */
export function compareSupplierLines(dbLines: SupplierLine[], sheetLines: SupplierLine[]): SheetDiff {
  const sheetByKey = new Map(sheetLines.map((l) => [lineKey(l), l]));
  const dbByKey = new Map(dbLines.map((l) => [lineKey(l), l]));

  const added: SupplierLine[] = [];
  const changed: QuantityChange[] = [];
  for (const [key, dbLine] of dbByKey) {
    const sheetLine = sheetByKey.get(key);
    if (!sheetLine) {
      added.push(dbLine);
    } else if (sheetLine.quantity !== dbLine.quantity) {
      changed.push({
        key,
        itemCode: dbLine.itemCode,
        size: dbLine.size,
        hand: dbLine.hand,
        sheetQuantity: sheetLine.quantity,
        dbQuantity: dbLine.quantity,
      });
    }
  }

  const removed = sheetLines.filter((l) => !dbByKey.has(lineKey(l)));

  return {
    matches: added.length === 0 && removed.length === 0 && changed.length === 0,
    added,
    removed,
    changed,
  };
}

function plural(count: number, one: string, many: string): string {
  return count + " " + (count === 1 ? one : many);
}

// One sentence for staff, e.g. "2 rows added, 1 quantity changed."
export function describeSheetDiff(diff: SheetDiff): string {
  if (diff.matches) return "The spreadsheet matches the database.";
  const parts: string[] = [];
  if (diff.added.length > 0) parts.push(plural(diff.added.length, "row added", "rows added"));
  if (diff.removed.length > 0) parts.push(plural(diff.removed.length, "row removed", "rows removed"));
  if (diff.changed.length > 0) parts.push(plural(diff.changed.length, "quantity changed", "quantities changed"));
  return parts.join(", ") + ".";
}

// The catalogue facts the rules check each line against.
export interface CatalogueEntry {
  itemCode: string;
  sizes: string[] | null;
  needsHandedness: boolean;
  priceCents: number;
  isActive: boolean;
}

// One id per basic check, so the AI can refer to a rule finding by id.
export type RuleId =
  | "size_not_offered"
  | "hand_missing"
  | "unknown_product"
  | "inactive_product"
  | "placeholder_code"
  | "price_changed"
  | "quantity_outlier"
  | "pending_refunds";

// A problem found by a basic check. `lineKey` is null for whole-order findings.
export interface RuleFinding {
  id: string;
  ruleId: RuleId;
  severity: Severity;
  itemCode: string | null;
  lineKey: string | null;
  message: string;
}

export interface RuleInput {
  lines: SupplierLine[];
  catalogue: Map<string, CatalogueEntry>;
  // Average quantity per item code across earlier bulk orders.
  pastAverageQuantity: Map<string, number>;
  // Paid orders in this bulk order that still have a refund in progress.
  pendingRefundOrders: number;
}

// The catalogue stores sizes as "S, M, L"; blank means one size.
export function parseSizes(text: string | null): string[] | null {
  const sizes = (text ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  return sizes.length > 0 ? sizes : null;
}

// A quantity counts as unusual when it is well above both the usual
// average and a small absolute margin, so a normal 2 vs 1 is not flagged.
function isQuantityOutlier(quantity: number, average: number | undefined): boolean {
  if (average === undefined || average <= 0) return false;
  return quantity > Math.max(average * 3, average + 5);
}

function rands(cents: number): string {
  return "R" + (cents / 100).toFixed(2);
}

/**
 * The basic checks that always run, with or without AI: placeholder or
 * unknown codes, inactive products, sizes and hands the product does not
 * offer, changed prices, unusually large quantities and paid orders with a
 * refund in progress. Returns findings sorted most severe first.
 */
export function runSupplierRules(input: RuleInput): RuleFinding[] {
  const findings: RuleFinding[] = [];

  function add(ruleId: RuleId, severity: Severity, line: SupplierLine | null, message: string) {
    const key = line ? lineKey(line) : null;
    findings.push({
      id: "rule:" + ruleId + ":" + (key ?? "batch"),
      ruleId,
      severity,
      itemCode: line ? line.itemCode : null,
      lineKey: key,
      message,
    });
  }

  for (const line of input.lines) {
    const label = line.itemCode + (line.size ? " size " + line.size : "") + (line.hand ? " " + line.hand : "");
    const product = input.catalogue.get(line.itemCode);

    if (line.itemCode.toUpperCase().startsWith("EFX")) {
      add("placeholder_code", "high", line, line.itemCode + " is a placeholder code. Confirm the real supplier code before sending.");
    }

    if (!product) {
      add("unknown_product", "high", line, line.itemCode + " is not in the catalogue.");
      continue;
    }

    if (!product.isActive) {
      add("inactive_product", "medium", line, line.itemCode + " is no longer active in the shop.");
    }

    if (product.sizes && !product.sizes.includes(line.size)) {
      add(
        "size_not_offered",
        "high",
        line,
        line.size === ""
          ? label + ": no size chosen. It comes in " + product.sizes.join(", ") + "."
          : label + ": this product does not come in size \"" + line.size + "\"."
      );
    }

    if (product.needsHandedness && line.hand === "") {
      add("hand_missing", "high", line, label + ": no left or right hand chosen.");
    }

    if (product.priceCents !== line.unitPriceCents) {
      add(
        "price_changed",
        "low",
        line,
        label + ": ordered at " + rands(line.unitPriceCents) + " but the catalogue price is now " + rands(product.priceCents) + "."
      );
    }

  }

  // Past bulk orders are totalled per item code, so compare the same way:
  // a glove ordered in three sizes counts as one item.
  const perCode = new Map<string, { quantity: number; first: SupplierLine }>();
  for (const line of input.lines) {
    const current = perCode.get(line.itemCode);
    perCode.set(line.itemCode, { quantity: (current?.quantity ?? 0) + line.quantity, first: current?.first ?? line });
  }
  for (const [itemCode, { quantity, first }] of perCode) {
    const average = input.pastAverageQuantity.get(itemCode);
    if (isQuantityOutlier(quantity, average)) {
      add(
        "quantity_outlier",
        "medium",
        first,
        itemCode + ": " + quantity + " ordered in total, but CFA usually orders about " + Math.round(average ?? 0) + "."
      );
    }
  }

  if (input.pendingRefundOrders > 0) {
    add(
      "pending_refunds",
      "high",
      null,
      plural(input.pendingRefundOrders, "paid order has", "paid orders have") + " a refund in progress. Check before ordering their items."
    );
  }

  return sortFindings(findings);
}

const SEVERITY_ORDER: Record<Severity, number> = { high: 0, medium: 1, low: 2 };

/** Sorts findings high, then medium, then low severity. */
export function sortFindings<T extends { severity: Severity }>(findings: T[]): T[] {
  return [...findings].sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
}
