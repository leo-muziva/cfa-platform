"use client";

import Link from "next/link";
import { CalendarDays, Check, Clock, ShieldCheck, Users } from "lucide-react";
import { useMemo, useState } from "react";
import { bookLessonAction } from "@/app/actions/platform";
import { ActionForm } from "@/components/portal/action-form";
import {
  capeTownDateKey,
  formatCapeTownDate,
  formatCapeTownTime,
  getAvailableDateKeys,
  getInitialBookingSelection,
} from "@/lib/booking-calendar";
import type { BookableLessonSlot } from "@/types/domain";

interface BookingParticipantOption {
  id: string;
  label: string;
}

export function BookingCalendar({
  slots,
  requestedSlotId,
  isAuthenticated,
  participants = [],
  isDependent = false,
  bookingContextError,
}: {
  slots: BookableLessonSlot[];
  requestedSlotId?: string;
  isAuthenticated: boolean;
  participants?: BookingParticipantOption[];
  isDependent?: boolean;
  bookingContextError?: string;
}) {
  const initial = useMemo(
    () => getInitialBookingSelection(slots, requestedSlotId),
    [slots, requestedSlotId],
  );
  const [selectedDate, setSelectedDate] = useState(initial.selectedDate);
  const [selectedSlotId, setSelectedSlotId] = useState(initial.selectedSlotId);
  const availableDates = useMemo(() => getAvailableDateKeys(slots), [slots]);
  const slotsForDate = slots.filter(
    (slot) => capeTownDateKey(slot.starts_at) === selectedDate,
  );
  const selectedSlot = slots.find((slot) => slot.id === selectedSlotId) ?? null;

  const chooseDate = (dateKey: string) => {
    setSelectedDate(dateKey);
    const firstSlot = slots.find(
      (slot) => capeTownDateKey(slot.starts_at) === dateKey && !slot.is_full,
    );
    setSelectedSlotId(firstSlot?.id ?? "");
  };

  if (slots.length === 0) {
    return (
      <div className="cfa-light-card rounded-2xl p-6 md:p-8">
        <h2 className="text-2xl tracking-[-0.03em]">No lessons are open right now</h2>
        <p className="mt-3 text-[#625b73]">
          Please check again later or contact CFA from the homepage.
        </p>
        <Link
          href="/#contact"
          className="mt-6 inline-flex rounded-full bg-[#2d176b] px-6 py-3 font-medium text-white hover:bg-[#3c2186]"
        >
          Contact CFA
        </Link>
      </div>
    );
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
      <div className="space-y-6">
        {initial.requestedSlotUnavailable && (
          <p role="status" className="rounded-2xl border border-[#8a6810]/25 bg-[#fffaf0] p-4 text-sm text-[#6f5310]">
            The lesson you originally selected is no longer available. Choose another time below.
          </p>
        )}

        <section className="cfa-light-card rounded-2xl p-6 md:p-8" aria-labelledby="booking-date-heading">
          <div className="flex items-start gap-3">
            <CalendarDays className="mt-1 h-6 w-6 text-[#2d176b]" aria-hidden="true" />
            <div>
              <h2 id="booking-date-heading" className="text-2xl tracking-[-0.03em]">Choose a date</h2>
              <p className="mt-1 text-[#625b73]">Times are shown in Cape Town time.</p>
            </div>
          </div>

          <label className="mt-6 block max-w-xs font-medium" htmlFor="lesson-date">
            Lesson date
            <input
              id="lesson-date"
              type="date"
              value={selectedDate}
              min={availableDates[0]}
              max={availableDates.at(-1)}
              onChange={(event) => chooseDate(event.target.value)}
              className="mt-2 w-full rounded-xl border border-[#2d176b]/20 bg-white px-4 py-3 text-[#25145c] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#ffd21c]"
            />
          </label>

          <div className="mt-5 flex flex-wrap gap-2" aria-label="Dates with available lessons">
            {availableDates.map((dateKey) => (
              <button
                key={dateKey}
                type="button"
                onClick={() => chooseDate(dateKey)}
                className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                  selectedDate === dateKey
                    ? "bg-[#2d176b] text-white"
                    : "border border-[#2d176b]/15 bg-white text-[#625b73] hover:border-[#8a6810]/50"
                }`}
              >
                {new Intl.DateTimeFormat("en-ZA", { day: "numeric", month: "short" }).format(
                  new Date(`${dateKey}T12:00:00+02:00`),
                )}
              </button>
            ))}
          </div>
        </section>

        <section className="cfa-light-card rounded-2xl p-6 md:p-8" aria-labelledby="booking-time-heading">
          <div className="flex items-start gap-3">
            <Clock className="mt-1 h-6 w-6 text-[#2d176b]" aria-hidden="true" />
            <div>
              <h2 id="booking-time-heading" className="text-2xl tracking-[-0.03em]">Choose a time</h2>
              <p className="mt-1 text-[#625b73]">
                {selectedDate ? formatCapeTownDate(selectedDate) : "Select a date first"}
              </p>
            </div>
          </div>

          {slotsForDate.length === 0 ? (
            <p className="mt-6 rounded-xl bg-[#faf9fd] p-4 text-[#625b73]">
              There are no open times on this date. Choose one of the available dates above.
            </p>
          ) : (
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {slotsForDate.map((slot) => {
                const selected = slot.id === selectedSlotId;
                return (
                  <button
                    key={slot.id}
                    type="button"
                    disabled={slot.is_full}
                    onClick={() => setSelectedSlotId(slot.id)}
                    aria-pressed={selected}
                    className={`rounded-2xl border p-5 text-left transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#ffd21c] ${
                      selected
                        ? "border-[#8a6810] bg-[#fffaf0] shadow-[0_12px_30px_rgba(45,23,107,0.08)]"
                        : "border-[#2d176b]/10 bg-white hover:-translate-y-0.5 hover:border-[#8a6810]/40"
                    } disabled:cursor-not-allowed disabled:bg-gray-100 disabled:opacity-60`}
                  >
                    <span className="flex items-center justify-between gap-3">
                      <span className="text-xl font-medium">{formatCapeTownTime(slot.starts_at)}</span>
                      {selected && <Check className="h-5 w-5 text-[#8a6810]" aria-hidden="true" />}
                    </span>
                    <span className="mt-2 block text-sm text-[#625b73]">R{Number(slot.price).toFixed(2)}</span>
                    <span className="mt-3 flex items-center gap-2 text-xs text-[#625b73]">
                      <Users className="h-4 w-4" aria-hidden="true" />
                      {slot.is_full
                        ? "Full"
                        : slot.remaining_capacity === null
                          ? "Places available"
                          : `${slot.remaining_capacity} place${slot.remaining_capacity === 1 ? "" : "s"} left`}
                    </span>
                    <span className="mt-2 flex items-center gap-2 text-xs text-[#625b73]">
                      <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                      {slot.access_rule === "active_members_only" ? "Active members only" : "Guests welcome"}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </section>
      </div>

      <aside className="h-fit rounded-2xl bg-[#25145c] p-6 text-white shadow-2xl lg:sticky lg:top-24 md:p-8">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#f0c71b]">Your selection</p>
        {selectedSlot ? (
          <>
            <h2 className="mt-4 text-2xl tracking-[-0.03em]">{formatCapeTownDate(capeTownDateKey(selectedSlot.starts_at))}</h2>
            <p className="mt-2 text-lg text-white/80">
              {formatCapeTownTime(selectedSlot.starts_at)} - {formatCapeTownTime(selectedSlot.ends_at)}
            </p>
            <p className="mt-1 text-white/70">R{Number(selectedSlot.price).toFixed(2)}</p>

            {bookingContextError ? (
              <p role="alert" className="mt-6 rounded-xl bg-red-500/15 p-4 text-sm text-red-100">
                {bookingContextError}
              </p>
            ) : !isAuthenticated ? (
              <>
                <p className="mt-6 text-sm leading-6 text-white/70">
                  You can browse without an account. Log in or create one when you are ready to proceed.
                </p>
                <Link
                  href={`/auth/login?next=${encodeURIComponent(`/book?slot=${selectedSlot.id}`)}`}
                  className="mt-6 inline-flex w-full justify-center rounded-full bg-white px-6 py-3 font-medium text-[#25145c] transition-colors hover:bg-gray-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#ffd21c]"
                >
                  Log in to continue
                </Link>
              </>
            ) : (
              <ActionForm
                action={bookLessonAction}
                submitLabel="Confirm booking"
                className="mt-6 space-y-4"
                submitClassName="w-full rounded-full bg-white text-[#25145c] hover:bg-gray-100"
              >
                <input type="hidden" name="lesson_slot_id" value={selectedSlot.id} />
                <label className="block text-sm font-medium" htmlFor="booking-fencer">
                  Who is this lesson for?
                  <select
                    id="booking-fencer"
                    name="fencer_id"
                    className="mt-2 w-full rounded-xl border border-white/20 bg-white/10 px-3 py-3 text-white"
                  >
                    {participants.map((participant) => (
                      <option key={participant.id} value={participant.id} className="text-black">
                        {participant.label}
                      </option>
                    ))}
                  </select>
                </label>

                {isDependent ? (
                  <>
                    <input type="hidden" name="payment_option" value="pay_later" />
                    <p className="text-sm text-white/70">
                      Payment will be handled by your active billing guardian.
                    </p>
                  </>
                ) : (
                  <label className="block text-sm font-medium" htmlFor="booking-payment">
                    Payment option
                    <select
                      id="booking-payment"
                      name="payment_option"
                      className="mt-2 w-full rounded-xl border border-white/20 bg-white/10 px-3 py-3 text-white"
                    >
                      <option value="pay_now" className="text-black">Pay now - R{Number(selectedSlot.price).toFixed(2)}</option>
                      <option value="pay_later" className="text-black">Pay later</option>
                    </select>
                  </label>
                )}
              </ActionForm>
            )}
          </>
        ) : (
          <p className="mt-4 text-white/70">Choose an available lesson time to continue.</p>
        )}
      </aside>
    </div>
  );
}
