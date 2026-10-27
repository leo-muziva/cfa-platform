// Membership applications, family links between guardians and dependents,
// the payer's billing view and manual invoicing. Also holds the original
// slot-based lesson booking, which the newer LessonBookingService replaced.
import 'server-only'
import { validationFailure, type FieldErrors } from '@/lib/validations/form-errors'
import { getCurrentAccountContext, getCurrentProfile, requireAdmin, requireStaff } from '@/lib/services/MemberService'
import { getMembershipTypes } from '@/lib/repositories/MemberRepository'
import {
  listOpenSlots, createSlot, createBooking, listBookings, createMembershipRequest,
  listMembershipRequestsForMember, listMembershipRequestsForAdmin, reviewMembershipRequest, getBillingForPayer, runInvoices, recordManualPayment, listAllInvoices,
  getMembership, resubmitMembership, changeMembershipStatus, listFamilyLinks, requestFamilyLink, respondFamilyLink, endFamilyLink,
  recordManualMembershipPayment, withdrawMembershipApproval, listMembershipPaymentsDue, getMembershipPaymentNotice,
  recordMembershipPaymentEmail,
} from '@/lib/repositories/PlatformRepository'
import { getEmailProvider } from '@/lib/providers/contracts'
import { onlinePaymentsAvailable } from '@/lib/services/payment-service'
import { bookingSchema, lessonSlotSchema, membershipRequestSchema, membershipResubmissionSchema,
  membershipReviewSchema, membershipStatusChangeSchema, membershipApplicationSchema, membershipWithdrawalSchema, familyLinkRequestSchema,
  familyLinkResponseSchema, familyLinkEndSchema } from '@/lib/validations/member.schema'
import type { BookingErrorCode, LessonHistoryItem, MembershipOperationErrorCode, MembershipPaymentEmailStatus, PayerBillingView } from '@/types/domain'
import { membershipPriceLabel } from '@/lib/membership-price-label'

export type BookingResult = { bookingId: string } | { errorCode: BookingErrorCode }

// User-facing text for each membership error code from the repository.
const membershipErrorMessages: Record<MembershipOperationErrorCode, string> = {
  request_failed: 'Unable to submit the membership request. Please try again.',
  review_failed: 'Unable to update this membership request. Please try again.',
  resubmit_failed: 'Unable to resubmit the membership request. Please try again.',
  status_change_failed: 'Unable to change the membership status. Please try again.',
  payment_record_failed: 'Unable to record the payment. Check the application is still awaiting payment.',
  withdraw_failed: 'Unable to withdraw this approval. Check the application is still awaiting payment.',
}

// Swaps an internal error code for its user-facing message.
function safeMembershipResult(result: { success: true } | { errorCode: MembershipOperationErrorCode }) {
  return 'errorCode' in result ? { error: membershipErrorMessages[result.errorCode] } : result
}

/**
 * Legacy slot booking: the open slots and who the member can book for.
 * No page uses this now; lesson booking lives in LessonBookingService.
 */
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

/** Legacy slot booking. Not used by any page; see LessonBookingService. */
export async function bookLesson(raw: unknown): Promise<BookingResult> {
  const parsed = bookingSchema.safeParse(raw)
  if (!parsed.success) return { errorCode: 'invalid_input' }
  return createBooking(parsed.data.lesson_slot_id, parsed.data.fencer_id, parsed.data.payment_option)
}

/** Legacy slot bookings for the signed-in member's household. */
export async function getLessonHistory(): Promise<{ items: LessonHistoryItem[] } | { error: string }> {
  const context = await getCurrentAccountContext()
  if ('error' in context) return context
  const bookings = await listBookings()
  return { items: bookings.map((booking) => ({
    id: booking.id, starts_at: booking.lesson_slot?.starts_at ?? '', ends_at: booking.lesson_slot?.ends_at ?? '',
    status: booking.status, fencer_id: booking.fencer_id, fencer_name: booking.fencer?.full_name ?? null,
  })) }
}

/** Legacy: admin creates a bookable lesson slot. Not used by any page. */
export async function createLessonSlotForAdmin(raw: unknown) {
  const parsed = lessonSlotSchema.safeParse(raw)
  if (!parsed.success) return validationFailure(parsed.error)
  const guard = await requireAdmin()
  if ('error' in guard) return guard
  const slot = await createSlot({ ...parsed.data, capacity: parsed.data.capacity ?? null, coach_id: parsed.data.coach_id ?? null }, guard.profile.id)
  return slot ? { slot } : { error: 'Failed to create slot' }
}

/** Submits a membership application for the signed-in guest. */
export async function requestMembership(raw: unknown) {
  const parsed = membershipRequestSchema.safeParse(raw)
  if (!parsed.success) return validationFailure(parsed.error)
  const profile = await getCurrentProfile()
  if (!profile) return { error: 'Not authenticated' }
  if (profile.membership_status === 'member') return { error: 'This account is already a member' }
  return safeMembershipResult(await createMembershipRequest(profile.id, parsed.data.membership_type_id))
}

// A membership choice on the application form.
export interface MembershipTypeOption {
  id: string
  code: string
  name: string
  // Null for dependents, who never receive financial information.
  priceLabel: string | null
}

/**
 * Everything the membership page needs: the current membership, past
 * applications, the plans to choose from and any approved memberships
 * waiting for payment. Prices are only included for people who can see
 * household money.
 */
export async function getMembershipRequestPageData() {
  const context = await getCurrentAccountContext()
  if ('error' in context) return { error: 'Not authenticated' } as const
  const { profile, capabilities } = context
  const canSeeMoney = capabilities.canSeeHouseholdMoney
  const [requests, membership, membershipTypes, paymentsDue] = await Promise.all([
    listMembershipRequestsForMember(profile.id),
    getMembership(profile.id),
    getMembershipTypes(),
    canSeeMoney ? listMembershipPaymentsDue() : Promise.resolve([]),
  ])
  const monthlyPrice = membershipTypes.find((type) => type.code === 'month_to_month')?.price ?? null
  return {
    profile,
    canSeeMoney,
    membership,
    requests,
    membershipTypes: membershipTypes.map((type): MembershipTypeOption => ({
      id: type.id,
      code: type.code,
      name: type.name,
      priceLabel: canSeeMoney ? membershipPriceLabel(type, monthlyPrice) : null,
    })),
    // This account's own approved application, when it is the payer.
    ownPaymentDue: paymentsDue.find((item) => item.applicantId === profile.id) ?? null,
    // Dependents' approved applications this payer also has to pay.
    dependentPaymentsDue: paymentsDue.filter((item) => item.applicantId !== profile.id),
    onlinePaymentsAvailable: onlinePaymentsAvailable(),
  }
}

/** The signed-in member's membership row, if they have one. */
export async function getCurrentMembership() {
  const profile = await getCurrentProfile()
  return profile ? getMembership(profile.id) : null
}

/** Approved memberships the signed-in payer still has to pay for. */
export async function getMembershipPaymentsDue() {
  const context = await getCurrentAccountContext()
  if ('error' in context || !context.capabilities.canSeeHouseholdMoney) return []
  return listMembershipPaymentsDue()
}

/** Every membership application, with private admin notes, for the review queue. */
export async function getMembershipRequestsForAdmin() {
  const guard = await requireAdmin()
  return 'error' in guard ? guard : { requests: await listMembershipRequestsForAdmin() }
}

// `emailStatus` reports the payment request email sent on approval.
export type MembershipDecisionResult =
  | { success: true; emailStatus: MembershipPaymentEmailStatus | null }
  | { error: string; fieldErrors?: FieldErrors }

/**
 * Admin approves, rejects or asks for changes to an application. Approval
 * emails the payer a link to pay; the membership starts once it is paid.
 */
export async function decideMembershipRequest(raw: unknown): Promise<MembershipDecisionResult> {
  const parsed = membershipReviewSchema.safeParse(raw)
  if (!parsed.success) return validationFailure(parsed.error)
  const guard = await requireAdmin()
  if ('error' in guard) return guard
  const result = safeMembershipResult(await reviewMembershipRequest(parsed.data.application_id, parsed.data.decision, parsed.data.visible_response, parsed.data.private_notes))
  if ('error' in result) return result
  // The approval stands whatever happens to the email; staff can resend it.
  const emailStatus = parsed.data.decision === 'approve' ? await notifyMembershipApproved(parsed.data.application_id) : null
  return { success: true, emailStatus }
}

/**
 * Where the payment email sends people: their own membership page, or
 * billing for a guardian. The link always points into the signed-in portal;
 * payment never happens from the email itself.
 */
export function membershipPayUrl(origin: string, payerIsApplicant: boolean) {
  return `${origin.replace(/\/+$/, '')}${payerIsApplicant ? '/protected/membership' : '/protected/billing'}`
}

// Public site origin for links in emails, or null when not configured.
function siteOrigin(): string | null {
  const candidate = process.env.NEXT_PUBLIC_SITE_URL || process.env.PAYMENT_PUBLIC_ORIGIN
  if (!candidate) return null
  try {
    return new URL(candidate).origin
  } catch {
    return null
  }
}

/**
 * Emails the payer that an approved membership is waiting for payment and
 * records the outcome on the application so staff can see it.
 */
async function notifyMembershipApproved(applicationId: string): Promise<MembershipPaymentEmailStatus> {
  const provider = getEmailProvider()
  const origin = siteOrigin()
  const notice = await getMembershipPaymentNotice(applicationId)
  let outcome: MembershipPaymentEmailStatus
  if (!provider || !origin) {
    outcome = 'not_configured'
  } else if (!notice?.payerEmail) {
    outcome = 'failed'
  } else {
    const payerIsApplicant = notice.payerId === notice.applicantId
    const sent = await provider.sendMembershipPaymentRequest({
      to: notice.payerEmail,
      recipientName: notice.payerName,
      applicantName: notice.applicantName,
      recipientIsApplicant: payerIsApplicant,
      membershipName: notice.membershipName,
      amountCents: notice.totalCents,
      payUrl: membershipPayUrl(origin, payerIsApplicant),
    })
    outcome = sent.ok ? 'sent' : 'failed'
  }
  await recordMembershipPaymentEmail(applicationId, outcome)
  return outcome
}

/** Admin resends the payment request email for an approved application. */
export async function resendMembershipPaymentEmail(raw: unknown) {
  const parsed = membershipApplicationSchema.safeParse(raw)
  if (!parsed.success) return validationFailure(parsed.error)
  const guard = await requireAdmin()
  if ('error' in guard) return guard
  return { success: true as const, emailStatus: await notifyMembershipApproved(parsed.data.application_id) }
}

/** Staff mark an approved membership as paid outside the website (cash or EFT). */
export async function recordManualMembershipPaymentForAdmin(raw: unknown) {
  const parsed = membershipApplicationSchema.safeParse(raw)
  if (!parsed.success) return validationFailure(parsed.error)
  const guard = await requireStaff()
  return 'error' in guard ? guard : safeMembershipResult(await recordManualMembershipPayment(parsed.data.application_id))
}

/** Admin withdraws an approval that has not been paid yet. */
export async function withdrawMembershipApprovalForAdmin(raw: unknown) {
  const parsed = membershipWithdrawalSchema.safeParse(raw)
  if (!parsed.success) return validationFailure(parsed.error)
  const guard = await requireAdmin()
  return 'error' in guard ? guard : safeMembershipResult(await withdrawMembershipApproval(parsed.data.application_id, parsed.data.visible_response))
}

/** Applicant resubmits after staff asked for changes, optionally on a different plan. */
export async function resubmitMembershipRequest(raw: unknown) {
  const parsed = membershipResubmissionSchema.safeParse(raw)
  if (!parsed.success) return validationFailure(parsed.error)
  if (!await getCurrentProfile()) return { error: 'Not authenticated' }
  return safeMembershipResult(await resubmitMembership(parsed.data.application_id, parsed.data.membership_type_id))
}

/** The signed-in member cancels their own membership. Requires explicit confirmation. */
export async function cancelCurrentMembership(confirmed: boolean) {
  const profile = await getCurrentProfile()
  if (!profile) return { error: 'Not authenticated' }
  if (!confirmed) return { error: 'Cancellation must be confirmed' }
  return safeMembershipResult(await changeMembershipStatus(profile.id, 'cancelled'))
}

/** Admin sets a member's membership status directly. */
export async function changeMembershipForAdmin(raw: unknown) {
  const parsed = membershipStatusChangeSchema.safeParse(raw)
  if (!parsed.success) return validationFailure(parsed.error)
  const guard = await requireAdmin()
  return 'error' in guard ? guard : safeMembershipResult(await changeMembershipStatus(parsed.data.profile_id, parsed.data.status))
}

/** The signed-in person's guardian and dependent links. */
export async function getFamilyAccountsPageData() {
  const profile = await getCurrentProfile()
  if (!profile) return { error: 'Not authenticated' } as const
  return { profile, links: await listFamilyLinks() }
}

/** Asks an existing account (by email) to join this person's family link. */
export async function requestExistingAccountLink(raw: unknown) {
  const parsed = familyLinkRequestSchema.safeParse(raw)
  if (!parsed.success) return validationFailure(parsed.error)
  if (!await getCurrentProfile()) return { error: 'Not authenticated' }
  return requestFamilyLink(parsed.data.email)
}

/** Accepts or rejects a family link request; the RPC checks it is addressed to the caller. */
export async function answerFamilyLink(raw: unknown) {
  const parsed = familyLinkResponseSchema.safeParse(raw)
  if (!parsed.success) return validationFailure(parsed.error)
  return respondFamilyLink(parsed.data.link_id, parsed.data.response)
}

/** Ends an active family link; the RPC decides who is allowed to. */
export async function endActiveFamilyLink(raw: unknown) {
  const parsed = familyLinkEndSchema.safeParse(raw)
  if (!parsed.success) return validationFailure(parsed.error)
  return endFamilyLink(parsed.data.link_id)
}

/** The payer's billing page: balance, outstanding charges, invoices and receipts. Payers only. */
export async function getPayerBilling(): Promise<PayerBillingView | { error: string }> {
  const context = await getCurrentAccountContext()
  if ('error' in context) return context
  if (!context.capabilities.canSeeHouseholdMoney) return { error: 'Forbidden' }
  const billing = await getBillingForPayer(context.profile.id) as PayerBillingView
  // The repository only knows a gateway exists; checkout also needs the public
  // return origin, so use the same check the payment service enforces.
  return { ...billing, providerAvailable: onlinePaymentsAvailable() }
}

/** Staff generate invoices for a billing period. */
export async function runInvoicesForAdmin(period: string) {
  const guard = await requireStaff()
  return 'error' in guard ? guard : runInvoices(period)
}

/** Staff mark an invoice as paid outside the website. */
export async function recordManualPaymentForAdmin(invoiceId: string) {
  const guard = await requireStaff()
  return 'error' in guard ? guard : recordManualPayment(invoiceId, guard.profile.id)
}

/** Every invoice, for the staff invoicing page. */
export async function getInvoicesForAdmin() {
  const guard = await requireStaff()
  return 'error' in guard ? guard : { invoices: await listAllInvoices() }
}
