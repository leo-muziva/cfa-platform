import { describe, expect, it } from "vitest";
import {
  capeTownDateKey,
  formatCapeTownCompactDate,
  formatCapeTownDate,
  formatCapeTownLessonDate,
  getAvailableDateKeys,
  getInitialBookingSelection,
  safeBookingSlot,
} from "./booking-calendar";
import type { BookableLessonSlot } from "@/types/domain";

function slot(id: string, startsAt: string, isFull = false): BookableLessonSlot {
  return {
    id,
    starts_at: startsAt,
    ends_at: startsAt,
    coach_id: null,
    capacity: 6,
    price: 300,
    is_open: true,
    access_rule: "guest_allowed",
    created_by: "admin",
    created_at: startsAt,
    booked_count: isFull ? 6 : 0,
    remaining_capacity: isFull ? 0 : 6,
    is_full: isFull,
  };
}

describe("booking calendar helpers", () => {
  it("groups timestamps by Cape Town date", () => {
    expect(capeTownDateKey("2026-08-05T22:30:00.000Z")).toBe("2026-08-06");
  });

  it("formats compact and detailed dates in Cape Town time", () => {
    expect(formatCapeTownCompactDate("2026-08-06")).toBe("Thu, 6 Aug");
    expect(formatCapeTownDate("2026-08-06")).toBe("Thursday, 6 August 2026");
    expect(formatCapeTownLessonDate("2026-08-06T16:30:00.000Z")).toBe(
      "Thursday, 6 August 2026, 18:30",
    );
    expect(formatCapeTownLessonDate("2026-08-05T22:30:00.000Z")).toBe(
      "Thursday, 6 August 2026, 00:30",
    );
  });

  it("keeps only UUID booking slot parameters", () => {
    expect(safeBookingSlot("11111111-1111-4111-8111-111111111111")).toBe("11111111-1111-4111-8111-111111111111");
    expect(safeBookingSlot("not-a-slot")).toBeUndefined();
  });

  it("returns sorted unique available dates", () => {
    expect(
      getAvailableDateKeys([
        slot("two", "2026-08-07T16:30:00.000Z"),
        slot("one", "2026-08-06T16:30:00.000Z"),
        slot("one-later", "2026-08-06T17:30:00.000Z"),
      ]),
    ).toEqual(["2026-08-06", "2026-08-07"]);
  });

  it("preserves an available requested slot", () => {
    const slots = [
      slot("first", "2026-08-06T16:30:00.000Z"),
      slot("requested", "2026-08-07T16:30:00.000Z"),
    ];
    expect(getInitialBookingSelection(slots, "requested")).toEqual({
      selectedDate: "2026-08-07",
      selectedSlotId: "requested",
      requestedSlotUnavailable: false,
    });
  });

  it("falls back when the requested slot is missing or full", () => {
    const slots = [
      slot("full", "2026-08-06T16:30:00.000Z", true),
      slot("available", "2026-08-07T16:30:00.000Z"),
    ];
    expect(getInitialBookingSelection(slots, "full")).toEqual({
      selectedDate: "2026-08-07",
      selectedSlotId: "available",
      requestedSlotUnavailable: true,
    });
  });
});
