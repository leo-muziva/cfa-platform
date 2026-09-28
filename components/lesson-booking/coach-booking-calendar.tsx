"use client";

import { CalendarDays, Check, ShieldCheck, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { GlassButton } from "@/components/ui/glass-auth";
import { GlassCalendar } from "@/components/ui/glass-calendar";
import { GlassDialog } from "@/components/ui/glass-dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  capeTownDateKey,
  formatCapeTownCompactDate,
  formatCapeTownLessonDate,
  formatCapeTownTime,
} from "@/lib/booking-calendar";
import { cn } from "@/lib/utils";
import {
  BOOKING_CONTENTION_MESSAGE,
  isValidLessonParticipantSelection,
  lessonBillingCopy,
  lessonBillingDetailCopy,
  firstAvailableLessonTime,
  lessonDateHasAvailableTime,
  lessonDates,
  timesForLessonDate,
  toggleLessonParticipant,
} from "@/lib/lesson-booking-ui";
import { CheckoutButton } from "@/components/payments/checkout-button";
import type {
  LessonTimeOption,
  LessonBookingErrorCode,
  LessonCoachSummary,
  LessonParticipant,
  LessonQuote,
  Weapon,
} from "@/types/domain";

export interface LessonMemberActionState {
  success?: string;
  error?: string;
  errorCode?: LessonBookingErrorCode;
  bookingId?: string;
  checkoutRequired?: boolean;
}

export type LessonMemberFormAction = (
  previousState: LessonMemberActionState,
  formData: FormData,
) => Promise<LessonMemberActionState>;

const initialActionState: LessonMemberActionState = {};

const weaponLabels: Record<Weapon, string> = {
  foil: "Foil",
  epee: "Epee",
  sabre: "Sabre",
};

export function CoachBookingCalendar({
  coach,
  times,
  participants,
  quotes,
  canSeeQuote,
  createAction,
}: {
  coach: LessonCoachSummary;
  times: LessonTimeOption[];
  participants: LessonParticipant[];
  quotes: LessonQuote[];
  canSeeQuote: boolean;
  createAction: LessonMemberFormAction;
}) {
  const router = useRouter();
  const availableDates = useMemo(() => lessonDates(times), [times]);
  const initialDate = availableDates.find((date) => lessonDateHasAvailableTime(times, date)) ?? availableDates[0] ?? "";
  const [selectedDate, setSelectedDate] = useState(initialDate);
  const [selectedTime, setSelectedTime] = useState(() => firstAvailableLessonTime(times, initialDate)?.startsAt ?? "");
  const [selectedWeapon, setSelectedWeapon] = useState<Weapon>(coach.weapons[0]);
  const defaultParticipant = participants.find((participant) => participant.isSelf) ?? participants[0];
  const [selectedParticipants, setSelectedParticipants] = useState<string[]>(
    defaultParticipant ? [defaultParticipant.id] : [],
  );
  const [attemptedSlot, setAttemptedSlot] = useState<LessonTimeOption | null>(null);
  const [state, formAction, pending] = useActionState(createAction, initialActionState);

  const timesForDate = timesForLessonDate(times, selectedDate);
  const hasAvailableTimes = times.some((time) => time.isAvailable);
  const selected = times.find((time) => time.startsAt === selectedTime && time.isAvailable) ?? null;
  const quote = quotes.find(
    (item) => item.participantCount === selectedParticipants.length,
  ) ?? null;
  const requiresPayNow = selectedParticipants.some((participantId) => participants.find((participant) => participant.id === participantId)?.membershipStatus === "guest");

  useEffect(() => {
    if (selectedTime && !times.some((time) => time.startsAt === selectedTime)) {
      setSelectedTime("");
    }
  }, [selectedTime, times]);

  useEffect(() => {
    if (state.errorCode !== "slot_taken") return;
    // Snapshot what was attempted before clearing it — router.refresh() below
    // re-fetches `times`, which will no longer contain this slot, so `selected`
    // itself is about to go stale.
    setAttemptedSlot(selected);
    setSelectedTime("");
    router.refresh();
  }, [router, state, selected]);

  // Only used for the "today" dot, so a server/client mismatch around
  // midnight is harmless; it is fixed once on mount rather than per render.
  const [todayKey] = useState(() => capeTownDateKey(new Date().toISOString()));

  const chooseDate = (date: string) => {
    setSelectedDate(date);
    setSelectedTime(firstAvailableLessonTime(times, date)?.startsAt ?? "");
  };

  if (times.length === 0 && !attemptedSlot) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-slate-50 p-6 sm:p-8">
        <h2 className="font-serif text-2xl text-slate-950">No scheduled times right now</h2>
        <p className="mt-2 text-sm text-slate-600">
          {coach.fullName} has no scheduled 30-minute lessons in the next four weeks.
          Check again later or choose another coach.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-7 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
      <GlassDialog open={attemptedSlot !== null} onClose={() => setAttemptedSlot(null)} labelledBy="slot-unavailable-heading">
        <h2 id="slot-unavailable-heading" className="text-xl font-semibold text-foreground">Time no longer available</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {attemptedSlot
            ? `${coach.fullName} isn't available at ${formatCapeTownLessonDate(attemptedSlot.startsAt)} anymore. Pick another time.`
            : BOOKING_CONTENTION_MESSAGE}
        </p>
        <GlassButton type="button" className="mt-6" onClick={() => setAttemptedSlot(null)}>
          Choose another time
        </GlassButton>
      </GlassDialog>

      <div className="space-y-6">
        <section aria-labelledby="lesson-weapon-heading" className="rounded-3xl border border-[#2d176b]/10 bg-white p-5 shadow-sm sm:p-7">
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-1 h-5 w-5 text-[#2d176b]" aria-hidden="true" />
            <div>
              <h2 id="lesson-weapon-heading" className="font-serif text-2xl text-slate-950">Choose a weapon</h2>
              <p className="mt-1 text-sm text-slate-600">Only weapons offered by this coach are shown.</p>
            </div>
          </div>
          <fieldset className="mt-5">
            <legend className="sr-only">Lesson weapon</legend>
            <div className="flex flex-wrap gap-2">
              {coach.weapons.map((weapon) => (
                <label key={weapon} className={"cursor-pointer rounded-full border px-5 py-2.5 text-sm font-medium transition-colors has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[#2d176b] " + (selectedWeapon === weapon ? "border-[#2d176b] bg-[#2d176b] text-white" : "border-[#2d176b]/15 bg-white text-[#423368] hover:border-[#2d176b]/40")}>
                  <input type="radio" name="visible-weapon" value={weapon} checked={selectedWeapon === weapon} onChange={() => setSelectedWeapon(weapon)} className="sr-only" />
                  {weaponLabels[weapon]}
                </label>
              ))}
            </div>
          </fieldset>
        </section>

        <section aria-labelledby="lesson-date-heading" className="rounded-3xl border border-[#2d176b]/10 bg-white p-5 shadow-sm sm:p-7">
          <div className="flex items-start gap-3">
            <CalendarDays className="mt-1 h-5 w-5 text-[#2d176b]" aria-hidden="true" />
            <div>
              <h2 id="lesson-date-heading" className="font-serif text-2xl text-slate-950">Choose a date and time</h2>
              <p className="mt-1 text-sm text-slate-600">All dates and times use Cape Town time.</p>
            </div>
          </div>
          {!hasAvailableTimes && (
            <p className="mt-5 rounded-xl bg-slate-50 p-4 text-sm text-slate-600" role="status">
              No bookable times are currently available. Scheduled times are shown below.
            </p>
          )}
          <GlassCalendar
            className="mt-5"
            selectedDate={selectedDate}
            onDateSelect={chooseDate}
            isDateDisabled={(date) => !lessonDateHasAvailableTime(times, date)}
            minMonth={availableDates[0]?.slice(0, 7)}
            maxMonth={availableDates.at(-1)?.slice(0, 7)}
            todayKey={todayKey}
            aside={
              <TimeSlotColumn
                selectedDate={selectedDate}
                times={timesForDate}
                selectedTime={selectedTime}
                onSelect={setSelectedTime}
              />
            }
          />
        </section>

        <section aria-labelledby="lesson-participants-heading" className="rounded-3xl border border-[#2d176b]/10 bg-white p-5 shadow-sm sm:p-7">
          <div className="flex items-start gap-3">
            <Users className="mt-1 h-5 w-5 text-[#2d176b]" aria-hidden="true" />
            <div>
              <h2 id="lesson-participants-heading" className="font-serif text-2xl text-slate-950">Choose one or two fencers</h2>
              <p className="mt-1 text-sm text-slate-600">A double lesson keeps both fencers with the same coach for one 30-minute time.</p>
            </div>
          </div>
          <fieldset className="mt-5">
            <legend className="sr-only">Lesson participants</legend>
            <div className="grid gap-3 sm:grid-cols-2">
              {participants.map((participant) => {
                const checked = selectedParticipants.includes(participant.id);
                const disabled = !checked && selectedParticipants.length >= 2;
                return (
                  <label key={participant.id} className={"flex min-h-14 items-center gap-3 rounded-2xl border px-4 py-3 has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[#2d176b] " + (checked ? "border-[#2d176b] bg-violet-50" : "border-slate-200 bg-white") + (disabled ? " cursor-not-allowed opacity-50" : " cursor-pointer")}>
                    <input type="checkbox" checked={checked} disabled={disabled} onChange={() => setSelectedParticipants((current) => toggleLessonParticipant(current, participant.id))} className="h-5 w-5 accent-[#2d176b]" />
                    <span className="font-medium text-slate-900">{participant.fullName}{participant.isSelf ? " (you)" : ""}</span>
                  </label>
                );
              })}
            </div>
          </fieldset>
          <p className="mt-3 text-sm text-slate-600" role="status" aria-live="polite">{selectedParticipants.length} of 2 fencers selected</p>
        </section>
      </div>

      <aside className="h-fit rounded-3xl bg-[linear-gradient(150deg,#25145c,#412686)] p-6 text-white shadow-2xl xl:sticky xl:top-28 sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#f0c71b]">Confirm lesson</p>
        <h2 className="mt-3 font-serif text-3xl font-light">{coach.fullName}</h2>
        {selected ? (
          <>
            <p className="mt-4 text-lg">{formatCapeTownLessonDate(selected.startsAt)}</p>
            <p className="mt-1 text-sm text-white/70">{weaponLabels[selectedWeapon]} · 30 minutes · Cape Town time</p>
          </>
        ) : (
          <p className="mt-4 text-sm text-white/70">Choose an available time to continue.</p>
        )}
        <div className="mt-5 rounded-2xl border border-white/15 bg-white/10 p-4">
          <p className="text-sm font-medium">{lessonBillingCopy({ canSeeQuote, quote: canSeeQuote ? quote : null })}</p>
          {lessonBillingDetailCopy(canSeeQuote) && (
            <p className="mt-1 text-xs text-white/65">{lessonBillingDetailCopy(canSeeQuote)}</p>
          )}
        </div>
        <form action={formAction} className="mt-6 space-y-4">
          <input type="hidden" name="coachId" value={coach.coachId} />
          <input type="hidden" name="startsAt" value={selectedTime} />
          <input type="hidden" name="weapon" value={selectedWeapon} />
          {selectedParticipants.map((participantId) => <input key={participantId} type="hidden" name="participantIds" value={participantId} />)}
          {canSeeQuote && (requiresPayNow ? (
            <>
              <input type="hidden" name="paymentOption" value="pay_now" />
              <p className="text-sm text-white/85">Guest lessons are held while you complete payment now.</p>
            </>
          ) : (
            <label className="block space-y-2 text-sm">
              <span>Payment option</span>
              <select name="paymentOption" defaultValue="pay_later" className="min-h-12 w-full rounded-xl border border-white/30 bg-[#25145c] px-3 text-white">
                <option value="pay_later">Pay later on my invoice</option>
                <option value="pay_now">Hold my lesson and pay now</option>
              </select>
            </label>
          ))}
          {state.error && state.errorCode !== "slot_taken" && <p role="alert" className="rounded-xl bg-red-950/40 p-3 text-sm text-red-50">{state.error}</p>}
          {state.success && <p role="status" className="rounded-xl bg-emerald-950/40 p-3 text-sm text-emerald-50">{state.success}</p>}
          <Button type="submit" disabled={pending || !selected || !isValidLessonParticipantSelection(selectedParticipants)} className="min-h-12 w-full rounded-full bg-white text-[#25145c] hover:bg-slate-100">
            {pending ? "Booking…" : "Confirm booking"}
          </Button>
        </form>
        {state.checkoutRequired && state.bookingId && quote && (
          <CheckoutButton bookingId={state.bookingId} />
        )}
      </aside>
    </div>
  );
}

function TimeSlotColumn({
  selectedDate,
  times,
  selectedTime,
  onSelect,
}: {
  selectedDate: string;
  times: LessonTimeOption[];
  selectedTime: string;
  onSelect: (startsAt: string) => void;
}) {
  // Absolutely filled so the column takes the calendar's height and scrolls
  // on its own instead of stretching the glass panel.
  return (
    <div className="absolute inset-0 py-4">
      <ScrollArea className="h-full [&_[data-orientation=vertical]>div]:bg-white/30">
        <div className="space-y-3">
          <p className="px-5 text-sm font-semibold text-white">
            {selectedDate ? formatCapeTownCompactDate(selectedDate) : "Choose a date"}
          </p>
          {times.length === 0 ? (
            <p className="px-5 text-sm text-white/70">There are no scheduled times on this date.</p>
          ) : (
            <div className="grid gap-1.5 px-5 max-sm:grid-cols-2" role="group" aria-label="Scheduled lesson times">
              {times.map((time) => {
                const isSelected = selectedTime === time.startsAt;
                return (
                  <button
                    key={time.startsAt}
                    type="button"
                    onClick={() => time.isAvailable && onSelect(time.startsAt)}
                    disabled={!time.isAvailable}
                    aria-pressed={isSelected}
                    aria-label={`${formatCapeTownTime(time.startsAt)}${time.isAvailable ? "" : ", unavailable"}`}
                    className={cn(
                      "flex min-h-10 w-full items-center justify-between rounded-xl border px-3 text-sm font-medium transition-colors",
                      "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-cfa-gold",
                      isSelected
                        ? "border-cfa-gold bg-cfa-gold/20 text-white"
                        : time.isAvailable
                          ? "border-white/20 bg-white/5 text-white hover:border-white/45 hover:bg-white/15"
                          : "cursor-not-allowed border-white/10 text-white/40 line-through",
                    )}
                  >
                    <span>{formatCapeTownTime(time.startsAt)}</span>
                    {isSelected && <Check className="h-4 w-4 text-cfa-gold" aria-hidden="true" />}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
