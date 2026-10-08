import { describe, expect, it, vi } from "vitest";
import ExcelJS from "exceljs";

vi.mock("server-only", () => ({}));

import type { SupplierLine } from "./bulk-order-export";
import { compareSupplierLines } from "./supplier-sheet";
import { buildSupplierWorkbook, readSupplierWorkbook, readWorkbookGrid, SupplierWorkbookError } from "./supplier-sheet-workbook";

const lines: SupplierLine[] = [
  { itemCode: "EF124", name: "Sabre Glove", category: "Gloves", size: "M", hand: "RH", quantity: 3, unitPriceCents: 45050, lineTotalCents: 135150 },
  { itemCode: "EF124", name: "Sabre Glove", category: "Gloves", size: "M", hand: "LH", quantity: 1, unitPriceCents: 45050, lineTotalCents: 45050 },
  { itemCode: "EF02", name: "Sabre Electric Bronze sword S2000", category: "Weapons", size: "", hand: "", quantity: 2, unitPriceCents: 96800, lineTotalCents: 193600 },
];

const header = { reference: "BO-20261005", generatedAt: new Date("2026-10-05T10:00:00Z"), status: "DRAFT" as const };

describe("supplier workbook", () => {
  it("reads back exactly the lines it wrote", async () => {
    const buffer = await buildSupplierWorkbook(lines, header);
    const read = await readSupplierWorkbook(buffer);
    expect(compareSupplierLines(lines, read).matches).toBe(true);
    expect(read).toHaveLength(3);
  });

  it("writes the header, a total row and keeps RH and LH as separate rows", async () => {
    const buffer = await buildSupplierWorkbook(lines, header);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
    const sheet = workbook.getWorksheet("Supplier order")!;
    expect(sheet.getCell("B2").value).toBe("BO-20261005");
    expect(sheet.getCell("B4").value).toBe("DRAFT");
    const hands = [7, 8, 9].map((r) => sheet.getRow(r).getCell(5).value);
    expect(hands).toEqual(expect.arrayContaining(["RH", "LH"]));
    const lastRow = sheet.getRow(sheet.rowCount);
    expect(lastRow.getCell(5).value).toBe("Total");
    expect(lastRow.getCell(6).value).toBe(6);
    expect(lastRow.getCell(8).value).toBeCloseTo(3738);
  });

  it("adds a review notes sheet only when notes are given", async () => {
    const without = new ExcelJS.Workbook();
    await without.xlsx.load((await buildSupplierWorkbook(lines, header)) as unknown as ArrayBuffer);
    expect(without.getWorksheet("Review notes")).toBeUndefined();

    const withNotes = new ExcelJS.Workbook();
    await withNotes.xlsx.load(
      (await buildSupplierWorkbook(lines, header, [
        { severity: "high", itemCode: "EF124", message: "No hand chosen", suggestion: "Ask the member" },
      ])) as unknown as ArrayBuffer
    );
    expect(withNotes.getWorksheet("Review notes")?.getCell("C2").value).toBe("No hand chosen");
  });

  it("notices when someone edited a quantity in the saved file", async () => {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load((await buildSupplierWorkbook(lines, header)) as unknown as ArrayBuffer);
    workbook.getWorksheet("Supplier order")!.getRow(7).getCell(6).value = 99;
    const edited = Buffer.from((await workbook.xlsx.writeBuffer()) as ArrayBuffer);
    const diff = compareSupplierLines(lines, await readSupplierWorkbook(edited));
    expect(diff.matches).toBe(false);
  });

  it("rejects a file that is not a spreadsheet", async () => {
    await expect(readSupplierWorkbook(Buffer.from("not a spreadsheet"))).rejects.toBeInstanceOf(SupplierWorkbookError);
  });
});

describe("readWorkbookGrid", () => {
  it("returns every sheet as display text with rand amounts formatted", async () => {
    const buffer = await buildSupplierWorkbook(lines, header);
    const [sheet] = await readWorkbookGrid(buffer);
    expect(sheet.name).toBe("Supplier order");
    expect(sheet.rows[1]).toEqual(expect.arrayContaining(["BO-20261005"]));
    const glove = sheet.rows.find((row) => row[0] === "EF124" && row[4] === "RH")!;
    expect(glove).toEqual(expect.arrayContaining(["3", "R450.50", "R1 351.50"]));
    expect(sheet.rows.at(-1)).toEqual(expect.arrayContaining(["Total", "R3 738.00"]));
  });

  it("refuses a file that is not a workbook", async () => {
    await expect(readWorkbookGrid(Buffer.from("not a spreadsheet"))).rejects.toBeInstanceOf(SupplierWorkbookError);
  });
});
