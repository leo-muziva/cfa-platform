import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { invoicePeriodLabel, renderInvoicePdf, type InvoiceDocument } from "./invoice-pdf";

const invoice: InvoiceDocument = {
  invoiceNumber: "CFA-000042",
  period: "2026-10-01",
  issuedAt: "2026-10-24T22:00:00Z",
  status: "unpaid",
  total: 850,
  payerName: "George Guardian",
  payerEmail: "guardian@example.test",
  lines: [
    { participantName: "Fiona Fencer", description: "Month-to-month", amount: 550 },
    { participantName: "Fiona Fencer", description: "Private lesson with Dr. Misha Galukhin", amount: 300 },
  ],
  settings: {
    club_name: "Cape Fencing Academy", address: "1 Example Street, Cape Town", email: "accounts@example.test",
    bank_name: "Example Bank", account_name: "Cape Fencing Academy", account_number: "0000 000 000", branch_code: "000000",
  },
  payUrl: "https://cfa.example/protected/billing",
};

describe("renderInvoicePdf", () => {
  it("produces a one-page PDF titled with the invoice number", async () => {
    const bytes = await renderInvoicePdf(invoice);
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe("%PDF-");
    const pdf = await PDFDocument.load(bytes);
    expect(pdf.getPageCount()).toBe(1);
    expect(pdf.getTitle()).toBe("Invoice CFA-000042");
    expect(pdf.getAuthor()).toBe("Cape Fencing Academy");
  });

  it("adds pages when there are more lines than fit on one", async () => {
    const lines = Array.from({ length: 80 }, (_, index) => ({ participantName: "Fiona Fencer", description: `Lesson ${index + 1}`, amount: 300 }));
    const pdf = await PDFDocument.load(await renderInvoicePdf({ ...invoice, lines }));
    expect(pdf.getPageCount()).toBeGreaterThan(1);
  });

  it("copes with characters the built-in fonts cannot draw and with blank bank details", async () => {
    const bytes = await renderInvoicePdf({
      ...invoice,
      payerName: "Zoë 🤺 Nkosi",
      lines: [{ participantName: "李雷", description: "Lesson ✓", amount: 300 }],
      settings: { ...invoice.settings, bank_name: "", branch_code: "" },
      payUrl: null,
    });
    expect((await PDFDocument.load(bytes)).getPageCount()).toBe(1);
  });
});

describe("invoicePeriodLabel", () => {
  it("names the month in South African English", () => {
    expect(invoicePeriodLabel("2026-10-01")).toBe("October 2026");
    expect(invoicePeriodLabel("2026-01-01T00:00:00+00:00")).toBe("January 2026");
  });
});
