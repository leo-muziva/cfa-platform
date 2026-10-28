import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ClubBillingSettings, Invoice, Profile } from "@/types/domain";

vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({
  getCurrentProfile: vi.fn(),
  requireStaff: vi.fn(),
  findInvoiceForViewer: vi.fn(),
  findInvoiceForSending: vi.fn(),
  getClubBillingSettings: vi.fn(),
  saveClubBillingSettings: vi.fn(),
  claimInvoiceEmail: vi.fn(),
  completeInvoiceEmail: vi.fn(),
  releaseInvoiceEmail: vi.fn(),
  listUnsentScheduledInvoices: vi.fn(),
  listAllInvoices: vi.fn(),
  getEmailTransport: vi.fn(),
  sendEmail: vi.fn(),
  renderInvoicePdf: vi.fn(),
  getCurrentAccountContext: vi.fn(),
  onlinePaymentsAvailable: vi.fn(),
}));

vi.mock("@/lib/services/MemberService", () => ({
  getCurrentProfile: mocks.getCurrentProfile, requireStaff: mocks.requireStaff, getCurrentAccountContext: mocks.getCurrentAccountContext,
}));
vi.mock("@/lib/services/payment-service", () => ({ onlinePaymentsAvailable: mocks.onlinePaymentsAvailable }));
vi.mock("@/lib/repositories/invoice-document-repository", () => ({
  findInvoiceForViewer: mocks.findInvoiceForViewer, findInvoiceForSending: mocks.findInvoiceForSending,
  getClubBillingSettings: mocks.getClubBillingSettings, saveClubBillingSettings: mocks.saveClubBillingSettings,
  claimInvoiceEmail: mocks.claimInvoiceEmail, completeInvoiceEmail: mocks.completeInvoiceEmail,
  releaseInvoiceEmail: mocks.releaseInvoiceEmail, listUnsentScheduledInvoices: mocks.listUnsentScheduledInvoices,
}));
vi.mock("@/lib/repositories/PlatformRepository", () => ({ listAllInvoices: mocks.listAllInvoices }));
vi.mock("@/lib/providers/email-transport", () => ({ getEmailTransport: mocks.getEmailTransport, sendEmail: mocks.sendEmail }));
vi.mock("@/lib/payments/registry", () => ({ getPaymentOrigin: () => "https://cfa.example" }));
vi.mock("@/lib/documents/invoice-pdf", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/documents/invoice-pdf")>(),
  renderInvoicePdf: mocks.renderInvoicePdf,
}));

const {
  getInvoiceForPayer, getInvoicePdf, sendInvoiceEmail, sendScheduledInvoiceEmails, sendInvoicesForStaff, toInvoiceDocument, updateClubBillingSettingsForStaff,
} = await import("./invoice-document-service");

const INVOICE_ID = "2d0f5a52-8a4c-4b55-9b8d-4e2a1c3f5e61";
const settings: ClubBillingSettings = {
  club_name: "Cape Fencing Academy", address: "", email: "", bank_name: "Example Bank",
  account_name: "CFA", account_number: "0000", branch_code: "000000",
};
const invoice = {
  id: INVOICE_ID, payer_id: "payer-id", period: "2026-10-01", invoice_number: "CFA-000042", status: "unpaid",
  total: "550.00", payment_link: null, issued_at: "2026-10-24T22:00:00Z", paid_at: null, generated_by: "staff", sent_at: null,
  payer: { full_name: "George Guardian", email: "guardian@example.test" },
  lines: [{ id: "l1", invoice_id: INVOICE_ID, charge_id: "c1", participant_id: "f1", participant: { id: "f1", full_name: "Fiona Fencer" }, description: "Month-to-month", amount: "550.00" }],
} as unknown as Invoice;
const payer = { id: "payer-id", is_staff: false } as Profile;
const otherPayer = { id: "someone-else", is_staff: false } as Profile;
const staff = { id: "staff-id", is_staff: true } as Profile;
const transport = { kind: "smtp", config: {} };
const pdfBytes = new Uint8Array([37, 80, 68, 70]);

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getEmailTransport.mockReturnValue(transport);
  mocks.renderInvoicePdf.mockResolvedValue(pdfBytes);
  mocks.getClubBillingSettings.mockResolvedValue(settings);
  mocks.findInvoiceForSending.mockResolvedValue({ invoice, settings });
  mocks.claimInvoiceEmail.mockResolvedValue({ invoice_id: INVOICE_ID, recipient_email: "guardian@example.test", recipient_name: "George Guardian" });
  mocks.sendEmail.mockResolvedValue({ ok: true });
});

describe("toInvoiceDocument", () => {
  it("turns numeric strings into numbers and fills in names", () => {
    const document = toInvoiceDocument(invoice, settings, null);
    expect(document).toMatchObject({ total: 550, payerName: "George Guardian", lines: [{ participantName: "Fiona Fencer", amount: 550 }] });
  });
});

describe("getInvoicePdf", () => {
  it("needs a signed-in user", async () => {
    mocks.getCurrentProfile.mockResolvedValue(null);
    expect(await getInvoicePdf(INVOICE_ID)).toEqual({ ok: false, reason: "unauthenticated" });
    expect(mocks.findInvoiceForViewer).not.toHaveBeenCalled();
  });

  it("gives the payer their own invoice", async () => {
    mocks.getCurrentProfile.mockResolvedValue(payer);
    mocks.findInvoiceForViewer.mockResolvedValue(invoice);
    expect(await getInvoicePdf(INVOICE_ID)).toEqual({ ok: true, filename: "CFA-000042.pdf", pdf: pdfBytes });
    expect(mocks.renderInvoicePdf).toHaveBeenCalledWith(expect.objectContaining({ payUrl: `https://cfa.example/protected/billing/invoices/${INVOICE_ID}` }));
  });

  it("gives staff any invoice they can read", async () => {
    mocks.getCurrentProfile.mockResolvedValue(staff);
    mocks.findInvoiceForViewer.mockResolvedValue(invoice);
    expect((await getInvoicePdf(INVOICE_ID)).ok).toBe(true);
  });

  it("hides invoices RLS does not return, such as a dependant's or another household's", async () => {
    mocks.getCurrentProfile.mockResolvedValue(otherPayer);
    mocks.findInvoiceForViewer.mockResolvedValue(null);
    expect(await getInvoicePdf(INVOICE_ID)).toEqual({ ok: false, reason: "not_found" });
  });

  it("refuses another payer's invoice even if a read slipped through", async () => {
    mocks.getCurrentProfile.mockResolvedValue(otherPayer);
    mocks.findInvoiceForViewer.mockResolvedValue(invoice);
    expect(await getInvoicePdf(INVOICE_ID)).toEqual({ ok: false, reason: "not_found" });
    expect(mocks.renderInvoicePdf).not.toHaveBeenCalled();
  });
});

describe("getInvoiceForPayer", () => {
  const context = (profile: Profile, isPayer: boolean) => ({ profile, capabilities: { canSeeHouseholdMoney: isPayer } });

  it("sends signed-out visitors to log in", async () => {
    mocks.getCurrentAccountContext.mockResolvedValue({ error: "Not authenticated" });
    expect(await getInvoiceForPayer(INVOICE_ID)).toEqual({ ok: false, reason: "unauthenticated" });
  });

  it("shows the payer their invoice and whether online payment is on", async () => {
    mocks.getCurrentAccountContext.mockResolvedValue(context(payer, true));
    mocks.findInvoiceForViewer.mockResolvedValue(invoice);
    mocks.onlinePaymentsAvailable.mockReturnValue(true);
    expect(await getInvoiceForPayer(INVOICE_ID)).toEqual({ ok: true, invoice, onlinePayment: true });
  });

  it("hides the invoice from a dependant without reading it", async () => {
    mocks.getCurrentAccountContext.mockResolvedValue(context({ id: "dependant-id", is_staff: false } as Profile, false));
    expect(await getInvoiceForPayer(INVOICE_ID)).toEqual({ ok: false, reason: "not_found" });
    expect(mocks.findInvoiceForViewer).not.toHaveBeenCalled();
  });

  it("hides another household's invoice, even from staff paying personally", async () => {
    mocks.getCurrentAccountContext.mockResolvedValue(context(staff, true));
    mocks.findInvoiceForViewer.mockResolvedValue(invoice);
    expect(await getInvoiceForPayer(INVOICE_ID)).toEqual({ ok: false, reason: "not_found" });
  });
});

describe("sendInvoiceEmail", () => {
  it("emails the PDF and marks the invoice sent", async () => {
    expect(await sendInvoiceEmail(INVOICE_ID, { allowResend: false })).toBe("sent");
    expect(mocks.claimInvoiceEmail).toHaveBeenCalledWith(INVOICE_ID, false);
    const email = mocks.sendEmail.mock.calls[0][1];
    expect(email.to).toBe("guardian@example.test");
    expect(email.subject).toBe("CFA invoice CFA-000042 - R550.00 due");
    expect(email.attachments[0]).toMatchObject({ filename: "CFA-000042.pdf", content: pdfBytes });
    expect(email.text).toContain(`https://cfa.example/protected/billing/invoices/${INVOICE_ID}`);
    expect(mocks.completeInvoiceEmail).toHaveBeenCalledWith(INVOICE_ID);
    expect(mocks.releaseInvoiceEmail).not.toHaveBeenCalled();
  });

  it("does nothing when email is not set up", async () => {
    mocks.getEmailTransport.mockReturnValue(null);
    expect(await sendInvoiceEmail(INVOICE_ID, { allowResend: false })).toBe("failed");
    expect(mocks.claimInvoiceEmail).not.toHaveBeenCalled();
  });

  it("skips an invoice that is already sent or being sent", async () => {
    mocks.claimInvoiceEmail.mockResolvedValue(null);
    expect(await sendInvoiceEmail(INVOICE_ID, { allowResend: false })).toBe("skipped");
    expect(mocks.sendEmail).not.toHaveBeenCalled();
  });

  it("gives the claim back when the mail server refuses", async () => {
    mocks.sendEmail.mockResolvedValue({ ok: false, error: "The mail server refused the email (550)." });
    expect(await sendInvoiceEmail(INVOICE_ID, { allowResend: false })).toBe("failed");
    expect(mocks.releaseInvoiceEmail).toHaveBeenCalledWith(INVOICE_ID);
    expect(mocks.completeInvoiceEmail).not.toHaveBeenCalled();
  });

  it("gives the claim back when the PDF cannot be built, without throwing", async () => {
    mocks.renderInvoicePdf.mockRejectedValue(new Error("font"));
    expect(await sendInvoiceEmail(INVOICE_ID, { allowResend: false })).toBe("failed");
    expect(mocks.releaseInvoiceEmail).toHaveBeenCalledWith(INVOICE_ID);
    expect(mocks.sendEmail).not.toHaveBeenCalled();
  });

  it("gives the claim back when the payer has no email address", async () => {
    mocks.claimInvoiceEmail.mockResolvedValue({ invoice_id: INVOICE_ID, recipient_email: "", recipient_name: "George" });
    expect(await sendInvoiceEmail(INVOICE_ID, { allowResend: false })).toBe("failed");
    expect(mocks.releaseInvoiceEmail).toHaveBeenCalledWith(INVOICE_ID);
  });
});

describe("sendScheduledInvoiceEmails", () => {
  it("sends every unsent scheduled invoice and counts the results", async () => {
    mocks.listUnsentScheduledInvoices.mockResolvedValue(["a", "b", "c"]);
    mocks.sendEmail.mockResolvedValueOnce({ ok: true }).mockResolvedValueOnce({ ok: false, error: "x" }).mockResolvedValueOnce({ ok: true });
    expect(await sendScheduledInvoiceEmails()).toEqual({ emailed: 2, failed: 1 });
    expect(mocks.claimInvoiceEmail).toHaveBeenCalledWith("a", false);
  });
});

describe("sendInvoicesForStaff", () => {
  it("is for staff only", async () => {
    mocks.requireStaff.mockResolvedValue({ error: "Forbidden" });
    expect(await sendInvoicesForStaff({ scope: "one", invoice_id: INVOICE_ID })).toEqual({ error: "Forbidden" });
    expect(mocks.claimInvoiceEmail).not.toHaveBeenCalled();
  });

  it("rejects a malformed request", async () => {
    mocks.requireStaff.mockResolvedValue({ profile: staff });
    expect(await sendInvoicesForStaff({ scope: "one", invoice_id: "nope" })).toEqual({ error: "Choose an invoice to send." });
  });

  it("explains when email is not set up", async () => {
    mocks.requireStaff.mockResolvedValue({ profile: staff });
    mocks.getEmailTransport.mockReturnValue(null);
    expect(await sendInvoicesForStaff({ scope: "one", invoice_id: INVOICE_ID })).toEqual({ error: "Email is not set up, so invoices cannot be sent yet." });
  });

  it("sends or resends one invoice the staff member can see", async () => {
    mocks.requireStaff.mockResolvedValue({ profile: staff });
    mocks.findInvoiceForViewer.mockResolvedValue(invoice);
    expect(await sendInvoicesForStaff({ scope: "one", invoice_id: INVOICE_ID })).toEqual({ success: "Invoice emailed to the payer." });
    expect(mocks.claimInvoiceEmail).toHaveBeenCalledWith(INVOICE_ID, true);
  });

  it("will not send an invoice the staff member cannot read", async () => {
    mocks.requireStaff.mockResolvedValue({ profile: staff });
    mocks.findInvoiceForViewer.mockResolvedValue(null);
    expect(await sendInvoicesForStaff({ scope: "one", invoice_id: INVOICE_ID })).toEqual({ error: "Invoice not found." });
    expect(mocks.claimInvoiceEmail).not.toHaveBeenCalled();
  });

  it("sends only unpaid invoices that have not gone out", async () => {
    mocks.requireStaff.mockResolvedValue({ profile: staff });
    mocks.listAllInvoices.mockResolvedValue([
      { ...invoice, id: "unsent" },
      { ...invoice, id: "sent", sent_at: "2026-10-25T08:00:00Z" },
      { ...invoice, id: "paid", status: "paid" },
    ]);
    expect(await sendInvoicesForStaff({ scope: "all_unsent" })).toEqual({ success: "1 invoice emailed." });
    expect(mocks.claimInvoiceEmail.mock.calls).toEqual([["unsent", false]]);
  });

  it("reports partial failures", async () => {
    mocks.requireStaff.mockResolvedValue({ profile: staff });
    mocks.listAllInvoices.mockResolvedValue([{ ...invoice, id: "a" }, { ...invoice, id: "b" }]);
    mocks.sendEmail.mockResolvedValueOnce({ ok: true }).mockResolvedValueOnce({ ok: false, error: "x" });
    expect(await sendInvoicesForStaff({ scope: "all_unsent" })).toEqual({ error: "1 invoice emailed. 1 could not be sent; try again." });
  });
});

describe("updateClubBillingSettingsForStaff", () => {
  const input = { club_name: "Cape Fencing Academy", address: "", email: "", bank_name: "", account_name: "", account_number: "", branch_code: "" };

  it("is for staff only", async () => {
    mocks.requireStaff.mockResolvedValue({ error: "Forbidden" });
    expect(await updateClubBillingSettingsForStaff(input)).toEqual({ error: "Forbidden" });
    expect(mocks.saveClubBillingSettings).not.toHaveBeenCalled();
  });

  it("validates before saving", async () => {
    mocks.requireStaff.mockResolvedValue({ profile: staff });
    const result = await updateClubBillingSettingsForStaff({ ...input, club_name: "" });
    expect(result).toMatchObject({ fieldErrors: { club_name: "Enter the club name." } });
    expect(mocks.saveClubBillingSettings).not.toHaveBeenCalled();
  });

  it("saves valid details as the staff member", async () => {
    mocks.requireStaff.mockResolvedValue({ profile: staff });
    mocks.saveClubBillingSettings.mockResolvedValue(true);
    expect(await updateClubBillingSettingsForStaff(input)).toEqual({ success: true });
    expect(mocks.saveClubBillingSettings).toHaveBeenCalledWith(input, "staff-id");
  });
});
