import { describe, expect, it } from 'vitest'
import { bookingDatabaseErrorCode, bookingErrorMessage } from './booking-errors'

describe('booking errors', () => {
  it.each([
    ['booking_duplicate', 'duplicate'],
    ['booking_unavailable', 'unavailable'],
    ['booking_full', 'full'],
    ['booking_unauthorized_participant', 'unauthorized_participant'],
    ['booking_membership_required', 'membership_required'],
    ['booking_invalid_payment', 'invalid_payment'],
  ] as const)('maps %s to %s', (token, code) => {
    expect(bookingDatabaseErrorCode(token)).toBe(code)
  })

  it('maps unique races to duplicate and hides unknown database errors', () => {
    expect(bookingDatabaseErrorCode('duplicate key violates constraint bookings_lesson_slot_id_fencer_id_key', '23505')).toBe('duplicate')
    expect(bookingDatabaseErrorCode('relation public.bookings does not exist', '42P01')).toBe('unexpected')
    expect(bookingErrorMessage('unexpected')).not.toMatch(/postgres|constraint|sqlstate|relation/i)
  })
})
