import { describe, expect, it } from "vitest";
import { partitionCoachAgenda, type CoachAgendaLesson } from "./lesson-agenda";

const lesson = (bookingId: string, startsAt: string, endsAt: string): CoachAgendaLesson => ({
  bookingId,
  coachId: "coach",
  startsAt,
  endsAt,
  weapon: "foil",
  status: "scheduled",
  participantNames: ["Fencer"],
});

describe("partitionCoachAgenda", () => {
  it("separates overdue, today and upcoming lessons in Cape Town time", () => {
    const result = partitionCoachAgenda([
      lesson("past", "2026-08-17T07:00:00.000Z", "2026-08-17T07:30:00.000Z"),
      lesson("today", "2026-08-17T14:00:00.000Z", "2026-08-17T14:30:00.000Z"),
      lesson("week", "2026-08-19T14:00:00.000Z", "2026-08-19T14:30:00.000Z"),
    ], new Date("2026-08-17T10:00:00.000Z"));

    expect(result.outcomeRequired.map((item) => item.bookingId)).toEqual(["past"]);
    expect(result.today.map((item) => item.bookingId)).toEqual(["today"]);
    expect(result.upcoming.map((item) => item.bookingId)).toEqual(["week"]);
  });
});
