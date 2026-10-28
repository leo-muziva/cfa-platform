// Invoice PDFs and invoice emails. The monthly job emails the invoices it
// makes; invoices staff generate by hand wait until staff press Send. Payers
// and staff can download any invoice they are allowed to see.
import 'server-only'
import { getCurrentAccountContext, getCurrentProfile, requireStaff } from '@/lib/services/MemberService'
import { onlinePaymentsAvailable } from '@/lib/services/payment-service'
import {
  claimInvoiceEmail, completeInvoiceEmail, findInvoiceForSending, findInvoiceForViewer, getClubBillingSettings,
  listUnsentScheduledInvoices, releaseInvoiceEmail, saveClubBillingSettings,
} from '@/lib/repositories/invoice-document-repository'
import { listAllInvoices } from '@/lib/repositories/PlatformRepository'
import { renderInvoicePdf, invoicePeriodLabel, type InvoiceDocument } from '@/lib/documents/invoice-pdf'
import { getEmailTransport, sendEmail } from '@/lib/providers/email-transport'
import { invoiceEmail } from '@/lib/providers/resend-email'
import { getPaymentOrigin } from '@/lib/payments/registry'
import { clubBillingSettingsSchema, invoiceSendSchema } from '@/lib/validations/club-billing.schema'
import { validationFailure, type ValidationFailure } from '@/lib/validations/form-errors'
import type { ClubBillingSettings, Invoice } from '@/types/domain'

export type InvoicePdfResult =
  | { ok: true; filename: string; pdf: Uint8Array }
  | { ok: false; reason: 'unauthenticated' | 'not_found' }

// What happened to one invoice email. 'skipped' means it was already sent or
// another sender is sending it right now.
export type InvoiceSendOutcome = 'sent' | 'skipped' | 'failed'

// Joined rows can arrive as a single-item array.
function single<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null
}

/** The page where the payer sees this invoice and pays its total in one go. */
export function invoicePayPath(invoiceId: string): string {
  return `/protected/billing/invoices/${invoiceId}`
}

// The full pay link for emails and PDFs, or null without a public origin.
function invoicePayUrl(invoiceId: string): string | null {
  const origin = getPaymentOrigin()
  return origin ? `${origin}${invoicePayPath(invoiceId)}` : null
}

/** The data the PDF needs, from an invoice row and the club details. */
export function toInvoiceDocument(invoice: Invoice, settings: ClubBillingSettings, payUrl: string | null): InvoiceDocument {
  const payer = single(invoice.payer)
  return {
    invoiceNumber: invoice.invoice_number,
    period: invoice.period,
    issuedAt: invoice.issued_at,
    status: invoice.status,
    total: Number(invoice.total),
    payerName: payer?.full_name?.trim() || payer?.email || 'CFA member',
    payerEmail: payer?.email ?? '',
    lines: (invoice.lines ?? []).map((line) => ({
      participantName: single(line.participant)?.full_name?.trim() || 'Participant',
      description: line.description,
      amount: Number(line.amount),
    })),
    settings,
    payUrl,
  }
}

/** The invoice PDF, for the payer or staff. RLS hides other people's invoices. */
export async function getInvoicePdf(invoiceId: string): Promise<InvoicePdfResult> {
  const profile = await getCurrentProfile()
  if (!profile) return { ok: false, reason: 'unauthenticated' }
  const [invoice, settings] = await Promise.all([findInvoiceForViewer(invoiceId), getClubBillingSettings()])
  // Belt and braces on top of RLS: only staff or the invoice's own payer.
  if (!invoice || !settings || (!profile.is_staff && invoice.payer_id !== profile.id)) return { ok: false, reason: 'not_found' }
  const pdf = await renderInvoicePdf(toInvoiceDocument(invoice, settings, invoicePayUrl(invoice.id)))
  return { ok: true, filename: `${invoice.invoice_number}.pdf`, pdf }
}

/**
 * The payer's own invoice for the pay page, and whether online payment is
 * on. Payers only: dependants and other households get not_found.
 */
export async function getInvoiceForPayer(invoiceId: string): Promise<
  { ok: true; invoice: Invoice; onlinePayment: boolean } | { ok: false; reason: 'unauthenticated' | 'not_found' }
> {
  const context = await getCurrentAccountContext()
  if ('error' in context) return { ok: false, reason: context.error === 'Not authenticated' ? 'unauthenticated' : 'not_found' }
  if (!context.capabilities.canSeeHouseholdMoney) return { ok: false, reason: 'not_found' }
  const invoice = await findInvoiceForViewer(invoiceId)
  if (!invoice || invoice.payer_id !== context.profile.id) return { ok: false, reason: 'not_found' }
  return { ok: true, invoice, onlinePayment: onlinePaymentsAvailable() }
}

/**
 * Emails one invoice with its PDF to the payer. Never throws, so a cron run
 * or a staff click is never broken by email. The claim stops the cron and
 * staff sending the same invoice twice at once.
 */
export async function sendInvoiceEmail(invoiceId: string, options: { allowResend: boolean }): Promise<InvoiceSendOutcome> {
  const transport = getEmailTransport()
  if (!transport) return 'failed'
  const claim = await claimInvoiceEmail(invoiceId, options.allowResend)
  if (!claim) return 'skipped'
  try {
    const found = await findInvoiceForSending(invoiceId)
    if (!found || !claim.recipient_email) {
      await releaseInvoiceEmail(invoiceId)
      return 'failed'
    }
    const url = invoicePayUrl(found.invoice.id)
    const pdf = await renderInvoicePdf(toInvoiceDocument(found.invoice, found.settings, url))
    const result = await sendEmail(transport, invoiceEmail({
      to: claim.recipient_email,
      recipientName: claim.recipient_name,
      invoiceNumber: found.invoice.invoice_number,
      periodLabel: invoicePeriodLabel(found.invoice.period),
      amountCents: String(Math.round(Number(found.invoice.total) * 100)),
      payUrl: url,
      pdf,
    }))
    if (!result.ok) {
      await releaseInvoiceEmail(invoiceId)
      return 'failed'
    }
    await completeInvoiceEmail(invoiceId)
    return 'sent'
  } catch {
    // Nothing was sent (sendEmail never throws), so the claim can go back.
    await releaseInvoiceEmail(invoiceId)
    return 'failed'
  }
}

/** Emails every invoice the monthly job made that has not gone out yet. */
export async function sendScheduledInvoiceEmails(): Promise<{ emailed: number; failed: number }> {
  let emailed = 0
  let failed = 0
  for (const invoiceId of await listUnsentScheduledInvoices()) {
    const outcome = await sendInvoiceEmail(invoiceId, { allowResend: false })
    if (outcome === 'sent') emailed++
    if (outcome === 'failed') failed++
  }
  return { emailed, failed }
}

/** Staff send (or resend) one invoice, or every invoice not yet sent. */
export async function sendInvoicesForStaff(raw: unknown): Promise<{ success: string } | { error: string }> {
  const guard = await requireStaff()
  if ('error' in guard) return guard
  const parsed = invoiceSendSchema.safeParse(raw)
  if (!parsed.success) return { error: 'Choose an invoice to send.' }
  if (!getEmailTransport()) return { error: 'Email is not set up, so invoices cannot be sent yet.' }

  if (parsed.data.scope === 'one') {
    // Only invoices this staff member can see may be sent.
    if (!await findInvoiceForViewer(parsed.data.invoice_id)) return { error: 'Invoice not found.' }
    const outcome = await sendInvoiceEmail(parsed.data.invoice_id, { allowResend: true })
    if (outcome === 'sent') return { success: 'Invoice emailed to the payer.' }
    if (outcome === 'skipped') return { error: 'This invoice is being sent right now. Refresh in a moment.' }
    return { error: 'The invoice could not be emailed. Check the payer has an email address and try again.' }
  }

  // Paid invoices need no email; staff can still send one individually.
  const unsent = (await listAllInvoices()).filter((invoice) => !invoice.sent_at && invoice.status !== 'paid')
  let sent = 0
  let failed = 0
  for (const invoice of unsent) {
    const outcome = await sendInvoiceEmail(invoice.id, { allowResend: false })
    if (outcome === 'sent') sent++
    if (outcome === 'failed') failed++
  }
  if (unsent.length === 0) return { success: 'Every unpaid invoice has already been sent.' }
  const sentText = sent === 1 ? '1 invoice emailed.' : `${sent} invoices emailed.`
  return failed ? { error: `${sentText} ${failed} could not be sent; try again.` } : { success: sentText }
}

/** The club billing details, for the staff form. */
export async function getClubBillingSettingsForStaff(): Promise<{ settings: ClubBillingSettings | null } | { error: string }> {
  const guard = await requireStaff()
  return 'error' in guard ? guard : { settings: await getClubBillingSettings() }
}

/** Staff update the club details printed on invoices. */
export async function updateClubBillingSettingsForStaff(raw: unknown): Promise<{ success: true } | { error: string } | ValidationFailure> {
  const guard = await requireStaff()
  if ('error' in guard) return guard
  const parsed = clubBillingSettingsSchema.safeParse(raw)
  if (!parsed.success) return validationFailure(parsed.error)
  return await saveClubBillingSettings(parsed.data, guard.profile.id)
    ? { success: true }
    : { error: 'The billing details could not be saved.' }
}
