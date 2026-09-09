import 'server-only'
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
  listMemberLessonBookings,
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
import type { LessonBookingErrorCode, LessonBookingResult, LessonParticipant, Profile } from '@/types/domain'

type PageError = { error: string; errorCode: LessonBookingErrorCode }

function invalid(): LessonBookingResult<never> {
  return lessonBookingError('invalid_input')
}

function pageError(result: { success: false; errorCode: LessonBookingErrorCode; error: string }): PageError {
  return { error: result.error, errorCode: result.errorCode }
}

export function eligibleParticipantsForActor(participants: LessonParticipant[], actorId: string, isDependent: boolean) {
  return isDependent ? participants.filter((participant) => participant.id === actorId) : participants
}

export async function getLessonCoachDirectory() {
  return listLessonCoaches()
}

export async function getLessonBookingPageData(coachId: string, rawFilters: unknown = {}) {
  const context = await getCurrentAccountContext()
  if ('error' in context) return {
    ...context,
    errorCode: context.error === 'Not authenticated' ? 'not_authenticated' as const : 'forbidden' as const,
  }
  const coachesResult = await listLessonCoaches()
  if (!coachesResult.success) return pageError(coachesResult)
  const coach = coachesResult.data.find((item) => item.coachId === coachId)
  if (!coach) return { error: 'Coach not found', errorCode: 'not_found' as const }
  const participantsResult = await listEligibleLessonParticipants(context.profile.id, context.capabilities.isAdmin)
  if (!participantsResult.success) return pageError(participantsResult)
  const filtersResult = lessonAvailabilitySchema.safeParse({ coachId, weapon: coach.weapons[0], ...rawFilters as object })
  if (!filtersResult.success) return { error: 'Check the lesson filters and try again.', errorCode: 'invalid_input' as const }
  const availabilityResult = await listAvailableLessonTimes(filtersResult.data)
  if (!availabilityResult.success) return pageError(availabilityResult)
  return {
    profile: context.profile,
    capabilities: context.capabilities,
    coach,
    participants: eligibleParticipantsForActor(participantsResult.data, context.profile.id, context.capabilities.isDependent),
    availableTimes: availabilityResult.data,
  }
}

export async function getAvailableLessonTimes(raw: unknown) {
  const parsed = lessonAvailabilitySchema.safeParse(raw)
  return parsed.success ? listAvailableLessonTimes(parsed.data) : invalid()
}

export async function quoteLesson(raw: unknown) {
  const parsed = lessonParticipantsSchema.safeParse(raw)
  if (!parsed.success) return invalid()
  const profile = await getCurrentProfile()
  if (!profile) return lessonBookingError('not_authenticated')
  if (profile.is_staff && profile.staff_type === 'admin') return getLessonQuote(parsed.data.participantIds)
  if (profile.is_staff && profile.staff_type === 'coach') return lessonBookingError('forbidden')
  const context = await getCurrentAccountContext()
  if ('error' in context) return lessonBookingError('forbidden')
  if (!context.capabilities.canSeeHouseholdMoney) return lessonBookingError('forbidden')
  return getLessonQuote(parsed.data.participantIds)
}

export async function createLessonBooking(raw: unknown) {
  const parsed = createLessonBookingSchema.safeParse(raw)
  if (!parsed.success) return invalid()
  if (!await getCurrentProfile()) return lessonBookingError('not_authenticated')
  return insertLessonBooking(parsed.data)
}

export async function getMemberLessonsPageData() {
  const context = await getCurrentAccountContext()
  if ('error' in context) return context
  const lessons = await listMemberLessonBookings()
  return lessons.success ? { profile: context.profile, capabilities: context.capabilities, lessons: lessons.data } : pageError(lessons)
}

export async function cancelLessonBooking(raw: unknown) {
  const parsed = cancelLessonBookingSchema.safeParse(raw)
  if (!parsed.success) return invalid()
  const profile = await getCurrentProfile()
  if (!profile) return lessonBookingError('not_authenticated')
  if (profile.is_staff && profile.staff_type === 'admin') {
    return cancelLessonBookingRecord(parsed.data.bookingId, parsed.data.reason ?? null, 'admin')
  }
  if (profile.is_staff && profile.staff_type === 'coach') {
    return cancelLessonBookingRecord(parsed.data.bookingId, parsed.data.reason ?? null, 'coach')
  }
  const context = await getCurrentAccountContext()
  if ('error' in context) return lessonBookingError('forbidden')
  const actorType = context.capabilities.isPayer ? 'payer' : 'member'
  return cancelLessonBookingRecord(parsed.data.bookingId, parsed.data.reason ?? null, actorType)
}

export async function rescheduleLessonBooking(raw: unknown) {
  const parsed = rescheduleLessonBookingSchema.safeParse(raw)
  if (!parsed.success) return invalid()
  if (!await getCurrentProfile()) return lessonBookingError('not_authenticated')
  return rescheduleLessonBookingRecord(parsed.data.bookingId, parsed.data.startsAt)
}

export async function getCoachLessonsPageData() {
  const profile = await getCurrentProfile()
  if (!profile) return { error: 'Not authenticated' }
  if (!profile.is_staff || profile.staff_type !== 'coach') return { error: 'Forbidden' }
  const lessons = await listCoachLessonAgenda()
  return lessons.success ? { profile, lessons: lessons.data } : pageError(lessons)
}

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
  if (!parsed.success) return invalid()
  const guard = await requireCoachOrAdmin(parsed.data.coachId)
  return guard.allowed
    ? previewCoachAvailabilityException(parsed.data.coachId, parsed.data.startsAt, parsed.data.endsAt)
    : guard.result
}

export async function recordLessonOutcome(raw: unknown) {
  const parsed = lessonOutcomeSchema.safeParse(raw)
  if (!parsed.success) return invalid()
  const profile = await getCurrentProfile()
  if (!profile) return lessonBookingError('not_authenticated')
  if (!profile.is_staff || !['coach', 'admin'].includes(profile.staff_type ?? '')) return lessonBookingError('forbidden')
  return recordLessonOutcomeRecord(parsed.data.bookingId, parsed.data.outcome)
}

type CoachAdminGuard =
  | { allowed: true; profile: Profile }
  | { allowed: false; result: LessonBookingResult<never> }

async function requireCoachOrAdmin(targetCoachId?: string): Promise<CoachAdminGuard> {
  const profile = await getCurrentProfile()
  if (!profile) return { allowed: false, result: lessonBookingError('not_authenticated') }
  const permitted = profile.is_staff && (profile.staff_type === 'admin' || (profile.staff_type === 'coach' && (!targetCoachId || targetCoachId === profile.id)))
  return permitted ? { allowed: true, profile } : { allowed: false, result: lessonBookingError('forbidden') }
}

export async function createCoachAvailabilityRule(raw: unknown): Promise<LessonBookingResult<{ ruleId: string }>> {
  const parsed = coachAvailabilityRuleSchema.safeParse(raw)
  if (!parsed.success) return invalid()
  const guard = await requireCoachOrAdmin(parsed.data.coachId)
  return guard.allowed ? createCoachAvailabilityRuleRecord(parsed.data) : guard.result
}

export async function deleteCoachAvailabilityRule(raw: unknown): Promise<LessonBookingResult<null>> {
  const parsed = deleteAvailabilityRuleSchema.safeParse(raw)
  if (!parsed.success) return invalid()
  const guard = await requireCoachOrAdmin()
  return guard.allowed ? deleteCoachAvailabilityRuleRecord(parsed.data.ruleId) : guard.result
}

export async function createCoachAvailabilityException(raw: unknown): Promise<LessonBookingResult<{ exceptionId: string }>> {
  const parsed = coachAvailabilityExceptionSchema.safeParse(raw)
  if (!parsed.success) return invalid()
  const guard = await requireCoachOrAdmin(parsed.data.coachId)
  return guard.allowed ? createCoachAvailabilityExceptionRecord(parsed.data) : guard.result
}

export async function deleteCoachAvailabilityException(raw: unknown): Promise<LessonBookingResult<null>> {
  const parsed = deleteAvailabilityExceptionSchema.safeParse(raw)
  if (!parsed.success) return invalid()
  const guard = await requireCoachOrAdmin()
  return guard.allowed ? deleteCoachAvailabilityExceptionRecord(parsed.data.exceptionId) : guard.result
}

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

export async function getAdminCoachSetupPageData() {
  const guard = await requireAdmin()
  if ('error' in guard) return guard
  const coaches = await listCoachLessonProfilesForAdmin()
  return coaches.success ? { coaches: coaches.data } : pageError(coaches)
}

export async function getAdminClosuresPageData() {
  const guard = await requireAdmin()
  if ('error' in guard) return guard
  const closures = await listClubClosures()
  return closures.success ? { closures: closures.data } : pageError(closures)
}

export async function getLessonSettingsForAdmin() {
  const guard = await requireAdmin()
  if ('error' in guard) return guard
  const settings = await getLessonSettings()
  return settings.success ? { settings: settings.data } : pageError(settings)
}

export async function updateLessonSettingsForAdmin(raw: unknown) {
  const parsed = lessonSettingsPatchSchema.safeParse(raw)
  if (!parsed.success) return invalid()
  const guard = await requireAdmin()
  return 'error' in guard ? lessonBookingError('forbidden') : updateLessonSettingsRecord(parsed.data)
}

export async function setCoachLessonProfileForAdmin(raw: unknown) {
  const parsed = coachLessonProfileSchema.safeParse(raw)
  if (!parsed.success) return invalid()
  const guard = await requireAdmin()
  return 'error' in guard ? lessonBookingError('forbidden') : setCoachLessonProfileRecord(parsed.data)
}

export async function previewClubClosureForAdmin(raw: unknown) {
  const parsed = clubClosurePreviewSchema.safeParse(raw)
  if (!parsed.success) return invalid()
  const guard = await requireAdmin()
  return 'error' in guard ? lessonBookingError('forbidden') : previewClubClosure(parsed.data.startsOn, parsed.data.endsOn)
}

export async function createClubClosureForAdmin(raw: unknown) {
  const parsed = clubClosureSchema.safeParse(raw)
  if (!parsed.success) return invalid()
  const guard = await requireAdmin()
  return 'error' in guard ? lessonBookingError('forbidden') : createClubClosureRecord(parsed.data)
}

export async function cancelClubClosureForAdmin(raw: unknown) {
  const parsed = cancelClubClosureSchema.safeParse(raw)
  if (!parsed.success) return invalid()
  const guard = await requireAdmin()
  return 'error' in guard ? lessonBookingError('forbidden') : cancelClubClosureRecord(parsed.data.closureId)
}

export async function cancelCoachFutureBookingsForAdmin(raw: unknown) {
  const parsed = cancelCoachFutureBookingsSchema.safeParse(raw)
  if (!parsed.success) return invalid()
  const guard = await requireAdmin()
  return 'error' in guard ? lessonBookingError('forbidden') : cancelCoachFutureBookingsRecord(parsed.data.coachId, parsed.data.reason)
}

export async function waiveLessonChargesForAdmin(raw: unknown) {
  const parsed = waiveLessonChargesSchema.safeParse(raw)
  if (!parsed.success) return invalid()
  const guard = await requireAdmin()
  return 'error' in guard ? lessonBookingError('forbidden') : waiveLessonChargesRecord(parsed.data.bookingId, parsed.data.reason)
}
