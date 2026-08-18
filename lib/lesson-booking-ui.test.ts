import { describe, expect, it } from "vitest";
import {
  BOOKING_CONTENTION_MESSAGE,
  cancellationDeadline,
  isValidLessonParticipantSelection,
  lessonDates,
  lessonBillingCopy,
  lessonBillingDetailCopy,
  safeWeapon,
  splitMemberLessons,
  timesForLessonDate,
  toggleLessonParticipant,
} from "./lesson-booking-ui";
import type { AvailableLessonTime, LessonBooking } from "@/types/domain";

const time = (startsAt: string): AvailableLessonTime => ({
  startsAt,
  endsAt: new Date(new Date(startsAt).getTime() + 30 * 60_000).toISOString(),
});

describe("lesson booking UI helpers", () => {
  it("allows one or two distinct participants and ignores a third", () => {
    expect(toggleLessonParticipant([], "adult")).toEqual(["adult"]);
    expect(toggleLessonParticipant(["adult"], "dependent")).toEqual(["adult", "dependent"]);
    expect(toggleLessonParticipant(["adult", "dependent"], "third")).toEqual(["adult", "dependent"]);
    expect(toggleLessonParticipant(["adult", "dependent"], "adult")).toEqual(["dependent"]);
  });

  it("groups available times using Cape Town calendar dates", () => {
    const times = [time("2026-08-05T22:30:00.000Z"), time("2026-08-06T16:30:00.000Z")];
    expect(lessonDates(times)).toEqual(["2026-08-06"]);
    expect(timesForLessonDate(times, "2026-08-06")).toHaveLength(2);
  });

  it("falls back to the first supported weapon", () => {
    expect(safeWeapon("sabre", ["foil", "sabre"])).toBe("sabre");
    expect(safeWeapon("epee", ["foil", "sabre"])).toBe("foil");
  });

  it("requires one or two distinct participants", () => {
    expect(isValidLessonParticipantSelection([])).toBe(false);
    expect(isValidLessonParticipantSelection(["adult"])).toBe(true);
    expect(isValidLessonParticipantSelection(["adult", "dependent"])).toBe(true);
    expect(isValidLessonParticipantSelection(["adult", "adult"])).toBe(false);
    expect(isValidLessonParticipantSelection(["a", "b", "c"])).toBe(false);
  });

  it("keeps dependent confirmation copy financially private", () => {
    const quote = { participantCount: 2 as const, totalCents: 60000, currency: "ZAR" as const };
    expect(lessonBillingCopy({ canSeeQuote: false, quote })).toBe("Your payer will be billed");
    expect(lessonBillingCopy({ canSeeQuote: false, quote })).not.toMatch(
      /R\s?\d|600|\b(?:price|amount)\b/i,
    );
    expect(lessonBillingDetailCopy(false)).toBeNull();
    expect(lessonBillingCopy({ canSeeQuote: true, quote })).toContain("R");
    expect(lessonBillingDetailCopy(true)).toMatch(/invoice/i);
  });

  it("publishes the exact accessible contention recovery message", () => {
    expect(BOOKING_CONTENTION_MESSAGE).toBe(
      "That time has just been taken. Pick another available time.",
    );
  });

  it("splits future scheduled lessons from history without financial props", () => {
    const base = {
      coachId: "coach",
      coachName: "Coach",
      endsAt: "2026-08-20T09:30:00.000Z",
      weapon: "foil" as const,
      participants: [{ id: "adult", fullName: "Adult" }],
      cancelledAt: null,
      cancellationReason: null,
      rescheduledFromBookingId: null,
      rescheduledToBookingId: null,
    };
    const lessons: LessonBooking[] = [
      { ...base, id: "future", startsAt: "2026-08-20T09:00:00.000Z", status: "scheduled" },
      { ...base, id: "past", startsAt: "2026-08-10T09:00:00.000Z", status: "attended" },
    ];
    expect(splitMemberLessons(lessons, new Date("2026-08-17T00:00:00.000Z"))).toEqual({
      upcoming: [lessons[0]],
      history: [lessons[1]],
    });
    expect(JSON.stringify(lessons)).not.toMatch(/price|charge|invoice|receipt|payment/i);
    expect(cancellationDeadline("2026-08-20T09:00:00.000Z", 24)).toBe(
      "2026-08-19T09:00:00.000Z",
    );
  });
});
