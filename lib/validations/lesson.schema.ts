import { z } from 'zod'

export const weaponSchema = z.enum(['foil', 'epee', 'sabre'])

const participantIdsSchema = z.union([
  z.tuple([z.uuid()]),
  z.tuple([z.uuid(), z.uuid()]),
]).refine((ids) => new Set(ids).size === ids.length, {
  message: 'Participants must be distinct',
})

export const lessonParticipantsSchema = z.object({
  participantIds: participantIdsSchema,
}).strict()

export const createLessonBookingSchema = z.object({
  coachId: z.uuid(),
  startsAt: z.iso.datetime({ offset: true }),
  participantIds: participantIdsSchema,
  weapon: weaponSchema,
  paymentOption: z.enum(['pay_now', 'pay_later']).default('pay_later'),
}).strict()

export const lessonAvailabilitySchema = z.object({
  coachId: z.uuid(),
  weapon: weaponSchema,
  rangeStart: z.iso.date().optional(),
  rangeEnd: z.iso.date().optional(),
}).strict().refine((value) => !value.rangeStart || !value.rangeEnd || value.rangeEnd >= value.rangeStart, {
  message: 'End date must be on or after start date',
  path: ['rangeEnd'],
})

export const cancelLessonBookingSchema = z.object({
  bookingId: z.uuid(),
  reason: z.string().trim().max(500).optional().nullable(),
}).strict()

export const rescheduleLessonBookingSchema = z.object({
  bookingId: z.uuid(),
  startsAt: z.iso.datetime({ offset: true }),
}).strict()

export const lessonOutcomeSchema = z.object({
  bookingId: z.uuid(),
  participantId: z.uuid().optional(),
  outcome: z.enum(['attended', 'no_show']),
}).strict()

export const lessonSettingsPatchSchema = z.object({
  cancellationWindowHours: z.coerce.number().int().min(0).optional(),
  lateCancellationFeeMultiplier: z.coerce.number().min(0).optional(),
  cancellationPartialWindowHours: z.coerce.number().int().min(0).optional(),
  cancellationPartialFeeMultiplier: z.coerce.number().min(0).max(1).optional(),
  bookingHorizonCalendarMonths: z.coerce.number().int().min(1).max(12).optional(),
  noShowFeeMultiplier: z.coerce.number().min(0).optional(),
  bookingHorizonDays: z.coerce.number().int().min(1).max(365).optional(),
  bookingCutoffMinutes: z.coerce.number().int().min(0).optional(),
  singleLessonPriceCents: z.coerce.number().int().min(0).optional(),
}).strict().refine((value) => Object.keys(value).length > 0, 'At least one setting is required')
  .refine((value) => value.cancellationPartialWindowHours === undefined || value.cancellationWindowHours === undefined
    || value.cancellationPartialWindowHours <= value.cancellationWindowHours, {
    message: 'The reduced-fee window must end at or before the free cancellation window.', path: ['cancellationPartialWindowHours'],
  })

export const coachLessonProfileSchema = z.object({
  coachId: z.uuid(),
  isActive: z.boolean(),
  weapons: z.array(weaponSchema).max(3).refine((weapons) => new Set(weapons).size === weapons.length, {
    message: 'Weapons must be distinct',
  }),
}).strict()

const localTimeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/, 'Use a 24-hour local time')

export const coachAvailabilityRuleSchema = z.object({
  coachId: z.uuid(),
  isoWeekday: z.coerce.number().int().min(1).max(7),
  startsAtLocal: localTimeSchema,
  endsAtLocal: localTimeSchema,
  accessRule: z.enum(['guest_allowed', 'active_members_only']).default('guest_allowed'),
}).strict().refine((value) => value.endsAtLocal > value.startsAtLocal, {
  message: 'End time must be after start time',
  path: ['endsAtLocal'],
})

export const deleteAvailabilityRuleSchema = z.object({ ruleId: z.uuid() }).strict()

export const coachAvailabilityExceptionSchema = z.object({
  coachId: z.uuid(),
  exceptionType: z.enum(['block', 'extra']),
  startsAt: z.iso.datetime({ offset: true }),
  endsAt: z.iso.datetime({ offset: true }),
  reason: z.string().trim().max(500).optional().nullable(),
  cancelAffected: z.boolean().default(false),
}).strict().refine((value) => new Date(value.endsAt) > new Date(value.startsAt), {
  message: 'End time must be after start time',
  path: ['endsAt'],
})

export const coachAvailabilityExceptionPreviewSchema = z.object({
  startsAt: z.iso.datetime({ offset: true }),
  endsAt: z.iso.datetime({ offset: true }),
}).strict().refine((value) => new Date(value.endsAt) > new Date(value.startsAt), {
  message: 'End time must be after start time', path: ['endsAt'],
})

// Same shape as coachAvailabilityExceptionPreviewSchema, plus the coachId a
// standalone preview Server Action needs to authorize the request (the page-load
// preview path derives the coach from the signed-in session instead).
export const coachAvailabilityExceptionPreviewWithCoachSchema = z.object({
  coachId: z.uuid(),
  startsAt: z.iso.datetime({ offset: true }),
  endsAt: z.iso.datetime({ offset: true }),
}).strict().refine((value) => new Date(value.endsAt) > new Date(value.startsAt), {
  message: 'End time must be after start time', path: ['endsAt'],
})

export const deleteAvailabilityExceptionSchema = z.object({ exceptionId: z.uuid() }).strict()

export const clubClosureSchema = z.object({
  startsOn: z.iso.date(),
  endsOn: z.iso.date(),
  reason: z.string().trim().min(1, 'Reason is required').max(500),
  cancelAffected: z.boolean().default(false),
}).strict().refine((value) => value.endsOn >= value.startsOn, {
  message: 'End date must be on or after start date',
  path: ['endsOn'],
})

// Same startsOn/endsOn shape as clubClosureSchema, kept as its own schema
// rather than clubClosureSchema.pick(...) — Zod rejects .pick() on a schema
// that already has .refine() applied ("cannot be used on object schemas
// containing refinements"), since refine wraps the object rather than
// extending it.
export const clubClosurePreviewSchema = z.object({
  startsOn: z.iso.date(),
  endsOn: z.iso.date(),
}).strict().refine((value) => value.endsOn >= value.startsOn, {
  message: 'End date must be on or after start date',
  path: ['endsOn'],
})

export const cancelClubClosureSchema = z.object({ closureId: z.uuid() }).strict()

export const cancelCoachFutureBookingsSchema = z.object({
  coachId: z.uuid(),
  reason: z.string().trim().min(1, 'Reason is required').max(500),
}).strict()

export const waiveLessonChargesSchema = z.object({
  bookingId: z.uuid(),
  reason: z.string().trim().min(1, 'Reason is required').max(500),
}).strict()

export type CreateLessonBookingInput = z.infer<typeof createLessonBookingSchema>
export type LessonAvailabilityInput = z.infer<typeof lessonAvailabilitySchema>
export type LessonParticipantsInput = z.infer<typeof lessonParticipantsSchema>
export type CancelLessonBookingInput = z.infer<typeof cancelLessonBookingSchema>
export type RescheduleLessonBookingInput = z.infer<typeof rescheduleLessonBookingSchema>
export type LessonOutcomeInput = z.infer<typeof lessonOutcomeSchema>
export type LessonSettingsPatchInput = z.infer<typeof lessonSettingsPatchSchema>
export type CoachLessonProfileInput = z.infer<typeof coachLessonProfileSchema>
export type CoachAvailabilityRuleInput = z.infer<typeof coachAvailabilityRuleSchema>
export type CoachAvailabilityExceptionInput = z.infer<typeof coachAvailabilityExceptionSchema>
export type ClubClosureInput = z.infer<typeof clubClosureSchema>
