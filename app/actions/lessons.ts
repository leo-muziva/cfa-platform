'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { startPayment } from '@/lib/services/payment-service'
import {
  cancelClubClosureForAdmin,
  cancelCoachFutureBookingsForAdmin,
  cancelLessonBooking,
  createClubClosureForAdmin,
  createCoachAvailabilityException,
  createCoachAvailabilityRule,
  createLessonBooking,
  deleteCoachAvailabilityException,
  deleteCoachAvailabilityRule,
  previewClubClosureForAdmin,
  previewCoachAvailabilityExceptionForCoach,
  recordLessonOutcome,
  rescheduleLessonBooking,
  setCoachLessonProfileForAdmin,
  updateLessonSettingsForAdmin,
  waiveLessonChargesForAdmin,
} from '@/lib/services/LessonBookingService'
import type { ClosureAffectedBooking, FormFieldState, LessonBookingErrorCode } from '@/types/domain'
import { capeTownDateTimeToIso } from '@/lib/cape-town-time'

export type LessonActionState = FormFieldState & {
  errorCode?: LessonBookingErrorCode
  success?: string
  bookingId?: string
  checkoutRequired?: boolean
}

type OperationResult = { success: true; data: unknown } | { success: false; error: string; errorCode: LessonBookingErrorCode; fieldErrors?: Record<string, string> }

function actionResult(result: OperationResult, success: string): LessonActionState {
  return result.success ? { success } : { error: result.error, errorCode: result.errorCode, fieldErrors: result.fieldErrors }
}

// Preview actions return the affected-bookings list itself, not a status
// string, so they don't fit the useActionState (prevState, formData) shape
// the rest of this file uses. Called directly from a client component.
export type PreviewActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string; errorCode: LessonBookingErrorCode }

export async function previewClosureImpactAction(raw: { startsOn: string; endsOn: string }): Promise<PreviewActionResult<ClosureAffectedBooking[]>> {
  const result = await previewClubClosureForAdmin(raw)
  return result.success ? { success: true, data: result.data } : { success: false, error: result.error, errorCode: result.errorCode }
}

export async function previewCoachAvailabilityExceptionImpactAction(raw: { coachId: string; startsAt: string; endsAt: string }): Promise<PreviewActionResult<ClosureAffectedBooking[]>> {
  const result = await previewCoachAvailabilityExceptionForCoach(raw)
  return result.success ? { success: true, data: result.data } : { success: false, error: result.error, errorCode: result.errorCode }
}

function value(formData: FormData, camelName: string, snakeName?: string) {
  return formData.get(camelName) ?? (snakeName ? formData.get(snakeName) : null)
}

function checked(input: FormDataEntryValue | null) {
  return input === 'true' || input === 'on' || input === 'yes' || input === '1'
}

function optionalValue(formData: FormData, camelName: string, snakeName?: string) {
  const input = value(formData, camelName, snakeName)
  return input === null || input === '' ? undefined : input
}

function isoDateTime(input: FormDataEntryValue | null) {
  return capeTownDateTimeToIso(input)
}

export async function createLessonBookingAction(_: LessonActionState, formData: FormData): Promise<LessonActionState> {
  const camelParticipants = formData.getAll('participantIds')
  const participantIds = camelParticipants.length > 0 ? camelParticipants : formData.getAll('participant_ids')
  const result = await createLessonBooking({
    coachId: value(formData, 'coachId', 'coach_id'),
    startsAt: isoDateTime(value(formData, 'startsAt', 'starts_at')),
    participantIds,
    weapon: formData.get('weapon'),
    paymentOption: formData.get('paymentOption') ?? 'pay_later',
  })
  if (!result.success) return actionResult(result, '')
  revalidatePath('/protected/book')
  revalidatePath('/protected/lessons')
  revalidatePath('/protected/billing')
  const bookingId = result.data.bookingId
  if (formData.get('paymentOption') !== 'pay_now') {
    return { success: 'Lesson booked successfully.', bookingId }
  }
  // The hold exists now, so go straight to checkout. If checkout cannot
  // start, the hold stays payable from My lessons and Billing until expiry.
  const payment = await startPayment({ bookingId })
  if (payment.ok) redirect(`/api/payments/checkout?attempt=${encodeURIComponent(payment.attemptId)}`)
  return {
    success: 'Lesson held. Pay for it from My lessons or Billing before the hold expires.',
    error: payment.error,
    bookingId,
    checkoutRequired: true,
  }
}

export async function cancelLessonBookingAction(_: LessonActionState, formData: FormData): Promise<LessonActionState> {
  const result = await cancelLessonBooking({
    bookingId: value(formData, 'bookingId', 'booking_id'), reason: formData.get('reason'),
  })
  if (!result.success) return actionResult(result, '')
  revalidateLessonPaths()
  return { success: 'Lesson cancelled.' }
}

export async function rescheduleLessonBookingAction(_: LessonActionState, formData: FormData): Promise<LessonActionState> {
  const result = await rescheduleLessonBooking({
    bookingId: value(formData, 'bookingId', 'booking_id'),
    startsAt: isoDateTime(value(formData, 'startsAt', 'starts_at')),
  })
  if (!result.success) return actionResult(result, '')
  revalidateLessonPaths()
  return { success: 'Lesson rescheduled.' }
}

export async function recordLessonOutcomeAction(_: LessonActionState, formData: FormData): Promise<LessonActionState> {
  const result = await recordLessonOutcome({
    bookingId: value(formData, 'bookingId', 'booking_id'), outcome: formData.get('outcome'),
    participantId: formData.get('participantId') ?? undefined,
  })
  if (!result.success) return actionResult(result, '')
  revalidateLessonPaths()
  return { success: 'Lesson outcome recorded.' }
}

export async function updateLessonSettingsAction(_: LessonActionState, formData: FormData): Promise<LessonActionState> {
  const result = await updateLessonSettingsForAdmin({
    cancellationWindowHours: optionalValue(formData, 'cancellationWindowHours', 'cancellation_window_hours'),
    lateCancellationFeeMultiplier: optionalValue(formData, 'lateCancellationFeeMultiplier', 'late_cancellation_fee_multiplier'),
    noShowFeeMultiplier: optionalValue(formData, 'noShowFeeMultiplier', 'no_show_fee_multiplier'),
    cancellationPartialWindowHours: optionalValue(formData, 'cancellationPartialWindowHours', 'cancellation_partial_window_hours'),
    cancellationPartialFeeMultiplier: optionalValue(formData, 'cancellationPartialFeeMultiplier', 'cancellation_partial_fee_multiplier'),
    bookingHorizonCalendarMonths: optionalValue(formData, 'bookingHorizonCalendarMonths', 'booking_horizon_calendar_months'),
    bookingCutoffMinutes: optionalValue(formData, 'bookingCutoffMinutes', 'booking_cutoff_minutes'),
    dropInFeeRands: optionalValue(formData, 'dropInFeeRands', 'drop_in_fee_rands'),
  })
  if (!result.success) return actionResult(result, '')
  revalidatePath('/protected/admin/lessons')
  revalidatePath('/protected/admin/lesson-settings')
  return { success: 'Lesson settings updated.' }
}

export async function setCoachLessonProfileAction(_: LessonActionState, formData: FormData): Promise<LessonActionState> {
  const result = await setCoachLessonProfileForAdmin({
    coachId: value(formData, 'coachId', 'coach_id'),
    isActive: checked(value(formData, 'isActive', 'is_active')),
    weapons: formData.getAll('weapons'),
  })
  if (!result.success) return actionResult(result, '')
  revalidatePath('/protected/admin/coaches')
  revalidatePath('/protected/book')
  return { success: 'Coach lesson offering updated.' }
}

export async function createCoachAvailabilityRuleAction(_: LessonActionState, formData: FormData): Promise<LessonActionState> {
  const result = await createCoachAvailabilityRule({
    coachId: value(formData, 'coachId', 'coach_id'),
    isoWeekday: value(formData, 'isoWeekday', 'iso_weekday'),
    startsAtLocal: value(formData, 'startsAtLocal', 'starts_at_local'),
    endsAtLocal: value(formData, 'endsAtLocal', 'ends_at_local'),
    accessRule: formData.get('membersOnly') === 'on' ? 'active_members_only' : 'guest_allowed',
  })
  if (!result.success) return actionResult(result, '')
  revalidateAvailabilityPaths()
  return { success: 'Standing availability added.' }
}

export async function deleteCoachAvailabilityRuleAction(_: LessonActionState, formData: FormData): Promise<LessonActionState> {
  const result = await deleteCoachAvailabilityRule({ ruleId: value(formData, 'ruleId', 'rule_id') })
  if (!result.success) return actionResult(result, '')
  revalidateAvailabilityPaths()
  return { success: 'Standing availability removed.' }
}

export async function createCoachAvailabilityExceptionAction(_: LessonActionState, formData: FormData): Promise<LessonActionState> {
  const result = await createCoachAvailabilityException({
    coachId: value(formData, 'coachId', 'coach_id'),
    exceptionType: value(formData, 'exceptionType', 'exception_type'),
    startsAt: isoDateTime(value(formData, 'startsAt', 'starts_at')),
    endsAt: isoDateTime(value(formData, 'endsAt', 'ends_at')),
    reason: formData.get('reason'),
    cancelAffected: checked(value(formData, 'cancelAffected', 'cancel_affected')),
  })
  if (!result.success) return actionResult(result, '')
  revalidateAvailabilityPaths()
  revalidateLessonPaths()
  return { success: 'Availability exception added.' }
}

export async function deleteCoachAvailabilityExceptionAction(_: LessonActionState, formData: FormData): Promise<LessonActionState> {
  const result = await deleteCoachAvailabilityException({ exceptionId: value(formData, 'exceptionId', 'exception_id') })
  if (!result.success) return actionResult(result, '')
  revalidateAvailabilityPaths()
  return { success: 'Availability exception removed.' }
}

export async function createClubClosureAction(_: LessonActionState, formData: FormData): Promise<LessonActionState> {
  const result = await createClubClosureForAdmin({
    startsOn: value(formData, 'startsOn', 'starts_on'), endsOn: value(formData, 'endsOn', 'ends_on'),
    reason: formData.get('reason'), cancelAffected: checked(value(formData, 'cancelAffected', 'cancel_affected')),
  })
  if (!result.success) return actionResult(result, '')
  revalidatePath('/protected/admin/closures')
  revalidateLessonPaths()
  return { success: 'Club closure created.' }
}

export async function cancelClubClosureAction(_: LessonActionState, formData: FormData): Promise<LessonActionState> {
  const result = await cancelClubClosureForAdmin({ closureId: value(formData, 'closureId', 'closure_id') })
  if (!result.success) return actionResult(result, '')
  revalidatePath('/protected/admin/closures')
  return { success: 'Club closure removed.' }
}

export async function cancelCoachFutureBookingsAction(_: LessonActionState, formData: FormData): Promise<LessonActionState> {
  const result = await cancelCoachFutureBookingsForAdmin({
    coachId: value(formData, 'coachId', 'coach_id'), reason: formData.get('reason'),
  })
  if (!result.success) return actionResult(result, '')
  revalidateLessonPaths()
  revalidatePath('/protected/admin/coaches')
  return { success: `${result.data.count} future lesson${result.data.count === 1 ? '' : 's'} cancelled at no charge.` }
}

export async function waiveLessonChargesAction(_: LessonActionState, formData: FormData): Promise<LessonActionState> {
  const result = await waiveLessonChargesForAdmin({
    bookingId: value(formData, 'bookingId', 'booking_id'), reason: formData.get('reason'),
  })
  if (!result.success) return actionResult(result, '')
  revalidateLessonPaths()
  revalidatePath('/protected/billing')
  return { success: 'Lesson charges waived.' }
}

function revalidateLessonPaths() {
  revalidatePath('/protected/lessons')
  revalidatePath('/protected/coach')
  revalidatePath('/protected/admin/lessons')
  revalidatePath('/protected/book')
}

function revalidateAvailabilityPaths() {
  revalidatePath('/protected/coach/availability')
  revalidatePath('/protected/admin/lessons')
  revalidatePath('/protected/book')
}
