import 'server-only'
import { createClient } from '@/lib/supabase/server'
import type {
  AvailableLessonTime,
  ClubClosure,
  ClosureAffectedBooking,
  CoachAvailabilityException,
  CoachAvailabilityRule,
  CoachLessonProfile,
  LessonActivityItem,
  LessonBooking,
  LessonBookingErrorCode,
  LessonBookingResult,
  LessonBookingSettings,
  LessonCoachSummary,
  LessonParticipant,
  LessonTimeOption,
  LessonQuote,
  PayableLessonHold,
  Weapon,
} from '@/types/domain'
import type {
  ClubClosureInput,
  CoachAvailabilityExceptionInput,
  CoachAvailabilityRuleInput,
  CoachLessonProfileInput,
  CreateLessonBookingInput,
  LessonAvailabilityInput,
  LessonSettingsPatchInput,
} from '@/lib/validations/lesson.schema'

const errorMessages: Record<LessonBookingErrorCode, string> = {
  not_authenticated: 'Please sign in to continue.',
  account_incomplete: 'Complete your account before booking a lesson.',
  invalid_input: 'Check the information and try again.',
  invalid_participants: 'Choose one or two different participants.',
  participant_unauthorized: 'You cannot book for one of the selected participants.',
  mixed_payers: 'Both participants must have the same payer.',
  slot_taken: 'That time has just been taken. Pick another available time.',
  booking_not_scheduled: 'This lesson is no longer scheduled.',
  booking_already_started: 'This lesson has already started and can no longer be changed.',
  invalid_actor_type: 'This cancellation type is not allowed.',
  invalid_outcome: 'Choose attended or no-show.',
  outcome_not_allowed: 'This lesson outcome cannot be recorded.',
  forbidden: 'You do not have permission to do that.',
  locked_setting: 'That lesson setting is fixed for this build.',
  invalid_settings: 'Check the lesson settings and try again.',
  invalid_coach: 'Choose an active coach account.',
  invalid_weapon: 'Choose a weapon offered by this coach.',
  invalid_exception: 'Check the availability exception and try again.',
  affected_bookings_require_confirmation: 'Confirm cancellation of the affected bookings before blocking this time.',
  invalid_closure: 'Check the closure dates and reason.',
  waiver_reason_required: 'A waiver reason is required.',
  pay_now_required: 'This lesson must be paid now. Guest lessons can only be booked by the account payer with online payment.',
  entitlement_unavailable: 'No lesson package uses are left for this fencer.',
  invalid_product: 'This lesson type is not available right now.',
  checkout_unavailable: 'This lesson can no longer be paid online. The payment hold may have expired.',
  payments_unavailable: 'Online payments are not available right now, so this lesson cannot be paid now.',
  not_found: 'The requested lesson record was not found.',
  request_failed: 'The lesson request could not be completed. Please try again.',
}

const databaseErrorCodes = Object.keys(errorMessages).filter((code) => !['invalid_input', 'not_found', 'request_failed', 'payments_unavailable'].includes(code)) as LessonBookingErrorCode[]

export function lessonBookingError(code: LessonBookingErrorCode): LessonBookingResult<never> {
  return { success: false, errorCode: code, error: errorMessages[code] }
}

export function lessonBookingErrorCode(error: unknown): LessonBookingErrorCode {
  const value = error && typeof error === 'object' && 'message' in error ? String(error.message) : String(error ?? '')
  const normalized = value.toLowerCase()
  return databaseErrorCodes.find((code) => normalized.includes(code)) ?? 'request_failed'
}

function failed(error: unknown): LessonBookingResult<never> {
  const code = lessonBookingErrorCode(error)
  // Unmapped database errors (for example a function missing on a hosted
  // database) would otherwise vanish behind the generic message.
  if (code === 'request_failed') {
    const detail = error && typeof error === 'object' ? error as { code?: unknown; message?: unknown } : { message: error }
    console.error('[lesson-booking] request failed', { code: detail.code ?? null, message: String(detail.message ?? '') })
  }
  return lessonBookingError(code)
}

type CoachRow = { coach_id: string; full_name: string; weapons: string[] | null }
type TimeRow = { starts_at: string; ends_at: string }
type TimeOptionRow = TimeRow & { is_available: boolean }
type QuoteRow = { participant_count: number | string; total_cents: number | string; currency: string }

export async function listLessonCoaches(): Promise<LessonBookingResult<LessonCoachSummary[]>> {
  const db = await createClient()
  const { data, error } = await db.rpc('list_lesson_coaches')
  if (error) return failed(error)
  return { success: true, data: ((data ?? []) as CoachRow[]).map((row) => ({
    coachId: row.coach_id, fullName: row.full_name, weapons: (row.weapons ?? []) as Weapon[],
  })) }
}

export async function listAvailableLessonTimes(input: LessonAvailabilityInput): Promise<LessonBookingResult<AvailableLessonTime[]>> {
  const db = await createClient()
  const { data, error } = await db.rpc('list_available_lesson_times', {
    target_coach: input.coachId,
    target_weapon: input.weapon,
    range_start: input.rangeStart ?? null,
    range_end: input.rangeEnd ?? null,
  })
  if (error) return failed(error)
  return { success: true, data: ((data ?? []) as TimeRow[]).map((row) => ({ startsAt: row.starts_at, endsAt: row.ends_at })) }
}

export async function listLessonTimeOptions(input: LessonAvailabilityInput): Promise<LessonBookingResult<LessonTimeOption[]>> {
  const db = await createClient()
  const { data, error } = await db.rpc('list_lesson_time_options', {
    target_coach: input.coachId,
    target_weapon: input.weapon,
    range_start: input.rangeStart ?? null,
    range_end: input.rangeEnd ?? null,
  })
  if (error) return failed(error)
  return { success: true, data: ((data ?? []) as TimeOptionRow[]).map((row) => ({
    startsAt: row.starts_at, endsAt: row.ends_at, isAvailable: row.is_available,
  })) }
}

export async function getLessonQuote(participantIds: [string] | [string, string]): Promise<LessonBookingResult<LessonQuote>> {
  const db = await createClient()
  const { data, error } = await db.rpc('get_lesson_quote_v3', { target_participant_ids: participantIds })
  if (error) return failed(error)
  const row = (Array.isArray(data) ? data[0] : data) as QuoteRow | null
  if (!row) return lessonBookingError('request_failed')
  return { success: true, data: {
    participantCount: Number(row.participant_count) as 1 | 2,
    totalCents: String(row.total_cents), currency: 'ZAR',
  } }
}

export async function insertLessonBooking(input: CreateLessonBookingInput): Promise<LessonBookingResult<{ bookingId: string }>> {
  const db = await createClient()
  const { data, error } = await db.rpc('create_lesson_booking_v3', {
    target_coach: input.coachId,
    target_starts_at: input.startsAt,
    target_participant_ids: input.participantIds,
    target_weapon: input.weapon,
    target_payment_option: input.paymentOption,
  })
  return error ? failed(error) : { success: true, data: { bookingId: data as string } }
}

export async function cancelLessonBookingRecord(bookingId: string, reason: string | null, actorType: 'member' | 'payer' | 'coach' | 'admin' | 'closure' | 'system'): Promise<LessonBookingResult<null>> {
  const db = await createClient()
  const { error } = await db.rpc('cancel_lesson_booking_v2', {
    target_booking: bookingId, target_reason: reason, target_actor_type: actorType,
  })
  return error ? failed(error) : { success: true, data: null }
}

export async function rescheduleLessonBookingRecord(bookingId: string, startsAt: string): Promise<LessonBookingResult<{ bookingId: string }>> {
  const db = await createClient()
  const { data, error } = await db.rpc('reschedule_lesson_booking_v2', {
    target_booking: bookingId, target_starts_at: startsAt,
  })
  return error ? failed(error) : { success: true, data: { bookingId: data as string } }
}

export async function recordLessonOutcomeRecord(bookingId: string, outcome: 'attended' | 'no_show', participantId?: string): Promise<LessonBookingResult<null>> {
  const db = await createClient()
  const { error } = participantId
    ? await db.rpc('record_lesson_participant_outcome', { target_booking: bookingId, target_participant: participantId, target_outcome: outcome })
    : await db.rpc('record_lesson_outcome', { target_booking: bookingId, target_outcome: outcome })
  return error ? failed(error) : { success: true, data: null }
}

type SafeBookingRow = {
  booking_id: string
  coach_id: string
  coach_name: string
  starts_at: string
  ends_at: string
  weapon: string
  status: string
  participant_ids?: string[]
  participant_names: string[]
  participant_outcomes?: Array<'attended' | 'no_show' | null>
  cancellation_deadline?: string | null
  cancelled_at?: string | null
  cancellation_reason?: string | null
  rescheduled_from_booking_id?: string | null
  rescheduled_to_booking_id?: string | null
  awaiting_payment?: boolean | null
  hold_expires_at?: string | null
  partial_fee_deadline?: string | null
  partial_fee_percent?: number | null
  late_fee_percent?: number | null
}

export function mapSafeLessonBooking(row: SafeBookingRow): LessonBooking {
  return {
    id: row.booking_id,
    coachId: row.coach_id,
    coachName: row.coach_name,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    weapon: row.weapon as Weapon,
    status: row.status as LessonBooking['status'],
    participants: (row.participant_names ?? []).map((fullName, index) => ({
      id: row.participant_ids?.[index] ?? `${row.booking_id}:${index + 1}`, fullName,
      ...(row.participant_outcomes ? { attendanceOutcome: row.participant_outcomes[index] ?? null } : {}),
    })),
    cancellationDeadline: row.cancellation_deadline ?? null,
    cancelledAt: row.cancelled_at ?? null,
    cancellationReason: row.cancellation_reason ?? null,
    rescheduledFromBookingId: row.rescheduled_from_booking_id ?? null,
    rescheduledToBookingId: row.rescheduled_to_booking_id ?? null,
    awaitingPayment: row.awaiting_payment ?? false,
    holdExpiresAt: row.hold_expires_at ?? null,
    partialFeeDeadline: row.partial_fee_deadline ?? null,
    partialFeePercent: row.partial_fee_percent ?? null,
    lateFeePercent: row.late_fee_percent ?? null,
  }
}

/** Uses a security-definer, money-free DTO so dependents never need bookings-table financial access. */
export async function listMemberLessonBookings(): Promise<LessonBookingResult<LessonBooking[]>> {
  const db = await createClient()
  const { data, error } = await db.rpc('list_my_lesson_bookings')
  if (error) return failed(error)
  return { success: true, data: ((data ?? []) as SafeBookingRow[]).map(mapSafeLessonBooking) }
}

type PayableHoldRow = {
  booking_id: string
  coach_name: string
  starts_at: string
  weapon: string
  participant_names: string[] | null
  amount_cents: string | number
  hold_expires_at: string
}

/** Payer-only: pay-now lessons whose hold is still live, with the amount due. */
export async function listPayableLessonHolds(): Promise<LessonBookingResult<PayableLessonHold[]>> {
  const db = await createClient()
  const { data, error } = await db.rpc('list_my_payable_lesson_holds')
  if (error) return failed(error)
  return { success: true, data: ((data ?? []) as PayableHoldRow[]).map((row) => ({
    bookingId: row.booking_id,
    coachName: row.coach_name,
    startsAt: row.starts_at,
    weapon: row.weapon as Weapon,
    participantNames: row.participant_names ?? [],
    amountCents: String(row.amount_cents),
    holdExpiresAt: row.hold_expires_at,
  })) }
}

export async function listCoachLessonAgenda(coachId?: string): Promise<LessonBookingResult<LessonBooking[]>> {
  const db = await createClient()
  const { data, error } = await db.rpc('list_coach_lesson_agenda_v3', { target_coach: coachId ?? null })
  if (error) return failed(error)
  return { success: true, data: ((data ?? []) as Array<Omit<SafeBookingRow, 'coach_name'> & { booking_id: string }>).map((row) => mapSafeLessonBooking({
    ...row, coach_name: '', participant_names: row.participant_names ?? [],
  })) }
}

type BookingQueryRow = {
  id: string
  coach_id: string
  starts_at: string
  ends_at: string
  weapon: string
  status: string
  cancelled_at: string | null
  cancellation_reason: string | null
  rescheduled_from_booking_id: string | null
  rescheduled_to_booking_id: string | null
  coach: { full_name: string | null } | { full_name: string | null }[] | null
  participants: Array<{ ordinal: number; participant_id: string; attendance_outcome: 'attended' | 'no_show' | null; profile: { full_name: string | null } | { full_name: string | null }[] | null }>
}

function one<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? value[0] ?? null : value
}

export async function listAllLessonBookings(): Promise<LessonBookingResult<LessonBooking[]>> {
  const db = await createClient()
  const { data, error } = await db.from('bookings').select(`
    id,coach_id,starts_at,ends_at,weapon,status,cancelled_at,cancellation_reason,
    rescheduled_from_booking_id,rescheduled_to_booking_id,
    coach:profiles!bookings_coach_id_fkey(full_name),
    participants:booking_participants(ordinal,participant_id,attendance_outcome,profile:profiles!booking_participants_participant_id_fkey(full_name))
  `).eq('booking_model', 'lesson_v2').order('starts_at', { ascending: false })
  if (error) return failed(error)
  return { success: true, data: ((data ?? []) as unknown as BookingQueryRow[]).map((row) => ({
    id: row.id, coachId: row.coach_id, coachName: one(row.coach)?.full_name ?? 'Coach',
    startsAt: row.starts_at, endsAt: row.ends_at, weapon: row.weapon as Weapon,
    status: row.status as LessonBooking['status'],
    participants: [...(row.participants ?? [])].sort((a, b) => a.ordinal - b.ordinal).map((item) => ({
      id: item.participant_id, fullName: one(item.profile)?.full_name ?? 'Participant', attendanceOutcome: item.attendance_outcome,
    })),
    cancellationDeadline: null,
    cancelledAt: row.cancelled_at, cancellationReason: row.cancellation_reason,
    rescheduledFromBookingId: row.rescheduled_from_booking_id,
    rescheduledToBookingId: row.rescheduled_to_booking_id,
  })) }
}

export async function listEligibleLessonParticipants(actorId: string, isAdmin: boolean): Promise<LessonBookingResult<LessonParticipant[]>> {
  const db = await createClient()
  if (isAdmin) {
    const { data, error } = await db.from('profiles').select('id,full_name,is_staff,membership_status').eq('is_active', true).not('profile_completed_at', 'is', null).order('full_name')
    if (error) return failed(error)
    return { success: true, data: (data ?? []).map((row) => ({ id: row.id, fullName: row.full_name ?? 'Account member', isSelf: row.id === actorId, membershipStatus: row.membership_status as 'guest' | 'member' })) }
  }
  const [{ data: self, error: selfError }, { data: links, error: linksError }] = await Promise.all([
    db.from('profiles').select('id,full_name,membership_status').eq('id', actorId).single(),
    db.from('family_links').select('dependent:profiles!family_links_dependent_id_fkey(id,full_name,membership_status)').eq('guardian_id', actorId).eq('status', 'active'),
  ])
  if (selfError || linksError || !self) return failed(selfError ?? linksError)
  const participants: LessonParticipant[] = [{ id: self.id, fullName: self.full_name ?? 'Your account', isSelf: true, membershipStatus: self.membership_status as 'guest' | 'member' }]
  for (const link of links ?? []) {
    const dependent = one(link.dependent as { id: string; full_name: string | null; membership_status: 'guest' | 'member' } | { id: string; full_name: string | null; membership_status: 'guest' | 'member' }[] | null)
    if (dependent && !participants.some((item) => item.id === dependent.id)) participants.push({ id: dependent.id, fullName: dependent.full_name ?? 'Dependent', membershipStatus: dependent.membership_status })
  }
  return { success: true, data: participants }
}

type RuleRow = { id: string; coach_id: string; iso_weekday: number; starts_at_local: string; ends_at_local: string; is_active: boolean }
type ExceptionRow = { id: string; coach_id: string; exception_type: string; starts_at: string; ends_at: string; reason: string | null }

export async function listCoachAvailabilityRules(coachId: string): Promise<LessonBookingResult<CoachAvailabilityRule[]>> {
  const db = await createClient()
  const { data, error } = await db.from('coach_availability_rules').select('id,coach_id,iso_weekday,starts_at_local,ends_at_local,is_active').eq('coach_id', coachId).order('iso_weekday').order('starts_at_local')
  if (error) return failed(error)
  return { success: true, data: ((data ?? []) as RuleRow[]).map((row) => ({
    id: row.id, coachId: row.coach_id, isoWeekday: row.iso_weekday as CoachAvailabilityRule['isoWeekday'],
    startsAtLocal: row.starts_at_local, endsAtLocal: row.ends_at_local, isActive: row.is_active,
  })) }
}

export async function createCoachAvailabilityRuleRecord(input: CoachAvailabilityRuleInput): Promise<LessonBookingResult<{ ruleId: string }>> {
  const db = await createClient()
  const { data, error } = await db.from('coach_availability_rules').insert({
    coach_id: input.coachId, iso_weekday: input.isoWeekday,
    starts_at_local: input.startsAtLocal, ends_at_local: input.endsAtLocal,
  }).select('id').single()
  return error ? failed(error) : { success: true, data: { ruleId: data.id } }
}

export async function deleteCoachAvailabilityRuleRecord(ruleId: string): Promise<LessonBookingResult<null>> {
  const db = await createClient()
  const { error } = await db.from('coach_availability_rules').delete().eq('id', ruleId)
  return error ? failed(error) : { success: true, data: null }
}

export async function listCoachAvailabilityExceptions(coachId: string): Promise<LessonBookingResult<CoachAvailabilityException[]>> {
  const db = await createClient()
  const { data, error } = await db.from('coach_availability_exceptions').select('id,coach_id,exception_type,starts_at,ends_at,reason').eq('coach_id', coachId).order('starts_at')
  if (error) return failed(error)
  return { success: true, data: ((data ?? []) as ExceptionRow[]).map((row) => ({
    id: row.id, coachId: row.coach_id, exceptionType: row.exception_type as 'block' | 'extra',
    startsAt: row.starts_at, endsAt: row.ends_at, reason: row.reason,
  })) }
}

export async function createCoachAvailabilityExceptionRecord(input: CoachAvailabilityExceptionInput): Promise<LessonBookingResult<{ exceptionId: string }>> {
  const db = await createClient()
  const { data, error } = await db.rpc('admin_create_coach_exception', {
    target_coach: input.coachId, target_type: input.exceptionType,
    target_starts_at: input.startsAt, target_ends_at: input.endsAt,
    target_reason: input.reason ?? null, cancel_affected: input.cancelAffected,
  })
  return error ? failed(error) : { success: true, data: { exceptionId: data as string } }
}

export async function deleteCoachAvailabilityExceptionRecord(exceptionId: string): Promise<LessonBookingResult<null>> {
  const db = await createClient()
  const { error } = await db.from('coach_availability_exceptions').delete().eq('id', exceptionId)
  return error ? failed(error) : { success: true, data: null }
}

type SettingsRow = Record<string, unknown>

function mapSettings(row: SettingsRow): LessonBookingSettings {
  return {
    cancellationWindowHours: Number(row.cancellation_window_hours),
    lateCancellationAction: 'allow',
    lateCancellationFeeMultiplier: Number(row.late_cancellation_fee_multiplier),
    cancellationPartialWindowHours: Number(row.cancellation_partial_window_hours),
    cancellationPartialFeeMultiplier: Number(row.cancellation_partial_fee_multiplier),
    noShowFeeMultiplier: Number(row.no_show_fee_multiplier),
    bookingHorizonDays: Number(row.booking_horizon_days),
    bookingHorizonCalendarMonths: Number(row.booking_horizon_calendar_months),
    bookingCutoffMinutes: Number(row.booking_cutoff_minutes),
    paymentMode: 'invoice_only', arrearsBlockingEnabled: false, futureBookingCapPerFencer: null,
    coachAssignmentMode: 'any_matching_weapon', coachWeaponsMode: 'per_coach',
    singleLessonPriceCents: Number(row.single_lesson_price_cents),
    externalRemindersEnabled: Boolean(row.external_reminders_enabled),
    doubleLessonMultiplier: 2, doubleLessonAtomic: true, closureMode: 'club_wide_date_ranges',
    lessonDurationMinutes: 30, updatedAt: String(row.updated_at),
  }
}

export async function getLessonSettings(): Promise<LessonBookingResult<LessonBookingSettings>> {
  const db = await createClient()
  const { data, error } = await db.from('lesson_booking_settings').select('*').eq('singleton', true).single()
  return error || !data ? failed(error) : { success: true, data: mapSettings(data as SettingsRow) }
}

export async function updateLessonSettingsRecord(input: LessonSettingsPatchInput): Promise<LessonBookingResult<LessonBookingSettings>> {
  const patch: Record<string, number> = {}
  if (input.cancellationWindowHours !== undefined) patch.cancellation_window_hours = input.cancellationWindowHours
  if (input.lateCancellationFeeMultiplier !== undefined) patch.late_cancellation_fee_multiplier = input.lateCancellationFeeMultiplier
  if (input.cancellationPartialWindowHours !== undefined) patch.cancellation_partial_window_hours = input.cancellationPartialWindowHours
  if (input.cancellationPartialFeeMultiplier !== undefined) patch.cancellation_partial_fee_multiplier = input.cancellationPartialFeeMultiplier
  if (input.bookingHorizonCalendarMonths !== undefined) patch.booking_horizon_calendar_months = input.bookingHorizonCalendarMonths
  if (input.noShowFeeMultiplier !== undefined) patch.no_show_fee_multiplier = input.noShowFeeMultiplier
  if (input.bookingHorizonDays !== undefined) patch.booking_horizon_days = input.bookingHorizonDays
  if (input.bookingCutoffMinutes !== undefined) patch.booking_cutoff_minutes = input.bookingCutoffMinutes
  if (input.singleLessonPriceCents !== undefined) patch.single_lesson_price_cents = input.singleLessonPriceCents
  const db = await createClient()
  const { data, error } = await db.rpc('update_lesson_booking_settings', { settings_patch: patch })
  return error || !data ? failed(error) : { success: true, data: mapSettings(data as SettingsRow) }
}

export async function listCoachLessonProfilesForAdmin(): Promise<LessonBookingResult<CoachLessonProfile[]>> {
  const db = await createClient()
  const [{ data: coaches, error: coachError }, { data: profiles, error: profileError }, { data: weapons, error: weaponError }] = await Promise.all([
    db.from('profiles').select('id,full_name').eq('is_staff', true).eq('staff_type', 'coach').order('full_name'),
    db.from('coach_lesson_profiles').select('coach_id,is_active'),
    db.from('coach_lesson_weapons').select('coach_id,weapon'),
  ])
  if (coachError || profileError || weaponError) return failed(coachError ?? profileError ?? weaponError)
  return { success: true, data: (coaches ?? []).map((coach) => ({
    coachId: coach.id, fullName: coach.full_name ?? 'Coach',
    isActive: (profiles ?? []).find((profile) => profile.coach_id === coach.id)?.is_active ?? false,
    weapons: (weapons ?? []).filter((row) => row.coach_id === coach.id).map((row) => row.weapon as Weapon),
  })) }
}

export async function setCoachLessonProfileRecord(input: CoachLessonProfileInput): Promise<LessonBookingResult<null>> {
  const db = await createClient()
  const { error } = await db.rpc('admin_set_coach_lesson_profile', {
    target_coach: input.coachId, target_active: input.isActive, target_weapons: input.weapons,
  })
  return error ? failed(error) : { success: true, data: null }
}

export async function listClubClosures(): Promise<LessonBookingResult<ClubClosure[]>> {
  const db = await createClient()
  const [{ data, error }, { data: effects, error: effectError }] = await Promise.all([
    db.from('club_closures').select('id,starts_on,ends_on,reason,cancelled_at').order('starts_on', { ascending: false }),
    db.from('closure_affected_bookings').select('closure_id'),
  ])
  if (error || effectError) return failed(error ?? effectError)
  return { success: true, data: (data ?? []).map((row) => ({
    id: row.id, startsOn: row.starts_on, endsOn: row.ends_on, reason: row.reason,
    cancelledAt: row.cancelled_at,
    affectedBookingCount: (effects ?? []).filter((effect) => effect.closure_id === row.id).length,
  })) }
}

export async function createClubClosureRecord(input: ClubClosureInput): Promise<LessonBookingResult<{ closureId: string }>> {
  const db = await createClient()
  const { data, error } = await db.rpc('admin_create_club_closure', {
    target_starts_on: input.startsOn, target_ends_on: input.endsOn,
    target_reason: input.reason, cancel_affected: input.cancelAffected,
  })
  return error ? failed(error) : { success: true, data: { closureId: data as string } }
}

export async function previewClubClosure(startsOn: string, endsOn: string): Promise<LessonBookingResult<ClosureAffectedBooking[]>> {
  const db = await createClient()
  const { data, error } = await db.rpc('admin_preview_club_closure', {
    target_starts_on: startsOn, target_ends_on: endsOn,
  })
  if (error) return failed(error)
  return { success: true, data: ((data ?? []) as Array<{
    booking_id: string
    coach_id: string
    starts_at: string
    participant_names: string[]
  }>).map((row) => ({
    bookingId: row.booking_id, coachId: row.coach_id,
    startsAt: row.starts_at, participantNames: row.participant_names ?? [],
  })) }
}

export async function previewCoachAvailabilityException(coachId: string, startsAt: string, endsAt: string): Promise<LessonBookingResult<ClosureAffectedBooking[]>> {
  const db = await createClient()
  const { data, error } = await db.rpc('preview_coach_availability_exception', {
    target_coach: coachId, target_starts_at: startsAt, target_ends_at: endsAt,
  })
  if (error) return failed(error)
  return { success: true, data: ((data ?? []) as Array<{ booking_id: string; starts_at: string; participant_names: string[] }>).map((row) => ({
    bookingId: row.booking_id, coachId, startsAt: row.starts_at, participantNames: row.participant_names ?? [],
  })) }
}

export async function cancelClubClosureRecord(closureId: string): Promise<LessonBookingResult<null>> {
  const db = await createClient()
  const { error } = await db.from('club_closures').update({ cancelled_at: new Date().toISOString() }).eq('id', closureId)
  return error ? failed(error) : { success: true, data: null }
}

export async function cancelCoachFutureBookingsRecord(coachId: string, reason: string): Promise<LessonBookingResult<{ count: number }>> {
  const db = await createClient()
  const { data, error } = await db.rpc('admin_cancel_coach_future_bookings', { target_coach: coachId, target_reason: reason })
  return error ? failed(error) : { success: true, data: { count: Number(data) } }
}

export async function waiveLessonChargesRecord(bookingId: string, reason: string): Promise<LessonBookingResult<null>> {
  const db = await createClient()
  const { error } = await db.rpc('admin_waive_booking_charges', { target_booking: bookingId, target_reason: reason })
  return error ? failed(error) : { success: true, data: null }
}

export async function listLessonActivity(): Promise<LessonBookingResult<LessonActivityItem[]>> {
  const db = await createClient()
  const { data, error } = await db.from('audit_events').select('id,event_type,actor_id,entity_id,created_at,metadata').like('event_type', 'lesson.%').order('created_at', { ascending: false }).limit(100)
  if (error) return failed(error)
  return { success: true, data: (data ?? []).map((row) => ({
    id: row.id, eventType: row.event_type, actorId: row.actor_id,
    bookingId: row.entity_id, createdAt: row.created_at,
    metadata: (row.metadata ?? {}) as Record<string, unknown>,
  })) }
}
