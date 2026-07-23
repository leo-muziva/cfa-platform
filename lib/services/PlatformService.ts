import 'server-only'
import { getCurrentAccountContext, getCurrentProfile, requireAdmin } from '@/lib/services/MemberService'
import { getMembershipTypes } from '@/lib/repositories/MemberRepository'
import {
  listOpenSlots, createSlot, createBooking, listBookings, createMembershipRequest,
  listMembershipRequests, reviewMembershipRequest, getBillingForPayer, runInvoices, recordManualPayment, listAllInvoices,
} from '@/lib/repositories/PlatformRepository'
import { bookingSchema, lessonSlotSchema, membershipRequestSchema } from '@/lib/validations/member.schema'
import type { LessonHistoryItem, PayerBillingView } from '@/types/domain'

export async function getBookingPageData() {
  const context = await getCurrentAccountContext()
  if ('error' in context) return context
  return { ...context, slots: await listOpenSlots() }
}

export async function bookLesson(raw: unknown) {
  const parsed = bookingSchema.safeParse(raw)
  if (!parsed.success) return { error: parsed.error.issues[0].message }
  return createBooking(parsed.data.lesson_slot_id, parsed.data.fencer_id, parsed.data.payment_option)
}

export async function getLessonHistory(): Promise<{ items: LessonHistoryItem[] } | { error: string }> {
  const context = await getCurrentAccountContext()
  if ('error' in context) return context
  const bookings = await listBookings()
  return { items: bookings.map((booking) => ({
    id: booking.id, starts_at: booking.lesson_slot?.starts_at ?? '', ends_at: booking.lesson_slot?.ends_at ?? '',
    status: booking.status, fencer_id: booking.fencer_id, fencer_name: booking.fencer?.full_name ?? null,
  })) }
}

export async function createLessonSlotForAdmin(raw: unknown) {
  const parsed = lessonSlotSchema.safeParse(raw)
  if (!parsed.success) return { error: parsed.error.issues[0].message }
  const guard = await requireAdmin()
  if ('error' in guard) return guard
  const slot = await createSlot({ ...parsed.data, capacity: parsed.data.capacity ?? null, coach_id: parsed.data.coach_id ?? null }, guard.profile.id)
  return slot ? { slot } : { error: 'Failed to create slot' }
}

export async function requestMembership(raw: unknown) {
  const parsed = membershipRequestSchema.safeParse(raw)
  if (!parsed.success) return { error: parsed.error.issues[0].message }
  const profile = await getCurrentProfile()
  if (!profile) return { error: 'Not authenticated' }
  if (profile.membership_status === 'member') return { error: 'This account is already a member' }
  return createMembershipRequest(profile.id, parsed.data.membership_type_id)
}

export async function getMembershipRequestPageData() {
  const profile = await getCurrentProfile()
  if (!profile) return { error: 'Not authenticated' } as const
  const requests = await listMembershipRequests()
  return { profile, membershipTypes: await getMembershipTypes(), requests: requests.filter((r) => r.applicant_id === profile.id) }
}

export async function getMembershipRequestsForAdmin() {
  const guard = await requireAdmin()
  return 'error' in guard ? guard : { requests: await listMembershipRequests() }
}

export async function decideMembershipRequest(id: string, decision: 'approved' | 'declined') {
  const guard = await requireAdmin()
  return 'error' in guard ? guard : reviewMembershipRequest(id, decision)
}

export async function getPayerBilling(): Promise<PayerBillingView | { error: string }> {
  const context = await getCurrentAccountContext()
  if ('error' in context) return context
  if (!context.capabilities.canSeeHouseholdMoney) return { error: 'Forbidden' }
  return getBillingForPayer(context.household.household_role === 'payer' ? context.profile.id : '') as Promise<PayerBillingView>
}

export async function runInvoicesForAdmin(period: string) {
  const guard = await requireAdmin()
  return 'error' in guard ? guard : runInvoices(period)
}

export async function recordManualPaymentForAdmin(invoiceId: string) {
  const guard = await requireAdmin()
  return 'error' in guard ? guard : recordManualPayment(invoiceId, guard.profile.id)
}

export async function getInvoicesForAdmin() {
  const guard = await requireAdmin()
  return 'error' in guard ? guard : { invoices: await listAllInvoices() }
}
