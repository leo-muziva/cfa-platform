import "server-only";
import ExcelJS from "exceljs";
import type { SupplierLine } from "./bulk-order-export";
import type { Severity } from "./supplier-sheet";
import { formatRandsWithCents } from "@/lib/money";

// Builds and reads back the supplier order xlsx. The AI never writes to
// this file: every cell comes from paid orders in the database.

export interface WorkbookHeader {
  reference: string;
  generatedAt: Date;
  status: "DRAFT" | "APPROVED";
}

export interface WorkbookNote {
  severity: Severity;
  itemCode: string | null;
  message: string;
  suggestion?: string | null;
}

const SHEET_NAME = "Supplier order";
const NOTES_NAME = "Review notes";
const COLUMNS = ["Item Code", "Description", "Category", "Size", "Hand", "Qty", "Unit Price (ZAR)", "Line Total (ZAR)"];
const ZAR_FORMAT = '"R" #,##0.00';

const dateFormat = new Intl.DateTimeFormat("en-ZA", { day: "numeric", month: "long", year: "numeric" });

// Rows are grouped by category, then item code, size, hand and price.
// Lines with no category sort last.
function sortForSheet(lines: SupplierLine[]): SupplierLine[] {
  return [...lines].sort(function (a, b) {
    return (
      (a.category || "~").localeCompare(b.category || "~") ||
      a.itemCode.localeCompare(b.itemCode) ||
      a.size.localeCompare(b.size) ||
      a.hand.localeCompare(b.hand) ||
      a.unitPriceCents - b.unitPriceCents
    );
  });
}

/**
 * Builds the xlsx file. With `notes`, a second "Review notes" sheet is added
 * for staff; the supplier copy is built without notes.
 */
export async function buildSupplierWorkbook(
  lines: SupplierLine[],
  header: WorkbookHeader,
  notes: WorkbookNote[] | null = null
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Cape Fencing Academy";
  workbook.created = header.generatedAt;

  const sheet = workbook.addWorksheet(SHEET_NAME, {
    views: [{ state: "frozen", ySplit: 6 }],
  });
  sheet.columns = [
    { width: 12 }, { width: 42 }, { width: 16 }, { width: 8 },
    { width: 7 }, { width: 7 }, { width: 17 }, { width: 17 },
  ];

  sheet.getCell("A1").value = "Cape Fencing Academy - supplier order";
  sheet.getCell("A1").font = { bold: true, size: 14 };
  sheet.getCell("A2").value = "Bulk order";
  sheet.getCell("B2").value = header.reference;
  sheet.getCell("A3").value = "Date";
  sheet.getCell("B3").value = dateFormat.format(header.generatedAt);
  sheet.getCell("A4").value = "Status";
  sheet.getCell("B4").value = header.status;
  for (const cell of ["A2", "A3", "A4"]) sheet.getCell(cell).font = { bold: true };

  const headerRow = sheet.getRow(6);
  headerRow.values = COLUMNS;
  headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
  headerRow.eachCell(function (cell) {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF3B1F7A" } };
  });

  let totalCents = 0;
  let totalQty = 0;
  for (const line of sortForSheet(lines)) {
    const row = sheet.addRow([
      line.itemCode,
      line.name,
      line.category,
      line.size,
      line.hand,
      line.quantity,
      line.unitPriceCents / 100,
      line.lineTotalCents / 100,
    ]);
    row.getCell(7).numFmt = ZAR_FORMAT;
    row.getCell(8).numFmt = ZAR_FORMAT;
    totalCents += line.lineTotalCents;
    totalQty += line.quantity;
  }

  const lastDataRow = sheet.rowCount;
  sheet.autoFilter = { from: { row: 6, column: 1 }, to: { row: Math.max(6, lastDataRow), column: COLUMNS.length } };

  sheet.addRow([]);
  const totalRow = sheet.addRow(["", "", "", "", "Total", totalQty, "", totalCents / 100]);
  totalRow.font = { bold: true };
  totalRow.getCell(8).numFmt = ZAR_FORMAT;

  if (notes && notes.length > 0) {
    const notesSheet = workbook.addWorksheet(NOTES_NAME);
    notesSheet.columns = [{ width: 10 }, { width: 12 }, { width: 70 }, { width: 50 }];
    const notesHeader = notesSheet.addRow(["Severity", "Item Code", "Note", "Suggestion"]);
    notesHeader.font = { bold: true };
    for (const note of notes) {
      notesSheet.addRow([note.severity, note.itemCode ?? "", note.message, note.suggestion ?? ""]);
    }
  }

  const output = await workbook.xlsx.writeBuffer();
  return Buffer.from(output as ArrayBuffer);
}

// Reads a cell as text, including rich text and formula results.
function cellText(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "object" && "richText" in value) {
    return value.richText.map((part) => part.text).join("");
  }
  if (typeof value === "object" && "result" in value) {
    return String(value.result ?? "");
  }
  return String(value).trim();
}

// Reads a cell as a number; NaN when it is not one.
function cellNumber(value: ExcelJS.CellValue): number {
  const n = Number(cellText(value));
  return Number.isFinite(n) ? n : NaN;
}

/** A saved file could not be read; the message is safe to show staff. */
export class SupplierWorkbookError extends Error {}

// Reads the order rows back out of a saved file so the AI proof compares
// the real file, not just our record of what we wrote into it.
export async function readSupplierWorkbook(buffer: Buffer | ArrayBuffer): Promise<SupplierLine[]> {
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(buffer as ArrayBuffer);
  } catch {
    throw new SupplierWorkbookError("The saved spreadsheet could not be opened.");
  }

  const sheet = workbook.getWorksheet(SHEET_NAME);
  if (!sheet) throw new SupplierWorkbookError("The saved spreadsheet has no \"" + SHEET_NAME + "\" sheet.");

  let headerRowNumber = 0;
  sheet.eachRow(function (row, rowNumber) {
    if (headerRowNumber === 0 && cellText(row.getCell(1).value) === COLUMNS[0]) {
      headerRowNumber = rowNumber;
    }
  });
  if (headerRowNumber === 0) throw new SupplierWorkbookError("The saved spreadsheet has no header row.");

  const lines: SupplierLine[] = [];
  for (let r = headerRowNumber + 1; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r);
    const itemCode = cellText(row.getCell(1).value);
    if (itemCode === "") continue;

    const quantity = cellNumber(row.getCell(6).value);
    const unitPrice = cellNumber(row.getCell(7).value);
    const lineTotal = cellNumber(row.getCell(8).value);
    if (!Number.isInteger(quantity) || quantity <= 0 || Number.isNaN(unitPrice) || Number.isNaN(lineTotal)) {
      throw new SupplierWorkbookError("Row " + r + " of the saved spreadsheet has an unreadable quantity or price.");
    }

    lines.push({
      itemCode,
      name: cellText(row.getCell(2).value),
      category: cellText(row.getCell(3).value),
      size: cellText(row.getCell(4).value),
      hand: cellText(row.getCell(5).value),
      quantity,
      unitPriceCents: Math.round(unitPrice * 100),
      lineTotalCents: Math.round(lineTotal * 100),
    });
  }
  return lines;
}

export interface WorkbookGrid {
  name: string;
  rows: string[][];
}

// Caps the in-browser preview so a huge sheet cannot slow the page.
const PREVIEW_ROW_LIMIT = 1000;

function previewText(cell: ExcelJS.Cell): string {
  const text = cellText(cell.value);
  // Money cells hold plain numbers with a rand format; show them as rands.
  if (typeof cell.value === "number" && (cell.numFmt ?? "").includes("R")) return formatRandsWithCents(cell.value);
  return text;
}

// Every sheet as display text, so staff can check the file in the browser
// without Excel. The file itself is unchanged.
export async function readWorkbookGrid(buffer: Buffer | ArrayBuffer): Promise<WorkbookGrid[]> {
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(buffer as ArrayBuffer);
  } catch {
    throw new SupplierWorkbookError("The saved spreadsheet could not be opened.");
  }
  return workbook.worksheets.map((sheet) => {
    const rows: string[][] = [];
    const width = sheet.columnCount;
    for (let r = 1; r <= Math.min(sheet.rowCount, PREVIEW_ROW_LIMIT); r++) {
      const row = sheet.getRow(r);
      rows.push(Array.from({ length: width }, (_, c) => previewText(row.getCell(c + 1))));
    }
    return { name: sheet.name, rows };
  });
}
