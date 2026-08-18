import type {
  AvailableLessonTime,
  LessonBooking,
  LessonQuote,
  Weapon,
} from "@/types/domain";
import { capeTownDateKey } from "@/lib/booking-calendar";

export const MAX_LESSON_PARTICIPANTS = 2;
export const BOOKING_CONTENTION_MESSAGE =
  "That time has just been taken. Pick another available time.";

export function toggleLessonParticipant(selected: string[], participantId: string): string[] {
  if (selected.includes(participantId)) {
    return selected.filter((id) => id !== participantId);
  }
  if (selected.length >= MAX_LESSON_PARTICIPANTS) {
    return selected;
  }
  return [...selected, participantId];
}

export function lessonDates(times: AvailableLessonTime[]): string[] {
  return [...new Set(times.map((time) => capeTownDateKey(time.startsAt)))].sort();
}

export function timesForLessonDate(times: AvailableLessonTime[], date: string): AvailableLessonTime[] {
  return times.filter((time) => capeTownDateKey(time.startsAt) === date);
}

export function safeWeapon(value: string | undefined, supported: Weapon[]): Weapon {
  return supported.includes(value as Weapon) ? (value as Weapon) : supported[0];
}

export function isValidLessonParticipantSelection(selected: string[]): boolean {
  return selected.length >= 1
    && selected.length <= MAX_LESSON_PARTICIPANTS
    && new Set(selected).size === selected.length;
}

export function formatLessonQuote(quote: LessonQuote): string {
  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency: quote.currency,
    minimumFractionDigits: 0,
  }).format(quote.totalCents / 100);
}

export function lessonBillingCopy({
  canSeeQuote,
  quote,
}: {
  canSeeQuote: boolean;
  quote: LessonQuote | null;
}): string {
  if (!canSeeQuote) return "Your payer will be billed";
  return quote ? formatLessonQuote(quote) + " will be added to your account" : "Invoice only";
}

export function lessonBillingDetailCopy(canSeeQuote: boolean): string | null {
  return canSeeQuote ? "Invoice only. No payment is taken now." : null;
}

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

export function cancellationDeadline(
  startsAt: string,
  cancellationWindowHours: number,
): string {
  return new Date(
    new Date(startsAt).getTime() - cancellationWindowHours * 60 * 60_000,
  ).toISOString();
}
