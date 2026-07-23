import 'server-only'
import { createClient } from '@/lib/supabase/server'
import type { Booking, Invoice, LessonSlot, MembershipRequest, Receipt } from '@/types/domain'

export async function listOpenSlots(): Promise<LessonSlot[]> {
  const db = await createClient()
  const { data, error } = await db.from('lesson_slots').select('*').eq('is_open', true).gt('starts_at', new Date().toISOString()).order('starts_at')
  return error ? [] : data as LessonSlot[]
}

export async function createSlot(input: Omit<LessonSlot, 'id' | 'created_by' | 'created_at' | 'is_open'>, createdBy: string) {
  const db = await createClient()
  const { data, error } = await db.from('lesson_slots').insert({ ...input, created_by: createdBy }).select('*').single()
  return error ? null : data as LessonSlot
}

export async function createBooking(slotId: string, fencerId: string, paymentOption: string) {
  const db = await createClient()
  const { data, error } = await db.rpc('create_lesson_booking', {
    target_slot: slotId, target_fencer: fencerId, requested_payment: paymentOption,
  })
  return error ? { error: error.message } as const : { bookingId: data as string }
}

export async function listBookings(): Promise<Booking[]> {
  const db = await createClient()
  const { data, error } = await db.from('bookings').select(`
    id,lesson_slot_id,booked_by_id,fencer_id,payment_option,status,created_at,
    lesson_slot:lesson_slots(*),fencer:profiles!bookings_fencer_id_fkey(id,full_name)
  `).order('created_at', { ascending: false })
  return error ? [] : data as unknown as Booking[]
}

export async function createMembershipRequest(applicantId: string, membershipTypeId: string) {
  const db = await createClient()
  const { error } = await db.from('membership_requests').insert({ applicant_id: applicantId, membership_type_id: membershipTypeId })
  return error ? { error: error.message } : { success: true as const }
}

export async function listMembershipRequests(): Promise<MembershipRequest[]> {
  const db = await createClient()
  const { data, error } = await db.from('membership_requests').select(`
    id,applicant_id,membership_type_id,status,reviewed_by,reviewed_at,created_at,
    applicant:profiles!membership_requests_applicant_id_fkey(id,full_name,email),
    membership_type:membership_types(id,name)
  `).order('created_at', { ascending: false })
  return error ? [] : data as unknown as MembershipRequest[]
}

export async function reviewMembershipRequest(requestId: string, decision: 'approved' | 'declined') {
  const db = await createClient()
  const { error } = await db.rpc('review_membership_request', { request_id: requestId, decision })
  return error ? { error: error.message } : { success: true as const }
}

export async function getBillingForPayer(payerId: string) {
  const db = await createClient()
  const [{ data: invoices }, { data: receipts }, { data: household }, { data: charges }] = await Promise.all([
    db.from('invoices').select('*,lines:invoice_lines(*)').eq('payer_id', payerId).order('issued_at', { ascending: false }),
    db.from('receipts').select('*').eq('payer_id', payerId).order('issued_at', { ascending: false }),
    db.from('households').select('membership_payment_method').eq('payer_id', payerId).single(),
    db.from('charges').select('amount').eq('payer_id', payerId).eq('status', 'unpaid'),
  ])
  return {
    balance: (charges ?? []).reduce((sum, row) => sum + Number(row.amount), 0),
    invoices: (invoices ?? []) as Invoice[], receipts: (receipts ?? []) as Receipt[],
    paymentPreference: household?.membership_payment_method ?? 'manual', providerAvailable: false,
  }
}

export async function runInvoices(period: string) {
  const db = await createClient()
  const { data, error } = await db.rpc('run_monthly_invoices', { target_period: period })
  return error ? { error: error.message } : { count: data as number }
}

export async function listAllInvoices(): Promise<Invoice[]> {
  const db = await createClient()
  const { data, error } = await db.from('invoices').select('*,lines:invoice_lines(*)').order('issued_at', { ascending: false })
  return error ? [] : data as Invoice[]
}

export async function recordManualPayment(invoiceId: string, adminId: string) {
  const db = await createClient()
  const { data: invoice, error } = await db.from('invoices').select('*').eq('id', invoiceId).single()
  if (error || !invoice || invoice.status === 'paid') return { error: 'Unpaid invoice not found' }
  const { error: updateError } = await db.from('invoices').update({ status: 'paid', paid_at: new Date().toISOString() }).eq('id', invoiceId)
  if (updateError) return { error: updateError.message }
  await db.from('charges').update({ status: 'paid', paid_at: new Date().toISOString() })
    .in('id', (await db.from('invoice_lines').select('charge_id').eq('invoice_id', invoiceId)).data?.map((r) => r.charge_id) ?? [])
  const { error: receiptError } = await db.from('receipts').insert({ payer_id: invoice.payer_id, invoice_id: invoiceId, amount: invoice.total })
  if (receiptError) return { error: receiptError.message }
  void adminId
  return { success: true as const }
}
