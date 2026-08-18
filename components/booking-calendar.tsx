/**
 * Compatibility export for callers that previously imported the legacy
 * capacity-slot calendar. New lesson booking uses generated coach occurrences.
 */
export {
  CoachBookingCalendar as BookingCalendar,
  CoachBookingCalendar,
} from "@/components/lesson-booking/coach-booking-calendar";
export type {
  LessonMemberActionState,
  LessonMemberFormAction,
} from "@/components/lesson-booking/coach-booking-calendar";
