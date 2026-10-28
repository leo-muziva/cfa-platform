// Data access for invoice PDFs and invoice emails. Reads for a download run as
// the signed-in user, so RLS decides who sees which invoice. Sending runs
// through the server-only admin client because the cron job has no user.
import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { ClubBillingSettings, Invoice } from '@/types/domain'

const INVOICE_WITH_DETAILS = '*,lines:invoice_lines(*,participant:profiles!invoice_lines_participant_id_fkey(id,full_name)),payer:profiles!invoices_payer_id_fkey(full_name,email)'
const SETTINGS_COLUMNS = 'club_name,address,email,bank_name,account_name,account_number,branch_code'

// The claimed invoice and who the email goes to.
export interface InvoiceEmailClaim {
  invoice_id: string
  recipient_email: string
  recipient_name: string
}

async function findInvoice(db: SupabaseClient, invoiceId: string): Promise<Invoice | null> {
  const { data, error } = await db.from('invoices').select(INVOICE_WITH_DETAILS).eq('id', invoiceId).maybeSingle()
  return error || !data ? null : data as unknown as Invoice
}

async function findSettings(db: SupabaseClient): Promise<ClubBillingSettings | null> {
  const { data, error } = await db.from('club_billing_settings').select(SETTINGS_COLUMNS).eq('singleton', true).maybeSingle()
  return error || !data ? null : data as ClubBillingSettings
}

/** One invoice with lines and payer, if the signed-in user may see it. */
export async function findInvoiceForViewer(invoiceId: string): Promise<Invoice | null> {
  return findInvoice(await createClient(), invoiceId)
}

/** The club billing details, read as the signed-in user. */
export async function getClubBillingSettings(): Promise<ClubBillingSettings | null> {
  return findSettings(await createClient())
}

/** Saves the club billing details. RLS allows active staff only. */
export async function saveClubBillingSettings(settings: ClubBillingSettings, staffId: string): Promise<boolean> {
  const db = await createClient()
  const { data, error } = await db.from('club_billing_settings')
    .update({ ...settings, updated_at: new Date().toISOString(), updated_by: staffId })
    .eq('singleton', true).select('singleton')
  return !error && (data?.length ?? 0) === 1
}

/** The invoice and club details for an email, read with the admin client. */
export async function findInvoiceForSending(invoiceId: string): Promise<{ invoice: Invoice; settings: ClubBillingSettings } | null> {
  const db = createAdminClient()
  if (!db) return null
  const [invoice, settings] = await Promise.all([findInvoice(db, invoiceId), findSettings(db)])
  return invoice && settings ? { invoice, settings } : null
}

/**
 * Claims an invoice for emailing. Null when email for it is already sent
 * (unless resending) or another sender holds the claim.
 */
export async function claimInvoiceEmail(invoiceId: string, allowResend: boolean): Promise<InvoiceEmailClaim | null> {
  const db = createAdminClient()
  if (!db) return null
  const { data, error } = await db.rpc('claim_invoice_email', { target_invoice: invoiceId, allow_resend: allowResend })
  if (error) return null
  return ((data ?? []) as InvoiceEmailClaim[])[0] ?? null
}

/** Marks the invoice as sent and clears the claim. */
export async function completeInvoiceEmail(invoiceId: string): Promise<void> {
  const db = createAdminClient()
  if (!db) return
  await db.rpc('complete_invoice_email', { target_invoice: invoiceId })
}

/** Gives the claim back after a failed send so it can be retried. */
export async function releaseInvoiceEmail(invoiceId: string): Promise<void> {
  const db = createAdminClient()
  if (!db) return
  await db.rpc('release_invoice_email', { target_invoice: invoiceId })
}

/** Invoices the monthly job made that have not been emailed yet. */
export async function listUnsentScheduledInvoices(): Promise<string[]> {
  const db = createAdminClient()
  if (!db) return []
  const { data, error } = await db.rpc('list_unsent_scheduled_invoices')
  return error ? [] : (data ?? []) as string[]
}
