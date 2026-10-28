// Draws an invoice as an A4 PDF. Pure: takes the invoice data and returns the
// file bytes, so the same document is emailed and downloaded.
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { formatRandsWithCents } from "@/lib/money";
import type { ClubBillingSettings, FinancialStatus } from "@/types/domain";

export interface InvoiceDocumentLine {
  participantName: string;
  description: string;
  amount: number;
}

export interface InvoiceDocument {
  invoiceNumber: string;
  period: string;
  issuedAt: string;
  status: FinancialStatus;
  total: number;
  payerName: string;
  payerEmail: string;
  lines: InvoiceDocumentLine[];
  settings: ClubBillingSettings;
  // The page that pays this invoice's total, or null without a public origin.
  payUrl: string | null;
}

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 50;
const INK = rgb(0.1, 0.1, 0.12);
const MUTED = rgb(0.4, 0.4, 0.45);
const RULE = rgb(0.8, 0.8, 0.82);

/** "October 2026" for a billing period date. */
export function invoicePeriodLabel(period: string): string {
  return new Date(`${period.slice(0, 10)}T00:00:00Z`).toLocaleDateString("en-ZA", { month: "long", year: "numeric", timeZone: "UTC" });
}

// The built-in PDF fonts only cover Western European characters. Anything
// else (emoji, other scripts) would make pdf-lib throw, so it becomes "?".
function pdfSafe(text: string): string {
  return text.replace(/[^\x20-\x7E\xA0-\xFF‘’“”–—…]/g, "?");
}

// Splits text into lines no wider than maxWidth.
function wrap(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = pdfSafe(text).split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(next, size) <= maxWidth || !current) current = next;
    else { lines.push(current); current = word; }
  }
  if (current) lines.push(current);
  return lines.length ? lines : [""];
}

/** Renders the invoice and returns the PDF bytes. */
export async function renderInvoicePdf(invoice: InvoiceDocument): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Invoice ${invoice.invoiceNumber}`);
  pdf.setAuthor(invoice.settings.club_name);
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  let page: PDFPage = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let y = PAGE_HEIGHT - MARGIN;

  const text = (value: string, x: number, options: { size?: number; font?: PDFFont; color?: typeof INK } = {}) => {
    page.drawText(pdfSafe(value), { x, y, size: options.size ?? 10, font: options.font ?? regular, color: options.color ?? INK });
  };
  const rightText = (value: string, right: number, options: { size?: number; font?: PDFFont } = {}) => {
    const size = options.size ?? 10;
    const font = options.font ?? regular;
    text(value, right - font.widthOfTextAtSize(pdfSafe(value), size), { size, font });
  };
  const rule = () => {
    page.drawLine({ start: { x: MARGIN, y }, end: { x: PAGE_WIDTH - MARGIN, y }, thickness: 0.75, color: RULE });
  };
  // Starts a new page when the next block would run into the bottom margin.
  const ensureSpace = (height: number) => {
    if (y - height >= MARGIN) return;
    page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    y = PAGE_HEIGHT - MARGIN;
  };

  // Header: club on the left, "INVOICE" on the right.
  const { settings } = invoice;
  text(settings.club_name, MARGIN, { size: 16, font: bold });
  rightText("INVOICE", PAGE_WIDTH - MARGIN, { size: 20, font: bold });
  y -= 18;
  for (const line of [settings.address, settings.email].filter(Boolean)) {
    text(line, MARGIN, { color: MUTED });
    y -= 13;
  }
  y -= 12;

  // Invoice facts and who it is for.
  const facts: Array<[string, string]> = [
    ["Invoice number", invoice.invoiceNumber],
    ["Billing period", invoicePeriodLabel(invoice.period)],
    ["Issued", new Date(invoice.issuedAt).toLocaleDateString("en-ZA", { day: "numeric", month: "long", year: "numeric", timeZone: "Africa/Johannesburg" })],
    ["Status", invoice.status === "paid" ? "Paid" : invoice.status === "overdue" ? "Overdue" : "Unpaid"],
  ];
  const factsTop = y;
  text("Bill to", MARGIN, { font: bold });
  y -= 14;
  text(invoice.payerName, MARGIN);
  y -= 13;
  if (invoice.payerEmail) text(invoice.payerEmail, MARGIN, { color: MUTED });
  y = factsTop;
  for (const [label, value] of facts) {
    text(label, 330, { color: MUTED });
    rightText(value, PAGE_WIDTH - MARGIN, { font: bold });
    y -= 14;
  }
  y -= 16;

  // Line items.
  const participantX = MARGIN;
  const descriptionX = 190;
  const amountRight = PAGE_WIDTH - MARGIN;
  const descriptionWidth = 420 - descriptionX;
  rule();
  y -= 14;
  text("Participant", participantX, { font: bold });
  text("Description", descriptionX, { font: bold });
  rightText("Amount", amountRight, { font: bold });
  y -= 8;
  rule();
  y -= 16;
  for (const line of invoice.lines) {
    const descriptionLines = wrap(line.description, regular, 10, descriptionWidth);
    const participantLines = wrap(line.participantName, regular, 10, descriptionX - participantX - 10);
    const rows = Math.max(descriptionLines.length, participantLines.length);
    ensureSpace(rows * 13 + 8);
    const rowTop = y;
    participantLines.forEach((value, index) => { y = rowTop - index * 13; text(value, participantX); });
    descriptionLines.forEach((value, index) => { y = rowTop - index * 13; text(value, descriptionX); });
    y = rowTop;
    rightText(formatRandsWithCents(line.amount), amountRight);
    y = rowTop - rows * 13 - 6;
  }
  ensureSpace(40);
  rule();
  y -= 18;
  text("Total due", 330, { font: bold, size: 12 });
  rightText(formatRandsWithCents(invoice.total), amountRight, { font: bold, size: 12 });
  y -= 36;

  // How to pay.
  const bankRows: Array<[string, string]> = [
    ["Bank", settings.bank_name],
    ["Account name", settings.account_name],
    ["Account number", settings.account_number],
    ["Branch code", settings.branch_code],
    ["Reference", invoice.invoiceNumber],
  ];
  ensureSpace(bankRows.length * 14 + 80);
  text("How to pay", MARGIN, { font: bold, size: 12 });
  y -= 18;
  text("EFT: use the invoice number as your payment reference.", MARGIN, { color: MUTED });
  y -= 16;
  for (const [label, value] of bankRows) {
    if (!value) continue;
    text(label, MARGIN, { color: MUTED });
    text(value, 160, { font: bold });
    y -= 14;
  }
  if (invoice.payUrl) {
    y -= 8;
    text("Pay online:", MARGIN, { color: MUTED });
    text(invoice.payUrl, 160, { color: rgb(0.18, 0.2, 0.6) });
    y -= 14;
  }
  y -= 10;
  for (const line of wrap("This invoice is a statement of your outstanding items, not an additional charge.", regular, 9, PAGE_WIDTH - 2 * MARGIN)) {
    ensureSpace(12);
    text(line, MARGIN, { size: 9, color: MUTED });
    y -= 12;
  }

  return pdf.save();
}
