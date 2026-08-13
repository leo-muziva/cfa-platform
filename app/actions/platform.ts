'use server'

import { revalidatePath } from 'next/cache'
import {
  bookLesson, createLessonSlotForAdmin, requestMembership, decideMembershipRequest,
  runInvoicesForAdmin, recordManualPaymentForAdmin, resubmitMembershipRequest,
  cancelCurrentMembership, changeMembershipForAdmin, requestExistingAccountLink,
  answerFamilyLink, endActiveFamilyLink,
} from '@/lib/services/PlatformService'
import { bookingErrorMessage } from '@/lib/booking-errors'

export type ActionState = { error?: string; success?: string }

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

export async function createSlotAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const result = await createLessonSlotForAdmin({
    starts_at: new Date(String(formData.get('starts_at'))).toISOString(),
    ends_at: new Date(String(formData.get('ends_at'))).toISOString(),
    price: formData.get('price'), capacity: formData.get('capacity') || null,
    coach_id: formData.get('coach_id') || null,
    access_rule: formData.get('access_rule'),
  })
  if ('error' in result) return { error: result.error }
  revalidatePath('/protected/admin/lessons')
  return { success: 'Lesson slot opened' }
}

export async function requestMembershipAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const result = await requestMembership({ membership_type_id: formData.get('membership_type_id') })
  if ('error' in result) return { error: result.error }
  revalidatePath('/protected/membership-request')
  return { success: 'Membership request submitted for staff approval' }
}

export async function decideMembershipRequestAction(formData: FormData) {
  await decideMembershipRequest({ application_id: formData.get('application_id'), decision: formData.get('decision'),
    visible_response: formData.get('visible_response'), private_notes: formData.get('private_notes') })
  revalidatePath('/protected/admin/membership-requests')
}

export async function resubmitMembershipAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const result = await resubmitMembershipRequest({ application_id: formData.get('application_id'), membership_type_id: formData.get('membership_type_id') })
  if ('error' in result) return { error: result.error }
  revalidatePath('/protected/membership-request'); return { success: 'Membership application resubmitted' }
}

export async function cancelMembershipAction(formData: FormData) {
  await cancelCurrentMembership(formData.get('confirm') === 'yes')
  revalidatePath('/protected/membership-request')
}

export async function changeMembershipStatusAction(formData: FormData) {
  await changeMembershipForAdmin({ profile_id: formData.get('profile_id'), status: formData.get('status') })
  revalidatePath('/protected/admin/membership-requests')
}

export async function requestFamilyLinkAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const result = await requestExistingAccountLink({ email: formData.get('email') })
  if ('error' in result) return { error: result.error }
  revalidatePath('/protected/family'); return { success: 'If that account exists, a request has been sent' }
}

export async function answerFamilyLinkAction(formData: FormData) {
  await answerFamilyLink({ link_id: formData.get('link_id'), response: formData.get('response') })
  revalidatePath('/protected/family')
}

export async function endFamilyLinkAction(formData: FormData) {
  await endActiveFamilyLink({ link_id: formData.get('link_id') })
  revalidatePath('/protected/family')
}

export async function runInvoicesAction(formData: FormData) {
  await runInvoicesForAdmin(String(formData.get('period')))
  revalidatePath('/protected/admin/invoicing')
}

export async function recordManualPaymentAction(formData: FormData) {
  await recordManualPaymentForAdmin(String(formData.get('invoice_id')))
  revalidatePath('/protected/admin/invoicing')
  revalidatePath('/protected/admin/payments')
}
