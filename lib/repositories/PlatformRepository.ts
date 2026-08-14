import 'server-only'
import { createClient } from '@/lib/supabase/server'
import type { BookableLessonSlot, Booking, FamilyLink, Invoice, LessonSlot, Membership, MembershipApplication, Receipt } from '@/types/domain'
import { bookingDatabaseErrorCode } from '@/lib/booking-errors'

type PublicLessonSlotRow = Omit<BookableLessonSlot, 'price' | 'booked_count' | 'remaining_capacity' | 'is_full'> & {
  price: number | string
  booked_count: number | string
  remaining_capacity: number | string | null
  is_full: boolean
}

export async function listOpenSlots(): Promise<BookableLessonSlot[]> {
  const db = await createClient()
  const { data, error } = await db.rpc('list_open_lesson_slots')
  if (error) return []
  return ((data ?? []) as PublicLessonSlotRow[]).map((slot) => ({
    ...slot,
    price: Number(slot.price),
    booked_count: Number(slot.booked_count),
    remaining_capacity: slot.remaining_capacity === null ? null : Number(slot.remaining_capacity),
    is_full: Boolean(slot.is_full),
  }))
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
  return error
    ? { errorCode: bookingDatabaseErrorCode(error.message, error.code) } as const
    : { bookingId: data as string }
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
  const { error } = await db.rpc('submit_membership_application', { target_type: membershipTypeId })
  void applicantId
  return error ? { error: error.message } : { success: true as const }
}

export async function listMembershipRequests(): Promise<MembershipApplication[]> {
  const db = await createClient()
  const { data, error } = await db.from('membership_applications').select(`
    id,applicant_id,membership_type_id,version,status,submitted_details,visible_response,
    private_notes,reviewer_id,reviewed_at,created_at,
    applicant:profiles!membership_applications_applicant_id_fkey(id,full_name,email),
    membership_type:membership_types(id,name)
  `).order('created_at', { ascending: false })
  return error ? [] : data as unknown as MembershipApplication[]
}

export async function reviewMembershipRequest(requestId: string, decision: 'approve' | 'request_changes' | 'reject', visibleResponse?: string | null, privateNotes?: string | null) {
  const db = await createClient()
  const { error } = await db.rpc('review_membership_application', {
    application_id: requestId, decision, visible_response: visibleResponse ?? null, private_notes: privateNotes ?? null,
  })
  return error ? { error: error.message } : { success: true as const }
}

export async function getMembership(profileId: string): Promise<Membership | null> {
  const db = await createClient()
  const { data, error } = await db.from('memberships').select('*,membership_type:membership_types(id,code,name)').eq('profile_id', profileId).maybeSingle()
  return error ? null : data as Membership | null
}

export async function resubmitMembership(applicationId: string, membershipTypeId: string) {
  const db = await createClient()
  const { error } = await db.rpc('resubmit_membership_application', { application_id: applicationId, target_type: membershipTypeId })
  return error ? { error: error.message } : { success: true as const }
}

export async function changeMembershipStatus(profileId: string, status: string) {
  const db = await createClient()
  const { error } = await db.rpc('change_membership_status', { target_profile: profileId, target_status: status })
  return error ? { error: error.message } : { success: true as const }
}

export async function listFamilyLinks(): Promise<FamilyLink[]> {
  const db = await createClient()
  const { data, error } = await db.from('family_links').select(`*,guardian:profiles!family_links_guardian_id_fkey(id,full_name,email),dependent:profiles!family_links_dependent_id_fkey(id,full_name,email)`).order('requested_at', { ascending: false })
  return error ? [] : data as unknown as FamilyLink[]
}

export async function requestFamilyLink(email: string) {
  const db = await createClient()
  const { error } = await db.rpc('request_family_link_by_email', { target_email: email })
  return error ? { error: error.message } : { success: true as const }
}

export async function respondFamilyLink(linkId: string, response: 'accept' | 'reject') {
  const db = await createClient()
  const { error } = await db.rpc('respond_family_link', { link_id: linkId, response })
  return error ? { error: error.message } : { success: true as const }
}

export async function endFamilyLink(linkId: string) {
  const db = await createClient()
  const { error } = await db.rpc('end_family_link', { link_id: linkId })
  return error ? { error: error.message } : { success: true as const }
}

export async function getBillingForPayer(payerId: string) {
  const db = await createClient()
  const [{ data: invoices }, { data: receipts }, { data: household }, { data: charges }] = await Promise.all([
    db.from('invoices').select('*,lines:invoice_lines(*,participant:profiles!invoice_lines_participant_id_fkey(id,full_name))').eq('payer_id', payerId).order('issued_at', { ascending: false }),
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
