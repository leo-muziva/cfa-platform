import { describe, expect, it } from 'vitest'
import {
  createLessonBookingSchema,
  clubClosurePreviewSchema,
  coachAvailabilityExceptionPreviewWithCoachSchema,
  coachAvailabilityExceptionSchema,
  lessonSettingsPatchSchema,
} from './lesson.schema'

const id = (last: number) => `00000000-0000-4000-8000-${String(last).padStart(12, '0')}`

describe('createLessonBookingSchema', () => {
  it('accepts one or two distinct participants', () => {
    const base = { coachId: id(1), startsAt: '2026-08-20T10:00:00+02:00', weapon: 'foil' }
    expect(createLessonBookingSchema.safeParse({ ...base, participantIds: [id(2)] }).success).toBe(true)
    expect(createLessonBookingSchema.safeParse({ ...base, participantIds: [id(2), id(3)] }).success).toBe(true)
  })

  it('rejects empty, over-limit, and duplicate participant selections', () => {
    const base = { coachId: id(1), startsAt: '2026-08-20T10:00:00+02:00', weapon: 'epee' }
    expect(createLessonBookingSchema.safeParse({ ...base, participantIds: [] }).success).toBe(false)
    expect(createLessonBookingSchema.safeParse({ ...base, participantIds: [id(2), id(3), id(4)] }).success).toBe(false)
    expect(createLessonBookingSchema.safeParse({ ...base, participantIds: [id(2), id(2)] }).success).toBe(false)
  })

  it('does not accept client-controlled financial or policy fields', () => {
    const result = createLessonBookingSchema.safeParse({
      coachId: id(1), startsAt: '2026-08-20T10:00:00+02:00', participantIds: [id(2)], weapon: 'sabre',
      price: 1, payerId: id(4), duration: 90, paymentMode: 'pay_now',
    })
    expect(result.success).toBe(false)
  })
})

describe('lesson operations validation', () => {
  it('rejects reversed availability exceptions', () => {
    expect(coachAvailabilityExceptionSchema.safeParse({
      coachId: id(1), exceptionType: 'block', startsAt: '2026-08-20T11:00:00+02:00',
      endsAt: '2026-08-20T10:00:00+02:00', cancelAffected: false,
    }).success).toBe(false)
  })

  // Regression guard: a coach's "block" vs "extra" choice is a form <select>
  // with no safe default (see availability-manager.tsx) — an empty or missing
  // exceptionType must never silently pass through as one or the other.
  it('rejects a missing or empty exceptionType', () => {
    const base = {
      coachId: id(1), startsAt: '2026-08-20T10:00:00+02:00',
      endsAt: '2026-08-20T11:00:00+02:00', cancelAffected: false,
    }
    expect(coachAvailabilityExceptionSchema.safeParse({ ...base, exceptionType: '' }).success).toBe(false)
    expect(coachAvailabilityExceptionSchema.safeParse(base).success).toBe(false)
  })

  it('only accepts mutable lesson settings', () => {
    expect(lessonSettingsPatchSchema.safeParse({ bookingHorizonDays: 35 }).success).toBe(true)
    expect(lessonSettingsPatchSchema.safeParse({ paymentMode: 'pay_now' }).success).toBe(false)
    expect(lessonSettingsPatchSchema.safeParse({}).success).toBe(false)
  })
})

// Regression guard: these two schemas exist specifically because Zod
// rejects `.pick()`/`.extend()` on a schema that already has `.refine()`
// applied. Asserting they parse at all catches that class of bug — it's a
// runtime error, not a type error, so `tsc`/`next build` never see it.
describe('standalone preview schemas', () => {
  it('validates a club closure preview range', () => {
    expect(clubClosurePreviewSchema.safeParse({ startsOn: '2026-08-24', endsOn: '2026-08-24' }).success).toBe(true)
    expect(clubClosurePreviewSchema.safeParse({ startsOn: '2026-08-24', endsOn: '2026-08-20' }).success).toBe(false)
  })

  it('validates a coach availability exception preview range with coachId', () => {
    expect(coachAvailabilityExceptionPreviewWithCoachSchema.safeParse({
      coachId: id(1), startsAt: '2026-08-20T10:00:00+02:00', endsAt: '2026-08-20T11:00:00+02:00',
    }).success).toBe(true)
    expect(coachAvailabilityExceptionPreviewWithCoachSchema.safeParse({
      startsAt: '2026-08-20T10:00:00+02:00', endsAt: '2026-08-20T11:00:00+02:00',
    }).success).toBe(false)
  })
})
