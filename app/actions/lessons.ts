'use server'

import { revalidatePath } from 'next/cache'
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
  recordLessonOutcome,
  rescheduleLessonBooking,
  setCoachLessonProfileForAdmin,
  updateLessonSettingsForAdmin,
  waiveLessonChargesForAdmin,
} from '@/lib/services/LessonBookingService'
import type { LessonBookingErrorCode } from '@/types/domain'
import { capeTownDateTimeToIso } from '@/lib/cape-town-time'

export type LessonActionState = {
  error?: string
  errorCode?: LessonBookingErrorCode
  success?: string
}

type OperationResult = { success: true; data: unknown } | { success: false; error: string; errorCode: LessonBookingErrorCode }

function actionResult(result: OperationResult, success: string): LessonActionState {
  return result.success ? { success } : { error: result.error, errorCode: result.errorCode }
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
  })
  if (!result.success) return actionResult(result, '')
  revalidatePath('/protected/book')
  revalidatePath('/protected/lessons')
  return { success: 'Lesson booked successfully.' }
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
    bookingHorizonDays: optionalValue(formData, 'bookingHorizonDays', 'booking_horizon_days'),
    bookingCutoffMinutes: optionalValue(formData, 'bookingCutoffMinutes', 'booking_cutoff_minutes'),
    singleLessonPriceCents: optionalValue(formData, 'singleLessonPriceCents', 'single_lesson_price_cents'),
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
