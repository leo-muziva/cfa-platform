'use server'

import { revalidatePath } from 'next/cache'
import {
  bookLesson, createLessonSlotForAdmin, requestMembership, decideMembershipRequest,
  runInvoicesForAdmin, recordManualPaymentForAdmin,
} from '@/lib/services/PlatformService'

export type ActionState = { error?: string; success?: string }

export async function bookLessonAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const result = await bookLesson({
    lesson_slot_id: formData.get('lesson_slot_id'), fencer_id: formData.get('fencer_id'),
    payment_option: formData.get('payment_option'),
  })
  if ('error' in result) return { error: result.error }
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
  const decision = formData.get('decision') === 'approved' ? 'approved' : 'declined'
  await decideMembershipRequest(String(formData.get('request_id')), decision)
  revalidatePath('/protected/admin/membership-requests')
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
