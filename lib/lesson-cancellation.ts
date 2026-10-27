import type { LessonBooking } from "@/types/domain";

// Which fee applies if a lesson is cancelled now: none, none because the
// pay-now hold was never paid, or a percentage of the lesson price.
export type CancellationBand =
  | { kind: "free" }
  | { kind: "held" }
  | { kind: "fee"; percent: number };

// Mirrors cancel_lesson_booking_v2: free at or before the booked deadline
// (inclusive), then the reduced band, then the late share. An unpaid
// pay-now hold is always released without a fee.
export function cancellationBand(lesson: LessonBooking, now: Date): CancellationBand {
  if (lesson.awaitingPayment) return { kind: "held" };
  if (!lesson.cancellationDeadline || now <= new Date(lesson.cancellationDeadline)) return { kind: "free" };
  if (lesson.partialFeeDeadline && now <= new Date(lesson.partialFeeDeadline)) {
    return { kind: "fee", percent: lesson.partialFeePercent ?? 50 };
  }
  return { kind: "fee", percent: lesson.lateFeePercent ?? 100 };
}

/** The warning shown before a member confirms a cancellation. */
export function cancellationWarning(band: CancellationBand): string {
  if (band.kind === "held") return "This lesson has not been paid, so cancelling releases the time at no cost.";
  if (band.kind === "free") return "You are inside the free cancellation period. No fee will be charged.";
  if (band.percent >= 100) return "The free cancellation period has passed. The full lesson price will be charged.";
  return `The free cancellation period has passed. ${band.percent}% of the lesson price will be charged.`;
}
