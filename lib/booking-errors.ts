import type { BookingErrorCode } from '@/types/domain'

export const BOOKING_ERROR_MESSAGES: Record<BookingErrorCode, string> = {
  duplicate: 'This lesson has already been booked for this fencer.',
  unavailable: 'This lesson is no longer available. Please choose another time.',
  full: 'This lesson is full. Please choose another time.',
  unauthorized_participant: 'You are not allowed to book a lesson for this participant.',
  membership_required: 'This lesson is only available to active CFA members.',
  invalid_payment: 'That payment option is not available. Please choose another option.',
  invalid_input: 'Please check the booking details and try again.',
  unexpected: 'We could not complete the booking. Please try again.',
}

export function bookingErrorMessage(code: BookingErrorCode): string {
  return BOOKING_ERROR_MESSAGES[code]
}

export function bookingDatabaseErrorCode(
  message: string | undefined,
  postgresCode?: string,
): BookingErrorCode {
  if (postgresCode === '23505') return 'duplicate'
  const known: Record<string, BookingErrorCode> = {
    booking_duplicate: 'duplicate',
    booking_unavailable: 'unavailable',
    booking_full: 'full',
    booking_unauthorized_participant: 'unauthorized_participant',
    booking_membership_required: 'membership_required',
    booking_invalid_payment: 'invalid_payment',
  }
  return (message && known[message]) || 'unexpected'
}
