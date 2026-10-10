import { describe, expect, it } from "vitest";
import {
  BOOKING_CONTENTION_MESSAGE,
  cancellationDeadline,
  firstAvailableLessonTime,
  lessonDateHasAvailableTime,
  isValidLessonParticipantSelection,
  lessonDates,
  lessonBillingCopy,
  lessonBillingDetailCopy,
  dropInFeeCopy,
  safeWeapon,
  splitMemberLessons,
  timesForLessonDate,
  toggleLessonParticipant,
} from "./lesson-booking-ui";
import type { AvailableLessonTime, LessonBooking, LessonTimeOption } from "@/types/domain";

const time = (startsAt: string): AvailableLessonTime => ({
  startsAt,
  endsAt: new Date(new Date(startsAt).getTime() + 30 * 60_000).toISOString(),
});

const option = (startsAt: string, isAvailable: boolean): LessonTimeOption => ({ ...time(startsAt), isAvailable });

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

  it("keeps unavailable schedule dates visible but non-selectable", () => {
    const options = [
      option("2026-08-06T16:00:00.000Z", false),
      option("2026-08-07T16:00:00.000Z", true),
      option("2026-08-07T16:30:00.000Z", false),
    ];
    expect(lessonDates(options)).toEqual(["2026-08-06", "2026-08-07"]);
    expect(lessonDateHasAvailableTime(options, "2026-08-06")).toBe(false);
    expect(lessonDateHasAvailableTime(options, "2026-08-07")).toBe(true);
    expect(firstAvailableLessonTime(options, "2026-08-06")).toBeNull();
    expect(firstAvailableLessonTime(options, "2026-08-07")?.startsAt).toBe("2026-08-07T16:00:00.000Z");
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
    const quote = { participantCount: 2 as const, totalCents: "60000", currency: "ZAR" as const };
    expect(lessonBillingCopy({ canSeeQuote: false, quote })).toBe("Your payer will be billed");
    expect(lessonBillingCopy({ canSeeQuote: false, quote })).not.toMatch(
      /R\s?\d|600|\b(?:price|amount)\b/i,
    );
    expect(lessonBillingDetailCopy(false)).toBeNull();
    expect(lessonBillingCopy({ canSeeQuote: true, quote })).toContain("R");
    expect(lessonBillingDetailCopy(true)).toMatch(/invoice/i);
    expect(lessonBillingDetailCopy(true, true)).toMatch(/pay now/i);
    expect(lessonBillingDetailCopy(true, false)).not.toMatch(/pay now/i);
  });

  it("keeps a lesson awaiting payment in upcoming until it is released", () => {
    const base = {
      coachId: "coach", coachName: "Coach", endsAt: "2099-01-01T10:30:00.000Z", weapon: "foil" as const,
      participants: [], cancelledAt: null, cancellationReason: null, rescheduledFromBookingId: null, rescheduledToBookingId: null,
    };
    const held = { ...base, id: "held", startsAt: "2099-01-01T10:00:00.000Z", status: "scheduled" as const, awaitingPayment: true, holdExpiresAt: "2098-12-31T10:00:00.000Z" };
    const released = { ...base, id: "released", startsAt: "2099-01-02T10:00:00.000Z", status: "cancelled" as const, cancellationReason: "Payment hold expired" };
    const { upcoming, history } = splitMemberLessons([held, released], new Date("2098-12-31T09:45:00.000Z"));
    expect(upcoming.map((lesson) => lesson.id)).toEqual(["held"]);
    expect(history.map((lesson) => lesson.id)).toEqual(["released"]);
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

describe("dropInFeeCopy", () => {
  it("names the fee in rands and says it is once per day", () => {
    expect(dropInFeeCopy(12000)).toBe("Guests also pay a R120.00 drop-in fee, once per day.");
  });

  it("says nothing when the fee is switched off", () => {
    expect(dropInFeeCopy(0)).toBeNull();
  });
});
