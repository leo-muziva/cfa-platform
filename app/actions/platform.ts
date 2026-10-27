'use server'

// Server Actions for memberships, family links and invoicing.
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import {
  bookLesson, createLessonSlotForAdmin, requestMembership, decideMembershipRequest,
  runInvoicesForAdmin, recordManualPaymentForAdmin, resubmitMembershipRequest,
  cancelCurrentMembership, changeMembershipForAdmin, requestExistingAccountLink,
  answerFamilyLink, endActiveFamilyLink, recordManualMembershipPaymentForAdmin,
  resendMembershipPaymentEmail, withdrawMembershipApprovalForAdmin,
} from '@/lib/services/PlatformService'
import { bookingErrorMessage } from '@/lib/booking-errors'
import { failureState } from '@/lib/validations/form-errors'
import type { FormFieldState, MembershipPaymentEmailStatus } from '@/types/domain'

// The common form state: field errors plus a success message.
export type ActionState = FormFieldState & { success?: string }

/** Legacy slot booking. No form uses it now; see app/actions/lessons.ts. */
export async function bookLessonAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const result = await bookLesson({
    lesson_slot_id: formData.get('lesson_slot_id'), fencer_id: formData.get('fencer_id'),
    payment_option: formData.get('payment_option'),
  })
  if ('errorCode' in result) return { error: bookingErrorMessage(result.errorCode) }
  revalidatePath('/protected/book')
  revalidatePath('/protected/lessons')
  return { success: 'Lesson booked successfully' }
}

/** Legacy: admin opens a lesson slot. No form uses it now. */
export async function createSlotAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const result = await createLessonSlotForAdmin({
    starts_at: new Date(String(formData.get('starts_at'))).toISOString(),
    ends_at: new Date(String(formData.get('ends_at'))).toISOString(),
    price: formData.get('price'), capacity: formData.get('capacity') || null,
    coach_id: formData.get('coach_id') || null,
    access_rule: formData.get('access_rule'),
  })
  if ('error' in result) return failureState(result)
  revalidatePath('/protected/admin/lessons')
  return { success: 'Lesson slot opened' }
}

/** Submits a membership application. */
export async function requestMembershipAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const result = await requestMembership({ membership_type_id: formData.get('membership_type_id') })
  if ('error' in result) return failureState(result)
  revalidatePath('/protected')
  revalidateMembershipViews()
  return { success: 'Membership request submitted for staff approval' }
}

/** Admin approves, rejects or asks for changes, and reports the payment email outcome. */
export async function decideMembershipRequestAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const result = await decideMembershipRequest({ application_id: formData.get('application_id'), decision: formData.get('decision'),
    visible_response: formData.get('visible_response'), private_notes: formData.get('private_notes') })
  if ('error' in result) return failureState(result)
  revalidatePath('/protected/admin/membership-requests')
  revalidatePath('/protected')
  revalidateMembershipViews()
  return { success: result.emailStatus ? `Approved. ${emailStatusMessage(result.emailStatus)}` : 'Membership request updated successfully' }
}

// Pages that show membership or money owed for it.
function revalidateMembershipViews() {
  revalidatePath('/protected/membership')
  revalidatePath('/protected/billing')
}

// Tells staff what happened to the payment request email.
function emailStatusMessage(status: MembershipPaymentEmailStatus) {
  if (status === 'sent') return 'The payment email has been sent.'
  if (status === 'not_configured') return 'Email is not configured, so let the payer know payment is due.'
  return 'The payment email could not be sent. Use Resend payment email to try again.'
}

/** Staff record a membership paid in person, which activates it. */
export async function recordManualMembershipPaymentAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const applicationId = formData.get('application_id')
  const result = await recordManualMembershipPaymentForAdmin({ application_id: applicationId })
  if ('error' in result) return failureState(result)
  revalidatePath('/protected/admin/membership-requests')
  revalidateMembershipViews()
  // The card leaves the awaiting-payment list, so the page shows the confirmation.
  redirect(`/protected/admin/membership-requests?activated=${encodeURIComponent(String(applicationId))}`)
}

/** Admin resends the payment request email. */
export async function resendMembershipPaymentEmailAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const result = await resendMembershipPaymentEmail({ application_id: formData.get('application_id') })
  if ('error' in result) return failureState(result)
  revalidatePath('/protected/admin/membership-requests')
  return result.emailStatus === 'sent' ? { success: emailStatusMessage('sent') } : { error: emailStatusMessage(result.emailStatus) }
}

/** Admin withdraws an unpaid approval. */
export async function withdrawMembershipApprovalAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const applicationId = formData.get('application_id')
  const result = await withdrawMembershipApprovalForAdmin({
    application_id: applicationId, visible_response: formData.get('visible_response'),
  })
  if ('error' in result) return failureState(result)
  revalidatePath('/protected/admin/membership-requests')
  revalidateMembershipViews()
  redirect(`/protected/admin/membership-requests?withdrawn=${encodeURIComponent(String(applicationId))}`)
}

/** Applicant resubmits after staff asked for changes. */
export async function resubmitMembershipAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const result = await resubmitMembershipRequest({ application_id: formData.get('application_id'), membership_type_id: formData.get('membership_type_id') })
  if ('error' in result) return failureState(result)
  revalidatePath('/protected'); revalidateMembershipViews(); return { success: 'Membership application resubmitted' }
}

/** The member cancels their own membership (the form must send confirm=yes). */
export async function cancelMembershipAction(formData: FormData) {
  await cancelCurrentMembership(formData.get('confirm') === 'yes')
  revalidatePath('/protected')
  revalidateMembershipViews()
}

/** Admin changes a membership's status. */
export async function changeMembershipStatusAction(formData: FormData) {
  await changeMembershipForAdmin({ profile_id: formData.get('profile_id'), status: formData.get('status') })
  revalidatePath('/protected/admin/membership-requests')
}

/**
 * Asks an existing account to link as a dependent. The message is the same
 * whether or not the email exists, so it cannot be used to find accounts.
 */
export async function requestFamilyLinkAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const result = await requestExistingAccountLink({ email: formData.get('email') })
  if ('error' in result) return failureState(result)
  revalidatePath('/protected/family'); return { success: 'If that account exists, a request has been sent' }
}

/** Accepts or rejects a family link request. */
export async function answerFamilyLinkAction(formData: FormData) {
  await answerFamilyLink({ link_id: formData.get('link_id'), response: formData.get('response') })
  revalidatePath('/protected/family')
}

/** Ends an active family link. */
export async function endFamilyLinkAction(formData: FormData) {
  await endActiveFamilyLink({ link_id: formData.get('link_id') })
  revalidatePath('/protected/family')
}

/** Staff generate (or update) invoices for a period. */
export async function runInvoicesAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const result = await runInvoicesForAdmin(String(formData.get('period')))
  if ('error' in result) return { error: `Invoices could not be generated: ${result.error}` }
  revalidatePath('/protected/admin/invoicing')
  return { success: result.count === 1 ? '1 invoice generated or updated.' : `${result.count} invoices generated or updated.` }
}

/** Staff mark an invoice as paid offline. */
export async function recordManualPaymentAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const result = await recordManualPaymentForAdmin(String(formData.get('invoice_id')))
  if ('error' in result) return { error: `Payment could not be recorded: ${result.error}` }
  revalidatePath('/protected/admin/invoicing')
  revalidatePath('/protected/admin/payments')
  return { success: 'Manual payment recorded.' }
}
