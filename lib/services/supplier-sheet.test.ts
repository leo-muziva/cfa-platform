import { describe, expect, it } from "vitest";
import type { SupplierLine } from "./bulk-order-export";
import {
  compareSupplierLines,
  describeSheetDiff,
  lineKey,
  parseSizes,
  runSupplierRules,
  sortFindings,
  supplierLinesHash,
  type CatalogueEntry,
} from "./supplier-sheet";

function line(overrides: Partial<SupplierLine> = {}): SupplierLine {
  const base: SupplierLine = {
    itemCode: "EF124",
    name: "Sabre Glove",
    size: "M",
    hand: "RH",
    quantity: 2,
    unitPriceCents: 45000,
    lineTotalCents: 90000,
    category: "Gloves",
  };
  const merged = { ...base, ...overrides };
  return { ...merged, lineTotalCents: overrides.lineTotalCents ?? merged.unitPriceCents * merged.quantity };
}

function catalogue(entries: Partial<CatalogueEntry>[]): Map<string, CatalogueEntry> {
  return new Map(
    entries.map(function (entry) {
      const full: CatalogueEntry = {
        itemCode: "EF124",
        sizes: ["S", "M", "L"],
        needsHandedness: true,
        priceCents: 45000,
        isActive: true,
        ...entry,
      };
      return [full.itemCode, full];
    })
  );
}

describe("lineKey and supplierLinesHash", () => {
  it("keys a line on code, size, hand and price", () => {
    expect(lineKey(line())).toBe("EF124|M|RH|45000");
  });

  it("gives the same hash whatever order the lines are in", () => {
    const a = [line(), line({ itemCode: "EF105", size: "", hand: "" })];
    expect(supplierLinesHash(a)).toBe(supplierLinesHash([...a].reverse()));
  });

  it("changes the hash when a quantity changes", () => {
    expect(supplierLinesHash([line()])).not.toBe(supplierLinesHash([line({ quantity: 3 })]));
  });
});

describe("compareSupplierLines", () => {
  it("matches when the sheet and the database agree", () => {
    const diff = compareSupplierLines([line()], [line()]);
    expect(diff.matches).toBe(true);
    expect(describeSheetDiff(diff)).toBe("The spreadsheet matches the database.");
  });

  it("finds rows from late orders that are missing from the sheet", () => {
    const late = line({ itemCode: "EF105", name: "Mask", size: "L", hand: "" });
    const diff = compareSupplierLines([line(), late], [line()]);
    expect(diff.matches).toBe(false);
    expect(diff.added).toEqual([late]);
    expect(diff.removed).toEqual([]);
  });

  it("finds rows that should no longer be there, such as a refunded order", () => {
    const refunded = line({ itemCode: "EF105", size: "L", hand: "" });
    const diff = compareSupplierLines([line()], [line(), refunded]);
    expect(diff.removed).toEqual([refunded]);
  });

  it("reports quantity changes on the same line", () => {
    const diff = compareSupplierLines([line({ quantity: 5 })], [line({ quantity: 2 })]);
    expect(diff.changed).toEqual([
      { key: "EF124|M|RH|45000", itemCode: "EF124", size: "M", hand: "RH", sheetQuantity: 2, dbQuantity: 5 },
    ]);
    expect(describeSheetDiff(diff)).toBe("1 quantity changed.");
  });

  it("treats a price change as one row out and one row in", () => {
    const diff = compareSupplierLines([line({ unitPriceCents: 50000 })], [line()]);
    expect(diff.added).toHaveLength(1);
    expect(diff.removed).toHaveLength(1);
    expect(describeSheetDiff(diff)).toBe("1 row added, 1 row removed.");
  });
});

describe("parseSizes", () => {
  it("splits the catalogue's comma list and treats blank as no sizes", () => {
    expect(parseSizes(" S, M ,L ")).toEqual(["S", "M", "L"]);
    expect(parseSizes("")).toBeNull();
    expect(parseSizes(null)).toBeNull();
  });
});

describe("runSupplierRules", () => {
  const base = { pastAverageQuantity: new Map<string, number>(), pendingRefundOrders: 0 };

  it("finds nothing on a clean order", () => {
    expect(runSupplierRules({ ...base, lines: [line()], catalogue: catalogue([{}]) })).toEqual([]);
  });

  it("flags a size the product does not come in", () => {
    const findings = runSupplierRules({ ...base, lines: [line({ size: "XXL" })], catalogue: catalogue([{}]) });
    expect(findings.map((f) => f.ruleId)).toEqual(["size_not_offered"]);
    expect(findings[0].lineKey).toBe("EF124|XXL|RH|45000");
  });

  it("says plainly when no size was chosen", () => {
    const findings = runSupplierRules({ ...base, lines: [line({ size: "" })], catalogue: catalogue([{}]) });
    expect(findings[0].message).toBe("EF124 RH: no size chosen. It comes in S, M, L.");
  });

  it("flags a glove with no hand chosen", () => {
    const findings = runSupplierRules({ ...base, lines: [line({ hand: "" })], catalogue: catalogue([{}]) });
    expect(findings.map((f) => f.ruleId)).toEqual(["hand_missing"]);
  });

  it("flags placeholder codes, unknown and inactive products, and catalogue price changes", () => {
    const findings = runSupplierRules({
      ...base,
      lines: [
        line({ itemCode: "EFX01", size: "", hand: "" }),
        line({ itemCode: "EF999", size: "", hand: "" }),
        line({ itemCode: "EF105", size: "", hand: "" }),
        line({ itemCode: "EF200", size: "", hand: "", unitPriceCents: 40000 }),
      ],
      catalogue: catalogue([
        { itemCode: "EFX01", sizes: null, needsHandedness: false },
        { itemCode: "EF105", sizes: null, needsHandedness: false, isActive: false },
        { itemCode: "EF200", sizes: null, needsHandedness: false, priceCents: 45000 },
      ]),
    });
    expect(findings.map((f) => f.ruleId).sort()).toEqual(
      ["inactive_product", "placeholder_code", "price_changed", "unknown_product"].sort()
    );
  });

  it("flags quantities far above what CFA usually orders", () => {
    const findings = runSupplierRules({
      ...base,
      pastAverageQuantity: new Map([["EF124", 3]]),
      lines: [line({ quantity: 30 })],
      catalogue: catalogue([{}]),
    });
    expect(findings.map((f) => f.ruleId)).toEqual(["quantity_outlier"]);
  });

  it("adds up sizes of the same item before comparing with past orders", () => {
    const findings = runSupplierRules({
      ...base,
      pastAverageQuantity: new Map([["EF124", 3]]),
      lines: [line({ size: "S", quantity: 6 }), line({ size: "M", quantity: 6 }), line({ size: "L", quantity: 6 })],
      catalogue: catalogue([{}]),
    });
    expect(findings.map((f) => f.ruleId)).toEqual(["quantity_outlier"]);
    expect(findings[0].message).toContain("18 ordered in total");
  });

  it("flags orders with refunds still open", () => {
    const findings = runSupplierRules({ ...base, pendingRefundOrders: 2, lines: [line()], catalogue: catalogue([{}]) });
    expect(findings).toEqual([
      expect.objectContaining({ ruleId: "pending_refunds", severity: "high", lineKey: null }),
    ]);
  });

  it("gives every finding a stable unique id", () => {
    const findings = runSupplierRules({
      ...base,
      lines: [line({ size: "XXL" }), line({ size: "XXS" })],
      catalogue: catalogue([{}]),
    });
    expect(new Set(findings.map((f) => f.id)).size).toBe(2);
  });
});

describe("sortFindings", () => {
  it("puts the most serious first", () => {
    const sorted = sortFindings([
      { severity: "low" as const, n: 1 },
      { severity: "high" as const, n: 2 },
      { severity: "medium" as const, n: 3 },
    ]);
    expect(sorted.map((f) => f.n)).toEqual([2, 3, 1]);
  });
});
