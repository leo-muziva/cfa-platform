import { describe, expect, it } from "vitest";
import { cancellationBand, cancellationWarning } from "./lesson-cancellation";
import type { LessonBooking } from "@/types/domain";

const lesson: LessonBooking = {
  id: "booking-1", coachId: "coach-1", coachName: "Coach", weapon: "foil", status: "scheduled",
  startsAt: "2026-10-10T12:00:00Z", endsAt: "2026-10-10T12:30:00Z", participants: [],
  cancellationDeadline: "2026-10-10T00:00:00Z", partialFeeDeadline: "2026-10-10T06:00:00Z",
  partialFeePercent: 50, lateFeePercent: 100,
  cancelledAt: null, cancellationReason: null, rescheduledFromBookingId: null, rescheduledToBookingId: null,
};

describe("lesson cancellation band", () => {
  it("is free exactly at the deadline", () => {
    expect(cancellationBand(lesson, new Date("2026-10-10T00:00:00Z"))).toEqual({ kind: "free" });
  });
  it("charges the reduced share between the two deadlines", () => {
    expect(cancellationBand(lesson, new Date("2026-10-10T01:00:00Z"))).toEqual({ kind: "fee", percent: 50 });
    expect(cancellationBand(lesson, new Date("2026-10-10T06:00:00Z"))).toEqual({ kind: "fee", percent: 50 });
  });
  it("charges the late share inside the reduced window", () => {
    expect(cancellationBand(lesson, new Date("2026-10-10T07:00:00Z"))).toEqual({ kind: "fee", percent: 100 });
  });
  it("skips the reduced band when the booking has none", () => {
    expect(cancellationBand({ ...lesson, partialFeeDeadline: null }, new Date("2026-10-10T01:00:00Z"))).toEqual({ kind: "fee", percent: 100 });
  });
  it("never charges an unpaid pay-now hold", () => {
    expect(cancellationBand({ ...lesson, awaitingPayment: true }, new Date("2026-10-10T11:00:00Z"))).toEqual({ kind: "held" });
  });
  it("words each band", () => {
    expect(cancellationWarning({ kind: "free" })).toContain("No fee");
    expect(cancellationWarning({ kind: "fee", percent: 50 })).toContain("50%");
    expect(cancellationWarning({ kind: "fee", percent: 100 })).toContain("full lesson price");
  });
});
