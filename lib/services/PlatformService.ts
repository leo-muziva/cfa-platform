import 'server-only'
import { validationFailure } from '@/lib/validations/form-errors'
import { getCurrentAccountContext, getCurrentProfile, requireAdmin, requireStaff } from '@/lib/services/MemberService'
import { getMembershipTypes } from '@/lib/repositories/MemberRepository'
import {
  listOpenSlots, createSlot, createBooking, listBookings, createMembershipRequest,
  listMembershipRequestsForMember, listMembershipRequestsForAdmin, reviewMembershipRequest, getBillingForPayer, runInvoices, recordManualPayment, listAllInvoices,
  getMembership, resubmitMembership, changeMembershipStatus, listFamilyLinks, requestFamilyLink, respondFamilyLink, endFamilyLink,
} from '@/lib/repositories/PlatformRepository'
import { bookingSchema, lessonSlotSchema, membershipRequestSchema, membershipResubmissionSchema,
  membershipReviewSchema, membershipStatusChangeSchema, familyLinkRequestSchema,
  familyLinkResponseSchema, familyLinkEndSchema } from '@/lib/validations/member.schema'
import type { BookingErrorCode, LessonHistoryItem, MembershipOperationErrorCode, PayerBillingView } from '@/types/domain'

export type BookingResult = { bookingId: string } | { errorCode: BookingErrorCode }

const membershipErrorMessages: Record<MembershipOperationErrorCode, string> = {
  request_failed: 'Unable to submit the membership request. Please try again.',
  review_failed: 'Unable to update this membership request. Please try again.',
  resubmit_failed: 'Unable to resubmit the membership request. Please try again.',
  status_change_failed: 'Unable to change the membership status. Please try again.',
}

function safeMembershipResult(result: { success: true } | { errorCode: MembershipOperationErrorCode }) {
  return 'errorCode' in result ? { error: membershipErrorMessages[result.errorCode] } : result
}

export async function getBookingPageData() {
  const context = await getCurrentAccountContext()
  if ('error' in context) return context
  const links = await listFamilyLinks()
  const linkedDependents = links.filter((link) => link.status === 'active' && link.guardian_id === context.profile.id)
    .map((link) => ({ household_id: '', profile_id: link.dependent_id, household_role: 'dependent' as const,
      payer_consent_at: link.accepted_at, profile: link.dependent ? { ...link.dependent, membership_status: 'guest' as const } : undefined }))
  const participants = context.capabilities.isDependent ? context.householdMembers.filter((item) => item.profile_id === context.profile.id)
    : [...context.householdMembers.filter((item) => item.profile_id === context.profile.id), ...linkedDependents]
  return { ...context, bookingParticipants: participants, slots: await listOpenSlots() }
}

export async function bookLesson(raw: unknown): Promise<BookingResult> {
  const parsed = bookingSchema.safeParse(raw)
  if (!parsed.success) return { errorCode: 'invalid_input' }
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
  if (!parsed.success) return validationFailure(parsed.error)
  const guard = await requireAdmin()
  if ('error' in guard) return guard
  const slot = await createSlot({ ...parsed.data, capacity: parsed.data.capacity ?? null, coach_id: parsed.data.coach_id ?? null }, guard.profile.id)
  return slot ? { slot } : { error: 'Failed to create slot' }
}

export async function requestMembership(raw: unknown) {
  const parsed = membershipRequestSchema.safeParse(raw)
  if (!parsed.success) return validationFailure(parsed.error)
  const profile = await getCurrentProfile()
  if (!profile) return { error: 'Not authenticated' }
  if (profile.membership_status === 'member') return { error: 'This account is already a member' }
  return safeMembershipResult(await createMembershipRequest(profile.id, parsed.data.membership_type_id))
}

export async function getMembershipRequestPageData() {
  const profile = await getCurrentProfile()
  if (!profile) return { error: 'Not authenticated' } as const
  const requests = await listMembershipRequestsForMember(profile.id)
  return { profile, membership: await getMembership(profile.id), membershipTypes: await getMembershipTypes(), requests }
}

export async function getMembershipRequestsForAdmin() {
  const guard = await requireAdmin()
  return 'error' in guard ? guard : { requests: await listMembershipRequestsForAdmin() }
}

export async function decideMembershipRequest(raw: unknown) {
  const parsed = membershipReviewSchema.safeParse(raw)
  if (!parsed.success) return validationFailure(parsed.error)
  const guard = await requireAdmin()
  return 'error' in guard ? guard : safeMembershipResult(await reviewMembershipRequest(parsed.data.application_id, parsed.data.decision, parsed.data.visible_response, parsed.data.private_notes))
}

export async function resubmitMembershipRequest(raw: unknown) {
  const parsed = membershipResubmissionSchema.safeParse(raw)
  if (!parsed.success) return validationFailure(parsed.error)
  if (!await getCurrentProfile()) return { error: 'Not authenticated' }
  return safeMembershipResult(await resubmitMembership(parsed.data.application_id, parsed.data.membership_type_id))
}

export async function cancelCurrentMembership(confirmed: boolean) {
  const profile = await getCurrentProfile()
  if (!profile) return { error: 'Not authenticated' }
  if (!confirmed) return { error: 'Cancellation must be confirmed' }
  return safeMembershipResult(await changeMembershipStatus(profile.id, 'cancelled'))
}

export async function changeMembershipForAdmin(raw: unknown) {
  const parsed = membershipStatusChangeSchema.safeParse(raw)
  if (!parsed.success) return validationFailure(parsed.error)
  const guard = await requireAdmin()
  return 'error' in guard ? guard : safeMembershipResult(await changeMembershipStatus(parsed.data.profile_id, parsed.data.status))
}

export async function getFamilyAccountsPageData() {
  const profile = await getCurrentProfile()
  if (!profile) return { error: 'Not authenticated' } as const
  return { profile, links: await listFamilyLinks() }
}

export async function requestExistingAccountLink(raw: unknown) {
  const parsed = familyLinkRequestSchema.safeParse(raw)
  if (!parsed.success) return validationFailure(parsed.error)
  if (!await getCurrentProfile()) return { error: 'Not authenticated' }
  return requestFamilyLink(parsed.data.email)
}

export async function answerFamilyLink(raw: unknown) {
  const parsed = familyLinkResponseSchema.safeParse(raw)
  if (!parsed.success) return validationFailure(parsed.error)
  return respondFamilyLink(parsed.data.link_id, parsed.data.response)
}

export async function endActiveFamilyLink(raw: unknown) {
  const parsed = familyLinkEndSchema.safeParse(raw)
  if (!parsed.success) return validationFailure(parsed.error)
  return endFamilyLink(parsed.data.link_id)
}

export async function getPayerBilling(): Promise<PayerBillingView | { error: string }> {
  const context = await getCurrentAccountContext()
  if ('error' in context) return context
  if (!context.capabilities.canSeeHouseholdMoney) return { error: 'Forbidden' }
  return getBillingForPayer(context.profile.id) as Promise<PayerBillingView>
}

export async function runInvoicesForAdmin(period: string) {
  const guard = await requireStaff()
  return 'error' in guard ? guard : runInvoices(period)
}

export async function recordManualPaymentForAdmin(invoiceId: string) {
  const guard = await requireStaff()
  return 'error' in guard ? guard : recordManualPayment(invoiceId, guard.profile.id)
}

export async function getInvoicesForAdmin() {
  const guard = await requireStaff()
  return 'error' in guard ? guard : { invoices: await listAllInvoices() }
}
