import { describe, expect, it } from "vitest";
import {
  buildDistributionCsv,
  buildSupplierCsv,
  csvCell,
  groupSupplierLines,
  type ExportItem,
  type ExportOrder,
} from "./bulk-order-export";

function item(overrides: Partial<ExportItem> = {}): ExportItem {
  return {
    itemCode: "EF124",
    name: "Sabre Glove",
    size: "M",
    handedness: "right",
    quantity: 1,
    unitPrice: 450,
    ...overrides,
  };
}

function order(items: ExportItem[], status = "paid", name = "Thandi Mokoena"): ExportOrder {
  return {
    status,
    customer: { fullName: name, email: "thandi@example.test", phone: "0821234567" },
    items,
  };
}

describe("csvCell", () => {
  it("leaves plain values alone and quotes commas, quotes and line breaks", () => {
    expect(csvCell("EF105")).toBe("EF105");
    expect(csvCell(3)).toBe("3");
    expect(csvCell(null)).toBe("");
    expect(csvCell("Mask, sabre")).toBe('"Mask, sabre"');
    expect(csvCell('12" blade')).toBe('"12"" blade"');
    expect(csvCell("line\nbreak")).toBe('"line\nbreak"');
  });
});

describe("groupSupplierLines", () => {
  it("adds quantities for the same code, size and hand across customers", () => {
    const lines = groupSupplierLines([
      order([item({ quantity: 2 })]),
      order([item({ quantity: 3 })], "paid", "Sipho Dlamini"),
    ]);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({ itemCode: "EF124", size: "M", hand: "RH", quantity: 5, lineTotalCents: 225000 });
  });

  it("keeps left and right hand, and different sizes, as separate lines", () => {
    const lines = groupSupplierLines([
      order([
        item({ handedness: "right" }),
        item({ handedness: "left" }),
        item({ size: "L" }),
        item({ itemCode: "EF105", name: "Mask", size: null, handedness: null }),
      ]),
    ]);
    expect(lines.map((l) => [l.itemCode, l.size, l.hand])).toEqual([
      ["EF105", "", ""],
      ["EF124", "L", "RH"],
      ["EF124", "M", "LH"],
      ["EF124", "M", "RH"],
    ]);
  });

  it("excludes orders that are not paid, including legacy submitted orders", () => {
    const lines = groupSupplierLines([
      order([item({ quantity: 1 })]),
      order([item({ quantity: 7 })], "submitted"),
      order([item({ quantity: 9 })], "pending_payment"),
    ]);
    expect(lines).toHaveLength(1);
    expect(lines[0].quantity).toBe(1);
  });
});

describe("buildSupplierCsv", () => {
  it("writes a Hand column and a cent-accurate total", () => {
    const csv = buildSupplierCsv([
      order([item({ quantity: 3, unitPrice: 0.1 }), item({ handedness: "left", unitPrice: 0.2 })]),
    ]);
    expect(csv.split("\n")).toEqual([
      "Item Code,Description,Size,Hand,Quantity,Unit Price,Line Total",
      "EF124,Sabre Glove,M,LH,1,0.20,0.20",
      "EF124,Sabre Glove,M,RH,3,0.10,0.30",
      ",,,,,,",
      ",,,,,Total,0.50",
    ]);
  });

  it("escapes product names that contain commas", () => {
    const csv = buildSupplierCsv([order([item({ name: "Glove, sabre" })])]);
    expect(csv).toContain('EF124,"Glove, sabre",M,RH,1,450.00,450.00');
  });

  it("produces only the header and a zero total when nothing is paid", () => {
    const csv = buildSupplierCsv([order([item()], "submitted")]);
    expect(csv.split("\n")).toEqual([
      "Item Code,Description,Size,Hand,Quantity,Unit Price,Line Total",
      ",,,,,,",
      ",,,,,Total,0.00",
    ]);
  });
});

describe("buildDistributionCsv", () => {
  it("lists each paid customer line with its hand", () => {
    const csv = buildDistributionCsv([
      order([item({ quantity: 2 }), item({ itemCode: "EF105", name: "Mask", size: null, handedness: null })]),
      order([item({ handedness: "left" })], "submitted", "Legacy Customer"),
    ]);
    expect(csv.split("\n")).toEqual([
      "Customer,Email,Phone,Item Code,Description,Size,Hand,Quantity,Unit Price,Line Total",
      "Thandi Mokoena,thandi@example.test,0821234567,EF124,Sabre Glove,M,RH,2,450.00,900.00",
      "Thandi Mokoena,thandi@example.test,0821234567,EF105,Mask,,,1,450.00,450.00",
    ]);
  });

  it("handles a missing customer profile", () => {
    const csv = buildDistributionCsv([{ status: "paid", customer: null, items: [item()] }]);
    expect(csv.split("\n")[1]).toBe(",,,EF124,Sabre Glove,M,RH,1,450.00,450.00");
  });
});
