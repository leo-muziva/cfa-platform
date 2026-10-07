import 'server-only'
import { createClient } from '@/lib/supabase/server'
import type { AdminMembershipApplication, BookableLessonSlot, Booking, FamilyLink, Invoice, LessonSlot, Membership, MembershipApplication, MembershipOperationErrorCode, MembershipPaymentDue, MembershipPaymentEmailStatus, Receipt } from '@/types/domain'
import { bookingDatabaseErrorCode } from '@/lib/booking-errors'
import { getPaymentProvider } from '@/lib/providers/contracts'

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
  return membershipOperationResult(error, 'request_failed')
}

export async function listMembershipRequestsForMember(applicantId: string): Promise<MembershipApplication[]> {
  const db = await createClient()
  const { data, error } = await db.from('membership_applications').select(`
    id,applicant_id,membership_type_id,version,status,submitted_details,visible_response,
    reviewer_id,reviewed_at,created_at,payment_email_status,payment_email_at,
    applicant:profiles!membership_applications_applicant_id_fkey(id,full_name,email),
    membership_type:membership_types(id,name)
  `).eq('applicant_id', applicantId).order('created_at', { ascending: false })
  return error ? [] : data as unknown as MembershipApplication[]
}

export async function listMembershipRequestsForAdmin(): Promise<AdminMembershipApplication[]> {
  const db = await createClient()
  const { data, error } = await db.from('membership_applications').select(`
    id,applicant_id,membership_type_id,version,status,submitted_details,visible_response,
    reviewer_id,reviewed_at,created_at,payment_email_status,payment_email_at,
    applicant:profiles!membership_applications_applicant_id_fkey(id,full_name,email),
    membership_type:membership_types(id,name),
    admin_notes:membership_application_admin_notes(private_notes)
  `).order('created_at', { ascending: false })
  if (error) return []
  return (data ?? []).map((row) => {
    const raw = row as unknown as MembershipApplication & {
      admin_notes: { private_notes: string | null } | { private_notes: string | null }[] | null
    }
    const notes = Array.isArray(raw.admin_notes) ? raw.admin_notes[0] : raw.admin_notes
    const { admin_notes: _adminNotes, ...application } = raw
    void _adminNotes
    return { ...application, private_notes: notes?.private_notes ?? null }
  })
}

export async function reviewMembershipRequest(requestId: string, decision: 'approve' | 'request_changes' | 'reject', visibleResponse?: string | null, privateNotes?: string | null) {
  const db = await createClient()
  const { error } = await db.rpc('review_membership_application', {
    application_id: requestId, decision, visible_response: visibleResponse ?? null, private_notes: privateNotes ?? null,
  })
  return membershipOperationResult(error, 'review_failed')
}

export async function getMembership(profileId: string): Promise<Membership | null> {
  const db = await createClient()
  const { data, error } = await db.from('memberships').select('*,membership_type:membership_types(id,code,name)').eq('profile_id', profileId).maybeSingle()
  return error ? null : data as Membership | null
}

export async function resubmitMembership(applicationId: string, membershipTypeId: string) {
  const db = await createClient()
  const { error } = await db.rpc('resubmit_membership_application', { application_id: applicationId, target_type: membershipTypeId })
  return membershipOperationResult(error, 'resubmit_failed')
}

export async function changeMembershipStatus(profileId: string, status: string) {
  const db = await createClient()
  const { error } = await db.rpc('change_membership_status', { target_profile: profileId, target_status: status })
  return membershipOperationResult(error, 'status_change_failed')
}

export async function recordManualMembershipPayment(applicationId: string) {
  const db = await createClient()
  const { error } = await db.rpc('record_manual_membership_payment', { target_application: applicationId })
  return membershipOperationResult(error, 'payment_record_failed')
}

export async function withdrawMembershipApproval(applicationId: string, visibleResponse?: string | null) {
  const db = await createClient()
  const { error } = await db.rpc('withdraw_membership_approval', {
    target_application: applicationId, target_response: visibleResponse ?? null,
  })
  return membershipOperationResult(error, 'withdraw_failed')
}

interface MembershipPaymentDueRow {
  application_id: string
  applicant_id: string
  applicant_name: string
  membership_name: string
  membership_cents: string
  joining_fee_cents: string
  total_cents: string
  approved_at: string | null
}

// Only payers may call the RPC; anyone else simply has nothing to pay.
export async function listMembershipPaymentsDue(): Promise<MembershipPaymentDue[]> {
  const db = await createClient()
  const { data, error } = await db.rpc('list_my_membership_payments_due')
  if (error) return []
  return ((data ?? []) as MembershipPaymentDueRow[]).map((row) => ({
    applicationId: row.application_id,
    applicantId: row.applicant_id,
    applicantName: row.applicant_name,
    membershipName: row.membership_name,
    membershipCents: row.membership_cents,
    joiningFeeCents: row.joining_fee_cents,
    totalCents: row.total_cents,
    approvedAt: row.approved_at,
  }))
}

export interface MembershipPaymentNotice {
  applicationId: string
  applicantId: string
  applicantName: string
  payerId: string
  payerName: string
  payerEmail: string
  membershipName: string
  totalCents: string
}

export async function getMembershipPaymentNotice(applicationId: string): Promise<MembershipPaymentNotice | null> {
  const db = await createClient()
  const { data, error } = await db.rpc('get_membership_payment_notice', { target_application: applicationId })
  const row = (Array.isArray(data) ? data[0] : data) as Record<string, string> | null | undefined
  if (error || !row) return null
  return {
    applicationId: row.application_id,
    applicantId: row.applicant_id,
    applicantName: row.applicant_name,
    payerId: row.payer_id,
    payerName: row.payer_name,
    payerEmail: row.payer_email,
    membershipName: row.membership_name,
    totalCents: row.total_cents,
  }
}

export async function recordMembershipPaymentEmail(applicationId: string, outcome: MembershipPaymentEmailStatus) {
  const db = await createClient()
  const { error } = await db.rpc('record_membership_payment_email', { target_application: applicationId, target_outcome: outcome })
  return !error
}

function membershipOperationResult(error: unknown, errorCode: MembershipOperationErrorCode) {
  return error ? { errorCode } as const : { success: true as const }
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
  const [{ data: invoices }, { data: receipts }, { data: household }, { data: charges }, { data: credits }, { data: pending }] = await Promise.all([
    db.from('invoices').select('*,lines:invoice_lines(*,participant:profiles!invoice_lines_participant_id_fkey(id,full_name))').eq('payer_id', payerId).order('issued_at', { ascending: false }),
    db.from('receipts').select('*').eq('payer_id', payerId).order('issued_at', { ascending: false }),
    db.from('households').select('membership_payment_method').eq('payer_id', payerId).single(),
    db.from('charges').select(`
      id,amount,type,finalized_at,
      participant:profiles!charges_fencer_id_fkey(full_name),
      booking:bookings!charges_booking_id_fkey(status)
    `).eq('payer_id', payerId).eq('status', 'unpaid').eq('lifecycle_state', 'finalized').order('finalized_at', { ascending: false }),
    db.from('ledger_credits').select('amount').eq('payer_id', payerId),
    db.from('charges').select(`
      id,amount,description,
      participant:profiles!charges_fencer_id_fkey(full_name),
      booking:bookings!charges_booking_id_fkey(starts_at,payment_option)
    `).eq('payer_id', payerId).eq('status', 'unpaid').eq('lifecycle_state', 'provisional')
      // Approved memberships awaiting payment have their own section.
      .is('membership_application_id', null).order('created_at'),
  ])
  return {
    balance: calculateOutstandingBalance(charges ?? [], credits ?? []),
    outstandingCharges: (charges ?? []).map((charge) => ({
      id: charge.id,
      participantName: relationValue(charge.participant)?.full_name ?? 'Participant',
      amount: Number(charge.amount),
      label: outstandingChargeLabel(charge.type, relationValue(charge.booking)?.status ?? null),
      finalizedAt: charge.finalized_at,
    })),
    creditTotal: calculateCreditTotal(credits ?? []),
    invoices: (invoices ?? []) as Invoice[], receipts: (receipts ?? []) as Receipt[],
    // Pay-now lessons are never invoiced; live holds are listed separately with a pay button.
    pendingLessonCharges: (pending ?? []).filter((row) => relationValue(row.booking)?.payment_option !== 'pay_now').map((row) => ({
      id: row.id,
      participantName: relationValue(row.participant)?.full_name ?? 'Participant',
      amount: Number(row.amount), description: row.description,
      lessonStartsAt: relationValue(row.booking)?.starts_at ?? null,
    })),
    paymentPreference: household?.membership_payment_method ?? 'manual', providerAvailable: getPaymentProvider() !== null,
  }
}

function relationValue<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? value[0] ?? null : value
}

export function calculateOutstandingBalance(charges: Array<{ amount: number | string }>, credits: Array<{ amount: number | string }>) {
  const chargeTotal = charges.reduce((sum, row) => sum + Number(row.amount), 0)
  return Math.max(0, chargeTotal - calculateCreditTotal(credits))
}

export function calculateCreditTotal(credits: Array<{ amount: number | string }>) {
  return credits.reduce((sum, row) => sum + Number(row.amount), 0)
}

export function outstandingChargeLabel(type: string, bookingStatus: string | null) {
  if (type === 'membership') return 'Membership fee'
  if (type === 'joining_fee') return 'Joining fee'
  if (type === 'lesson' && bookingStatus === 'attended') return 'Completed private lesson'
  if (type === 'lesson' && bookingStatus === 'no_show') return 'Missed private lesson'
  if (type === 'lesson' && bookingStatus === 'cancelled') return 'Late lesson cancellation'
  return 'Lesson charge'
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
  const { data, error } = await db.rpc('record_manual_invoice_payment', { target_invoice: invoiceId })
  if (error || !data) return { error: error?.message ?? 'Unpaid invoice not found' }
  void adminId
  return { success: true as const }
}
