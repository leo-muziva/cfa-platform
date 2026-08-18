"use client";

import { CalendarDays, Check, Clock, ShieldCheck, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  formatCapeTownCompactDate,
  formatCapeTownDate,
  formatCapeTownLessonDate,
  formatCapeTownTime,
} from "@/lib/booking-calendar";
import {
  BOOKING_CONTENTION_MESSAGE,
  isValidLessonParticipantSelection,
  lessonBillingCopy,
  lessonBillingDetailCopy,
  lessonDates,
  timesForLessonDate,
  toggleLessonParticipant,
} from "@/lib/lesson-booking-ui";
import type {
  AvailableLessonTime,
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
  times: AvailableLessonTime[];
  participants: LessonParticipant[];
  quotes: LessonQuote[];
  canSeeQuote: boolean;
  createAction: LessonMemberFormAction;
}) {
  const router = useRouter();
  const availableDates = useMemo(() => lessonDates(times), [times]);
  const [selectedDate, setSelectedDate] = useState(availableDates[0] ?? "");
  const [selectedTime, setSelectedTime] = useState("");
  const [selectedWeapon, setSelectedWeapon] = useState<Weapon>(coach.weapons[0]);
  const defaultParticipant = participants.find((participant) => participant.isSelf) ?? participants[0];
  const [selectedParticipants, setSelectedParticipants] = useState<string[]>(
    defaultParticipant ? [defaultParticipant.id] : [],
  );
  const [contentionMessage, setContentionMessage] = useState("");
  const contentionRef = useRef<HTMLParagraphElement>(null);
  const [state, formAction, pending] = useActionState(createAction, initialActionState);

  const timesForDate = timesForLessonDate(times, selectedDate);
  const selected = times.find((time) => time.startsAt === selectedTime) ?? null;
  const quote = quotes.find(
    (item) => item.participantCount === selectedParticipants.length,
  ) ?? null;

  useEffect(() => {
    if (selectedTime && !times.some((time) => time.startsAt === selectedTime)) {
      setSelectedTime("");
    }
  }, [selectedTime, times]);

  useEffect(() => {
    if (state.errorCode !== "slot_taken") return;
    setSelectedTime("");
    setContentionMessage(BOOKING_CONTENTION_MESSAGE);
    router.refresh();
    window.requestAnimationFrame(() => contentionRef.current?.focus());
  }, [router, state]);

  const chooseDate = (date: string) => {
    setSelectedDate(date);
    setSelectedTime("");
    setContentionMessage("");
  };

  if (times.length === 0 && !contentionMessage) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-slate-50 p-6 sm:p-8">
        <h2 className="font-serif text-2xl text-slate-950">No free times right now</h2>
        <p className="mt-2 text-sm text-slate-600">
          {coach.fullName} has no bookable 30-minute lessons in the next four weeks.
          Check again later or choose another coach.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-7 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
      <div className="space-y-6">
        {contentionMessage && (
          <p
            ref={contentionRef}
            role="alert"
            tabIndex={-1}
            className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm font-medium text-amber-950 outline-none focus-visible:ring-2 focus-visible:ring-amber-700"
          >
            {contentionMessage}
          </p>
        )}

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
              <h2 id="lesson-date-heading" className="font-serif text-2xl text-slate-950">Choose a date</h2>
              <p className="mt-1 text-sm text-slate-600">All dates and times use Cape Town time.</p>
            </div>
          </div>
          <label htmlFor="lesson-date" className="mt-5 block max-w-xs text-sm font-medium text-slate-800">
            Lesson date
            <input id="lesson-date" type="date" value={selectedDate} min={availableDates[0]} max={availableDates.at(-1)} onChange={(event) => chooseDate(event.target.value)} className="mt-2 min-h-11 w-full rounded-xl border border-[#2d176b]/20 bg-white px-4 py-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#2d176b]" />
          </label>
          <div className="mt-4 flex flex-wrap gap-2" aria-label="Dates with free lesson times">
            {availableDates.map((date) => (
              <button key={date} type="button" onClick={() => chooseDate(date)} aria-pressed={selectedDate === date} className={"min-h-11 rounded-full px-4 py-2 text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2d176b] " + (selectedDate === date ? "bg-[#2d176b] text-white" : "border border-[#2d176b]/15 text-slate-700 hover:border-[#2d176b]/40")}>
                {formatCapeTownCompactDate(date)}
              </button>
            ))}
          </div>
        </section>

        <section aria-labelledby="lesson-time-heading" className="rounded-3xl border border-[#2d176b]/10 bg-white p-5 shadow-sm sm:p-7">
          <div className="flex items-start gap-3">
            <Clock className="mt-1 h-5 w-5 text-[#2d176b]" aria-hidden="true" />
            <div>
              <h2 id="lesson-time-heading" className="font-serif text-2xl text-slate-950">Choose a time</h2>
              <p className="mt-1 text-sm text-slate-600">{selectedDate ? formatCapeTownDate(selectedDate) : "Choose a date first"}</p>
            </div>
          </div>
          {timesForDate.length === 0 ? (
            <p className="mt-5 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">There are no free times on this date.</p>
          ) : (
            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3" aria-label="Free lesson times">
              {timesForDate.map((time) => {
                const isSelected = selectedTime === time.startsAt;
                return (
                  <button key={time.startsAt} type="button" onClick={() => { setSelectedTime(time.startsAt); setContentionMessage(""); }} aria-pressed={isSelected} className={"flex min-h-14 items-center justify-between rounded-2xl border px-4 py-3 text-left font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#2d176b] " + (isSelected ? "border-[#8a6810] bg-amber-50 text-[#5b4308]" : "border-[#2d176b]/10 bg-white text-slate-800 hover:border-[#2d176b]/35")}>
                    {formatCapeTownTime(time.startsAt)}
                    {isSelected && <Check className="h-4 w-4" aria-hidden="true" />}
                  </button>
                );
              })}
            </div>
          )}
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
          <p className="mt-4 text-sm text-white/70">Choose a free time to continue.</p>
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
          {state.error && state.errorCode !== "slot_taken" && <p role="alert" className="rounded-xl bg-red-950/40 p-3 text-sm text-red-50">{state.error}</p>}
          {state.success && <p role="status" className="rounded-xl bg-emerald-950/40 p-3 text-sm text-emerald-50">{state.success}</p>}
          <Button type="submit" disabled={pending || !selected || !isValidLessonParticipantSelection(selectedParticipants)} className="min-h-12 w-full rounded-full bg-white text-[#25145c] hover:bg-slate-100">
            {pending ? "Booking…" : "Confirm booking"}
          </Button>
        </form>
      </aside>
    </div>
  );
}
