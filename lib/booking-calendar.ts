import type { BookableLessonSlot } from "@/types/domain";

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
  return new Intl.DateTimeFormat("en-ZA", {
    timeZone: CAPE_TOWN_TIME_ZONE,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(`${dateKey}T12:00:00+02:00`));
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
