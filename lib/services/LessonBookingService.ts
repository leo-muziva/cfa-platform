// Lesson booking rules for members, coaches and admins: loading booking
// pages, quoting and creating bookings, cancelling and rescheduling, coach
// availability, club closures and lesson settings. Every function validates
// its raw input with Zod and checks who is asking before it calls
// LessonBookingRepository. The repository's RPCs repeat the important checks
// in the database.
import 'server-only'
import type { ZodError } from 'zod'
import { validationFailure } from '@/lib/validations/form-errors'
import { releaseExpiredLessonHolds } from '@/lib/services/scheduled-jobs-service'
import { onlinePaymentsAvailable } from '@/lib/services/payment-service'
import { getCurrentAccountContext, getCurrentProfile, requireAdmin } from '@/lib/services/MemberService'
import {
  cancelClubClosureRecord,
  cancelCoachFutureBookingsRecord,
  cancelLessonBookingRecord,
  createClubClosureRecord,
  createCoachAvailabilityExceptionRecord,
  createCoachAvailabilityRuleRecord,
  deleteCoachAvailabilityExceptionRecord,
  deleteCoachAvailabilityRuleRecord,
  getLessonQuote,
  getDropInFeeCents,
  getLessonSettings,
  insertLessonBooking,
  lessonBookingError,
  listAllLessonBookings,
  listAvailableLessonTimes,
  listClubClosures,
  listCoachAvailabilityExceptions,
  listCoachAvailabilityRules,
  listCoachLessonAgenda,
  listCoachLessonProfilesForAdmin,
  listEligibleLessonParticipants,
  listLessonActivity,
  listLessonCoaches,
  listLessonTimeOptions,
  listMemberLessonBookings,
  listPayableLessonHolds,
  previewClubClosure,
  previewCoachAvailabilityException,
  recordLessonOutcomeRecord,
  rescheduleLessonBookingRecord,
  setCoachLessonProfileRecord,
  updateLessonSettingsRecord,
  waiveLessonChargesRecord,
} from '@/lib/repositories/LessonBookingRepository'
import {
  cancelClubClosureSchema,
  cancelCoachFutureBookingsSchema,
  cancelLessonBookingSchema,
  clubClosureSchema,
  clubClosurePreviewSchema,
  coachAvailabilityExceptionSchema,
  coachAvailabilityExceptionPreviewWithCoachSchema,
  coachAvailabilityRuleSchema,
  coachLessonProfileSchema,
  createLessonBookingSchema,
  deleteAvailabilityExceptionSchema,
  deleteAvailabilityRuleSchema,
  lessonAvailabilitySchema,
  lessonOutcomeSchema,
  lessonParticipantsSchema,
  lessonSettingsPatchSchema,
  rescheduleLessonBookingSchema,
  waiveLessonChargesSchema,
} from '@/lib/validations/lesson.schema'
import type { LessonBookingErrorCode, LessonBookingResult, LessonParticipant, PayableLessonHold, Profile } from '@/types/domain'

type PageError = { error: string; errorCode: LessonBookingErrorCode }

/** Names the invalid fields when a schema failure is passed in. */
function invalid(error?: ZodError): LessonBookingResult<never> {
  if (!error) return lessonBookingError('invalid_input')
  return { success: false, errorCode: 'invalid_input', ...validationFailure(error) }
}

// Strips a failed result down to what a page needs to show the error.
function pageError(result: { success: false; errorCode: LessonBookingErrorCode; error: string }): PageError {
  return { error: result.error, errorCode: result.errorCode }
}

/**
 * Who the signed-in person may book for. A dependent can only book for
 * themselves; a payer can book for anyone in their household.
 */
export function eligibleParticipantsForActor(participants: LessonParticipant[], actorId: string, isDependent: boolean) {
  return isDependent ? participants.filter((participant) => participant.id === actorId) : participants
}

/** The coaches members can book, for the coach directory page. */
export async function getLessonCoachDirectory() {
  return listLessonCoaches()
}

/**
 * Everything the "book a lesson with this coach" page needs: the coach,
 * who the member may book for, the open time slots and whether online
 * payment is switched on.
 */
export async function getLessonBookingPageData(coachId: string, rawFilters: unknown = {}) {
  const context = await getCurrentAccountContext()
  if ('error' in context) return {
    ...context,
    errorCode: context.error === 'Not authenticated' ? 'not_authenticated' as const : 'forbidden' as const,
  }
  // These three do not depend on each other. Lapsed pay-now holds still
  // occupy their slot until released, so that finishes before times load.
  const [coachesResult, participantsResult, , dropInFee] = await Promise.all([
    listLessonCoaches(),
    listEligibleLessonParticipants(context.profile.id, context.capabilities.isAdmin),
    releaseExpiredLessonHolds(),
    getDropInFeeCents(),
  ])
  if (!coachesResult.success) return pageError(coachesResult)
  const coach = coachesResult.data.find((item) => item.coachId === coachId)
  if (!coach) return { error: 'Coach not found', errorCode: 'not_found' as const }
  if (!participantsResult.success) return pageError(participantsResult)
  const filtersResult = lessonAvailabilitySchema.safeParse({ coachId, weapon: coach.weapons[0], ...rawFilters as object })
  if (!filtersResult.success) return { error: 'Check the lesson filters and try again.', errorCode: 'invalid_input' as const }
  const optionsResult = await listLessonTimeOptions(filtersResult.data)
  if (!optionsResult.success) return pageError(optionsResult)
  return {
    profile: context.profile,
    capabilities: context.capabilities,
    paymentsAvailable: onlinePaymentsAvailable(),
    // Only shown as a note; the booking itself reads the fee from settings.
    dropInFeeCents: dropInFee.success ? dropInFee.data : 0,
    coach,
    participants: eligibleParticipantsForActor(participantsResult.data, context.profile.id, context.capabilities.isDependent),
    timeOptions: optionsResult.data,
  }
}

/** Open start times for a coach on a day, for the given filters. */
export async function getAvailableLessonTimes(raw: unknown) {
  const parsed = lessonAvailabilitySchema.safeParse(raw)
  return parsed.success ? listAvailableLessonTimes(parsed.data) : invalid()
}

/** Time slots with their availability state, for the booking calendar. */
export async function getLessonTimeOptions(raw: unknown) {
  const parsed = lessonAvailabilitySchema.safeParse(raw)
  return parsed.success ? listLessonTimeOptions(parsed.data) : invalid()
}

/**
 * Prices a lesson for the chosen participants. Only admins and people who
 * can see household money get a quote; dependents never see amounts.
 */
export async function quoteLesson(raw: unknown) {
  const parsed = lessonParticipantsSchema.safeParse(raw)
  if (!parsed.success) return invalid(parsed.error)
  const profile = await getCurrentProfile()
  if (!profile) return lessonBookingError('not_authenticated')
  if (profile.is_staff && profile.staff_type === 'admin') return getLessonQuote(parsed.data.participantIds)
  const context = await getCurrentAccountContext()
  if ('error' in context) return lessonBookingError('forbidden')
  if (!context.capabilities.canSeeHouseholdMoney) return lessonBookingError('forbidden')
  return getLessonQuote(parsed.data.participantIds)
}

/**
 * Books a lesson. Pay-now books create a slot hold that must be paid before
 * it expires; pay-later books are confirmed without paying up front.
 */
export async function createLessonBooking(raw: unknown) {
  const parsed = createLessonBookingSchema.safeParse(raw)
  if (!parsed.success) return invalid(parsed.error)
  if (!await getCurrentProfile()) return lessonBookingError('not_authenticated')
  // A hold that can never be paid would only block the slot until it expires.
  if (parsed.data.paymentOption === 'pay_now' && !onlinePaymentsAvailable()) return lessonBookingError('payments_unavailable')
  return insertLessonBooking(parsed.data)
}

/** The member's own lessons. Releases lapsed holds first so the list is current. */
export async function getMemberLessonsPageData() {
  const context = await getCurrentAccountContext()
  if ('error' in context) return context
  await releaseExpiredLessonHolds()
  const lessons = await listMemberLessonBookings()
  return lessons.success ? {
    profile: context.profile,
    capabilities: context.capabilities,
    paymentsAvailable: onlinePaymentsAvailable(),
    lessons: lessons.data,
  } : pageError(lessons)
}

/** Live pay-now holds the current payer can still pay. Empty for anyone who cannot see household money. */
export async function getPayableLessonHolds(): Promise<LessonBookingResult<PayableLessonHold[]>> {
  const context = await getCurrentAccountContext()
  if ('error' in context) return lessonBookingError('not_authenticated')
  if (!context.capabilities.canSeeHouseholdMoney) return { success: true, data: [] }
  return listPayableLessonHolds()
}

/**
 * Cancels a lesson as the member or their payer. The database applies the
 * free-cancellation window and any late-cancellation fee.
 */
export async function cancelLessonBooking(raw: unknown) {
  const parsed = cancelLessonBookingSchema.safeParse(raw)
  if (!parsed.success) return invalid(parsed.error)
  const profile = await getCurrentProfile()
  if (!profile) return lessonBookingError('not_authenticated')
  // Personal lesson changes follow the household policy, including for staff.
  // Operational coach/closure cancellations use their dedicated service actions.
  const context = await getCurrentAccountContext()
  if ('error' in context) return lessonBookingError('forbidden')
  const actorType = context.capabilities.isPayer ? 'payer' : 'member'
  return cancelLessonBookingRecord(parsed.data.bookingId, parsed.data.reason ?? null, actorType)
}

/** Moves a booking to a new start time; the RPC checks the slot is free. */
export async function rescheduleLessonBooking(raw: unknown) {
  const parsed = rescheduleLessonBookingSchema.safeParse(raw)
  if (!parsed.success) return invalid(parsed.error)
  if (!await getCurrentProfile()) return lessonBookingError('not_authenticated')
  return rescheduleLessonBookingRecord(parsed.data.bookingId, parsed.data.startsAt)
}

/** The signed-in coach's upcoming lessons. Coaches only. */
export async function getCoachLessonsPageData() {
  const profile = await getCurrentProfile()
  if (!profile) return { error: 'Not authenticated' }
  if (!profile.is_staff || profile.staff_type !== 'coach') return { error: 'Forbidden' }
  const lessons = await listCoachLessonAgenda()
  return lessons.success ? { profile, lessons: lessons.data } : pageError(lessons)
}

/** The signed-in coach's weekly availability and one-off exceptions. */
export async function getCoachAvailabilityPageData() {
  const profile = await getCurrentProfile()
  if (!profile) return { error: 'Not authenticated' }
  if (!profile.is_staff || profile.staff_type !== 'coach') return { error: 'Forbidden' }
  const [rules, exceptions] = await Promise.all([
    listCoachAvailabilityRules(profile.id), listCoachAvailabilityExceptions(profile.id),
  ])
  if (!rules.success) return pageError(rules)
  if (!exceptions.success) return pageError(exceptions)
  return { profile, rules: rules.data, exceptions: exceptions.data }
}

// Self-guarded, standalone preview used by the "preview affected lessons"
// popup — unlike getCoachAvailabilityPageData above, this isn't tied to a
// full page load, so it validates and authorizes the coachId itself instead
// of trusting the caller's session-derived profile.id.
export async function previewCoachAvailabilityExceptionForCoach(raw: unknown) {
  const parsed = coachAvailabilityExceptionPreviewWithCoachSchema.safeParse(raw)
  if (!parsed.success) return invalid(parsed.error)
  const guard = await requireCoachOrAdmin(parsed.data.coachId)
  return guard.allowed
    ? previewCoachAvailabilityException(parsed.data.coachId, parsed.data.startsAt, parsed.data.endsAt)
    : guard.result
}

/**
 * Coach or admin records attendance for a lesson. In a shared double
 * booking `participantId` marks one fencer without affecting the other.
 */
export async function recordLessonOutcome(raw: unknown) {
  const parsed = lessonOutcomeSchema.safeParse(raw)
  if (!parsed.success) return invalid(parsed.error)
  const profile = await getCurrentProfile()
  if (!profile) return lessonBookingError('not_authenticated')
  if (!profile.is_staff || !['coach', 'admin'].includes(profile.staff_type ?? '')) return lessonBookingError('forbidden')
  return recordLessonOutcomeRecord(parsed.data.bookingId, parsed.data.outcome, parsed.data.participantId)
}

// Result of requireCoachOrAdmin: the profile when allowed, otherwise the
// error result to return to the caller.
type CoachAdminGuard =
  | { allowed: true; profile: Profile }
  | { allowed: false; result: LessonBookingResult<never> }

/**
 * Allows admins, and coaches acting on their own schedule. Pass
 * `targetCoachId` when the action names a coach so a coach cannot edit
 * someone else's availability.
 */
async function requireCoachOrAdmin(targetCoachId?: string): Promise<CoachAdminGuard> {
  const profile = await getCurrentProfile()
  if (!profile) return { allowed: false, result: lessonBookingError('not_authenticated') }
  const permitted = profile.is_staff && (profile.staff_type === 'admin' || (profile.staff_type === 'coach' && (!targetCoachId || targetCoachId === profile.id)))
  return permitted ? { allowed: true, profile } : { allowed: false, result: lessonBookingError('forbidden') }
}

/** Adds a weekly recurring availability window for a coach. */
export async function createCoachAvailabilityRule(raw: unknown): Promise<LessonBookingResult<{ ruleId: string }>> {
  const parsed = coachAvailabilityRuleSchema.safeParse(raw)
  if (!parsed.success) return invalid(parsed.error)
  const guard = await requireCoachOrAdmin(parsed.data.coachId)
  return guard.allowed ? createCoachAvailabilityRuleRecord(parsed.data) : guard.result
}

/** Removes a weekly availability window; RLS limits this to the coach or an admin. */
export async function deleteCoachAvailabilityRule(raw: unknown): Promise<LessonBookingResult<null>> {
  const parsed = deleteAvailabilityRuleSchema.safeParse(raw)
  if (!parsed.success) return invalid(parsed.error)
  const guard = await requireCoachOrAdmin()
  return guard.allowed ? deleteCoachAvailabilityRuleRecord(parsed.data.ruleId) : guard.result
}

/**
 * Adds a one-off block (coach away) or extra slot. A block that overlaps
 * booked lessons needs `cancelAffected` to confirm cancelling them.
 */
export async function createCoachAvailabilityException(raw: unknown): Promise<LessonBookingResult<{ exceptionId: string }>> {
  const parsed = coachAvailabilityExceptionSchema.safeParse(raw)
  if (!parsed.success) return invalid(parsed.error)
  const guard = await requireCoachOrAdmin(parsed.data.coachId)
  return guard.allowed ? createCoachAvailabilityExceptionRecord(parsed.data) : guard.result
}

/** Removes a one-off exception; RLS limits this to the coach or an admin. */
export async function deleteCoachAvailabilityException(raw: unknown): Promise<LessonBookingResult<null>> {
  const parsed = deleteAvailabilityExceptionSchema.safeParse(raw)
  if (!parsed.success) return invalid(parsed.error)
  const guard = await requireCoachOrAdmin()
  return guard.allowed ? deleteCoachAvailabilityExceptionRecord(parsed.data.exceptionId) : guard.result
}

/** All bookings, recent lesson activity and coach setup for the admin lessons page. */
export async function getAdminLessonsPageData() {
  const guard = await requireAdmin()
  if ('error' in guard) return guard
  const [bookings, activity, coaches] = await Promise.all([
    listAllLessonBookings(), listLessonActivity(), listCoachLessonProfilesForAdmin(),
  ])
  if (!bookings.success) return pageError(bookings)
  if (!activity.success) return pageError(activity)
  if (!coaches.success) return pageError(coaches)
  return { bookings: bookings.data, activity: activity.data, coaches: coaches.data }
}

/** Coach lesson profiles (weapons, booking enabled) for the admin coaches page. */
export async function getAdminCoachSetupPageData() {
  const guard = await requireAdmin()
  if ('error' in guard) return guard
  const coaches = await listCoachLessonProfilesForAdmin()
  return coaches.success ? { coaches: coaches.data } : pageError(coaches)
}

/** Club closures for the admin closures page. */
export async function getAdminClosuresPageData() {
  const guard = await requireAdmin()
  if ('error' in guard) return guard
  const closures = await listClubClosures()
  return closures.success ? { closures: closures.data } : pageError(closures)
}

/** Current lesson settings (fees, hold length, cancellation window). */
export async function getLessonSettingsForAdmin() {
  const guard = await requireAdmin()
  if ('error' in guard) return guard
  const settings = await getLessonSettings()
  return settings.success ? { settings: settings.data } : pageError(settings)
}

/** Saves changed lesson settings. Only the fields sent are updated. */
export async function updateLessonSettingsForAdmin(raw: unknown) {
  const parsed = lessonSettingsPatchSchema.safeParse(raw)
  if (!parsed.success) return invalid(parsed.error)
  const guard = await requireAdmin()
  return 'error' in guard ? lessonBookingError('forbidden') : updateLessonSettingsRecord(parsed.data)
}

/** Sets which weapons a coach teaches and whether members can book them. */
export async function setCoachLessonProfileForAdmin(raw: unknown) {
  const parsed = coachLessonProfileSchema.safeParse(raw)
  if (!parsed.success) return invalid(parsed.error)
  const guard = await requireAdmin()
  return 'error' in guard ? lessonBookingError('forbidden') : setCoachLessonProfileRecord(parsed.data)
}

/** Lists the lessons a proposed closure would cancel, before it is saved. */
export async function previewClubClosureForAdmin(raw: unknown) {
  const parsed = clubClosurePreviewSchema.safeParse(raw)
  if (!parsed.success) return invalid(parsed.error)
  const guard = await requireAdmin()
  return 'error' in guard ? lessonBookingError('forbidden') : previewClubClosure(parsed.data.startsOn, parsed.data.endsOn)
}

/**
 * Saves a club closure. If lessons fall inside it the database refuses
 * unless `cancelAffected` confirms they should be cancelled.
 */
export async function createClubClosureForAdmin(raw: unknown) {
  const parsed = clubClosureSchema.safeParse(raw)
  if (!parsed.success) return invalid(parsed.error)
  const guard = await requireAdmin()
  return 'error' in guard ? lessonBookingError('forbidden') : createClubClosureRecord(parsed.data)
}

/** Withdraws a closure. Lessons it already cancelled stay cancelled. */
export async function cancelClubClosureForAdmin(raw: unknown) {
  const parsed = cancelClubClosureSchema.safeParse(raw)
  if (!parsed.success) return invalid(parsed.error)
  const guard = await requireAdmin()
  return 'error' in guard ? lessonBookingError('forbidden') : cancelClubClosureRecord(parsed.data.closureId)
}

/** Cancels every future booking with a coach, for example when they leave. */
export async function cancelCoachFutureBookingsForAdmin(raw: unknown) {
  const parsed = cancelCoachFutureBookingsSchema.safeParse(raw)
  if (!parsed.success) return invalid(parsed.error)
  const guard = await requireAdmin()
  return 'error' in guard ? lessonBookingError('forbidden') : cancelCoachFutureBookingsRecord(parsed.data.coachId, parsed.data.reason)
}

/** Waives the charges on a lesson booking, with a reason for the audit trail. */
export async function waiveLessonChargesForAdmin(raw: unknown) {
  const parsed = waiveLessonChargesSchema.safeParse(raw)
  if (!parsed.success) return invalid(parsed.error)
  const guard = await requireAdmin()
  return 'error' in guard ? lessonBookingError('forbidden') : waiveLessonChargesRecord(parsed.data.bookingId, parsed.data.reason)
}
