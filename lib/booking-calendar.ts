import type { BookableLessonSlot } from "@/types/domain";

const CAPE_TOWN_TIME_ZONE = "Africa/Johannesburg";

// Building an Intl.DateTimeFormat is far slower than using one, and the
// booking calendar formats hundreds of times per render, so each format is
// created once.
const DATE_KEY_FORMAT = new Intl.DateTimeFormat("en-ZA", {
  timeZone: CAPE_TOWN_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit",
});
const LONG_DATE_FORMAT = new Intl.DateTimeFormat("en-ZA", {
  timeZone: CAPE_TOWN_TIME_ZONE, weekday: "long", day: "numeric", month: "long", year: "numeric",
});
const COMPACT_DATE_FORMAT = new Intl.DateTimeFormat("en-ZA", {
  timeZone: CAPE_TOWN_TIME_ZONE, weekday: "short", day: "numeric", month: "short",
});
const TIME_FORMAT = new Intl.DateTimeFormat("en-ZA", {
  timeZone: CAPE_TOWN_TIME_ZONE, hour: "2-digit", minute: "2-digit", hour12: false,
});

export function capeTownDateKey(isoDate: string): string {
  const parts = DATE_KEY_FORMAT.formatToParts(new Date(isoDate));
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}
export function formatCapeTownDate(dateKey: string): string {
  const parts = LONG_DATE_FORMAT.formatToParts(new Date(`${dateKey}T12:00:00+02:00`));
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.weekday}, ${Number(value.day)} ${value.month} ${value.year}`;
}

export function formatCapeTownCompactDate(dateKey: string): string {
  const parts = COMPACT_DATE_FORMAT.formatToParts(new Date(`${dateKey}T12:00:00+02:00`));
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.weekday}, ${Number(value.day)} ${value.month}`;
}

export function formatCapeTownLessonDate(isoDate: string): string {
  const parts = LONG_DATE_FORMAT.formatToParts(new Date(isoDate));
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.weekday}, ${Number(value.day)} ${value.month} ${value.year}, ${formatCapeTownTime(isoDate)}`;
}

export function formatCapeTownTime(isoDate: string): string {
  return TIME_FORMAT.format(new Date(isoDate));
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
