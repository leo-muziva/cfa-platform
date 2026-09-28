import { addMonths, format, getDaysInMonth } from "date-fns";
import type { BookableLessonSlot } from "@/types/domain";

// Calendar arithmetic works on "YYYY-MM" / "YYYY-MM-DD" keys that are already
// in Cape Town time. Local Date objects are only built from the key's parts, so
// the browser's own time zone never shifts a day.
function monthStart(monthKey: string): Date {
  const [year, month] = monthKey.split("-").map(Number);
  return new Date(year, month - 1, 1);
}

export function monthDateKeys(monthKey: string): string[] {
  const start = monthStart(monthKey);
  return Array.from({ length: getDaysInMonth(start) }, (_, index) =>
    format(new Date(start.getFullYear(), start.getMonth(), index + 1), "yyyy-MM-dd"),
  );
}

export function shiftMonthKey(monthKey: string, delta: number): string {
  return format(addMonths(monthStart(monthKey), delta), "yyyy-MM");
}

export function formatMonthKey(monthKey: string): { month: string; year: string } {
  const start = monthStart(monthKey);
  return { month: format(start, "MMMM"), year: format(start, "yyyy") };
}

/** Single-letter weekday for a date key, e.g. "M" for a Monday. */
export function weekdayInitial(dateKey: string): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  return format(new Date(year, month - 1, day), "EEEEE");
}

const CAPE_TOWN_TIME_ZONE = "Africa/Johannesburg";

export function capeTownDateKey(isoDate: string): string {
  const parts = new Intl.DateTimeFormat("en-ZA", {
    timeZone: CAPE_TOWN_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(isoDate));
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}
export function formatCapeTownDate(dateKey: string): string {
  const parts = new Intl.DateTimeFormat("en-ZA", {
    timeZone: CAPE_TOWN_TIME_ZONE,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).formatToParts(new Date(`${dateKey}T12:00:00+02:00`));
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.weekday}, ${Number(value.day)} ${value.month} ${value.year}`;
}

export function formatCapeTownCompactDate(dateKey: string): string {
  const parts = new Intl.DateTimeFormat("en-ZA", {
    timeZone: CAPE_TOWN_TIME_ZONE,
    weekday: "short",
    day: "numeric",
    month: "short",
  }).formatToParts(new Date(`${dateKey}T12:00:00+02:00`));
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.weekday}, ${Number(value.day)} ${value.month}`;
}

export function formatCapeTownLessonDate(isoDate: string): string {
  const parts = new Intl.DateTimeFormat("en-ZA", {
    timeZone: CAPE_TOWN_TIME_ZONE,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).formatToParts(new Date(isoDate));
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.weekday}, ${Number(value.day)} ${value.month} ${value.year}, ${formatCapeTownTime(isoDate)}`;
}

export function formatCapeTownTime(isoDate: string): string {
  return new Intl.DateTimeFormat("en-ZA", {
    timeZone: CAPE_TOWN_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(isoDate));
}

export function getAvailableDateKeys(slots: BookableLessonSlot[]): string[] {
  return [...new Set(slots.map((slot) => capeTownDateKey(slot.starts_at)))].sort();
}

export function getInitialBookingSelection(
  slots: BookableLessonSlot[],
  requestedSlotId?: string,
) {
  const requestedSlot = slots.find((slot) => slot.id === requestedSlotId && !slot.is_full);
  const firstAvailable = slots.find((slot) => !slot.is_full) ?? slots[0] ?? null;
  const selectedSlot = requestedSlot ?? firstAvailable;

  return {
    selectedDate: selectedSlot ? capeTownDateKey(selectedSlot.starts_at) : "",
    selectedSlotId: selectedSlot?.is_full ? "" : (selectedSlot?.id ?? ""),
    requestedSlotUnavailable: Boolean(requestedSlotId && !requestedSlot),
  };
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function safeBookingSlot(value: string | null | undefined): string | undefined {
  return value && UUID_PATTERN.test(value) ? value : undefined;
}
