// Pure helpers for the lesson booking screens: choosing participants,
// grouping times by day and the wording about how a lesson is paid.
import type {
  AvailableLessonTime,
  LessonTimeOption,
  LessonBooking,
  LessonQuote,
  Weapon,
} from "@/types/domain";
import { formatZar } from "@/lib/money";
import { capeTownDateKey } from "@/lib/booking-calendar";

// A lesson can be shared by at most two fencers.
export const MAX_LESSON_PARTICIPANTS = 2;
export const BOOKING_CONTENTION_MESSAGE =
  "Someone has just booked that time. Please pick another.";

/** Adds or removes a participant, ignoring additions past the limit. */
export function toggleLessonParticipant(selected: string[], participantId: string): string[] {
  if (selected.includes(participantId)) {
    return selected.filter((id) => id !== participantId);
  }
  if (selected.length >= MAX_LESSON_PARTICIPANTS) {
    return selected;
  }
  return [...selected, participantId];
}

/** The distinct Cape Town days that have lesson times, in order. */
export function lessonDates(times: AvailableLessonTime[]): string[] {
  return [...new Set(times.map((time) => capeTownDateKey(time.startsAt)))].sort();
}

/** The lesson times that fall on one Cape Town day. */
export function timesForLessonDate<T extends AvailableLessonTime>(times: T[], date: string): T[] {
  return times.filter((time) => capeTownDateKey(time.startsAt) === date);
}

/** True when at least one time on that day is still free. */
export function lessonDateHasAvailableTime(times: LessonTimeOption[], date: string): boolean {
  return times.some((time) => capeTownDateKey(time.startsAt) === date && time.isAvailable);
}

/** The earliest free time on that day, or null. */
export function firstAvailableLessonTime(times: LessonTimeOption[], date: string): LessonTimeOption | null {
  return timesForLessonDate(times, date).find((time) => time.isAvailable) ?? null;
}

/** The weapon from the URL if the coach teaches it, otherwise the coach's first weapon. */
export function safeWeapon(value: string | undefined, supported: Weapon[]): Weapon {
  return supported.includes(value as Weapon) ? (value as Weapon) : supported[0];
}

/** One or two different participants. */
export function isValidLessonParticipantSelection(selected: string[]): boolean {
  return selected.length >= 1
    && selected.length <= MAX_LESSON_PARTICIPANTS
    && new Set(selected).size === selected.length;
}

/** A quote's total in rands. */
export function formatLessonQuote(quote: LessonQuote): string {
  return formatZar(quote.totalCents);
}

/**
 * The price line on the booking form. Dependents never see an amount;
 * they are told their payer will be billed.
 */
export function lessonBillingCopy({
  canSeeQuote,
  quote,
  participantCount = 1,
}: {
  canSeeQuote: boolean;
  quote: LessonQuote | null;
  participantCount?: number;
}): string {
  if (!canSeeQuote) return "Your payer will be billed";
  if (participantCount === 2) return "Shared lesson for two fencers";
  return quote ? formatLessonQuote(quote) + " for this lesson" : "Choose a payment option";
}

/** Explains the payment options, or null for people who cannot see prices. */
export function lessonBillingDetailCopy(canSeeQuote: boolean, paymentsAvailable = true): string | null {
  if (!canSeeQuote) return null;
  return paymentsAvailable
    ? "Pay later on your monthly invoice, or pay now with secure checkout."
    : "Lessons are added to your monthly invoice.";
}

// Guests pay the drop-in fee once per day on top of the lesson. Nothing to
// say when the fee is switched off.
export function dropInFeeCopy(feeCents: number): string | null {
  if (!(feeCents > 0)) return null;
  return `Guests also pay a ${formatZar(feeCents)} drop-in fee, once per day.`;
}

/** Splits lessons into upcoming (soonest first) and history (newest first). */
export function splitMemberLessons(
  lessons: LessonBooking[],
  now = new Date(),
): { upcoming: LessonBooking[]; history: LessonBooking[] } {
  const upcoming = lessons
    .filter((lesson) => lesson.status === "scheduled" && new Date(lesson.startsAt) >= now)
    .sort((left, right) => left.startsAt.localeCompare(right.startsAt));
  const upcomingIds = new Set(upcoming.map((lesson) => lesson.id));
  const history = lessons
    .filter((lesson) => !upcomingIds.has(lesson.id))
    .sort((left, right) => right.startsAt.localeCompare(left.startsAt));
  return { upcoming, history };
}

/** The free-cancellation deadline: the lesson start minus the window. */
export function cancellationDeadline(
  startsAt: string,
  cancellationWindowHours: number,
): string {
  return new Date(
    new Date(startsAt).getTime() - cancellationWindowHours * 60 * 60_000,
  ).toISOString();
}
