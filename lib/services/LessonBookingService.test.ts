import { describe, expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
import { calculateOutstandingBalance, outstandingChargeLabel } from '@/lib/repositories/PlatformRepository'
import { lessonBookingErrorCode, mapSafeLessonBooking } from '@/lib/repositories/LessonBookingRepository'
import { eligibleParticipantsForActor } from '@/lib/services/LessonBookingService'

describe('lesson booking error contract', () => {
  it('maps every stable database token and closes unknown errors', () => {
    expect(lessonBookingErrorCode({ message: 'slot_taken', code: 'P0001' })).toBe('slot_taken')
    expect(lessonBookingErrorCode({ message: 'participant_unauthorized', code: 'P0001' })).toBe('participant_unauthorized')
    expect(lessonBookingErrorCode({ message: 'database unavailable' })).toBe('request_failed')
  })
})

describe('financial privacy', () => {
  it('maps a lesson row without serializing monetary or payment fields', () => {
    const booking = mapSafeLessonBooking({
      booking_id: 'booking-1', coach_id: 'coach-1', coach_name: 'Coach One',
      starts_at: '2026-08-20T08:00:00Z', ends_at: '2026-08-20T08:30:00Z',
      weapon: 'foil', status: 'scheduled', participant_names: ['Fencer One'],
      participant_ids: ['fencer-1'], cancellation_deadline: '2026-08-19T08:00:00Z',
      amount: 300, payer_id: 'payer-1', payment_option: 'pay_later',
    } as Parameters<typeof mapSafeLessonBooking>[0] & Record<string, unknown>)
    expect(booking).not.toHaveProperty('amount')
    expect(booking).not.toHaveProperty('payerId')
    expect(booking).not.toHaveProperty('paymentOption')
    expect(booking.participants).toEqual([{ id: 'fencer-1', fullName: 'Fencer One' }])
  })

  it('excludes pending charges from balance and applies ledger credits', () => {
    expect(calculateOutstandingBalance([{ amount: 600 }, { amount: '300.00' }], [{ amount: 250 }])).toBe(650)
    expect(calculateOutstandingBalance([{ amount: 100 }], [{ amount: 200 }])).toBe(0)
  })

  it('uses member-friendly labels for finalised outstanding items', () => {
    expect(outstandingChargeLabel('membership', null)).toBe('Membership fee')
    expect(outstandingChargeLabel('lesson', 'attended')).toBe('Completed private lesson')
    expect(outstandingChargeLabel('lesson', 'cancelled')).toBe('Late lesson cancellation')
  })
})

describe('participant capabilities', () => {
  const participants = [
    { id: 'actor', fullName: 'Actor', isSelf: true },
    { id: 'linked', fullName: 'Linked account' },
  ]

  it('only presents self-booking to an effective dependent', () => {
    expect(eligibleParticipantsForActor(participants, 'actor', true)).toEqual([participants[0]])
  })

  it('retains linked participants for a payer', () => {
    expect(eligibleParticipantsForActor(participants, 'actor', false)).toEqual(participants)
  })
})
