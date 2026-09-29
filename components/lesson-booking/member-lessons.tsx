"use client";

import Link from "next/link";
import { CalendarClock, Clock3, RotateCcw, Users } from "lucide-react";
import { useActionState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  formatCapeTownLessonDate,
  formatCapeTownTime,
} from "@/lib/booking-calendar";
import { splitMemberLessons } from "@/lib/lesson-booking-ui";
import type {
  AvailableLessonTime,
  LessonBooking,
  Weapon,
} from "@/types/domain";
import type {
  LessonMemberActionState,
  LessonMemberFormAction,
} from "@/components/lesson-booking/coach-booking-calendar";

const initialActionState: LessonMemberActionState = {};

const weaponLabels: Record<Weapon, string> = {
  foil: "Foil",
  epee: "Epee",
  sabre: "Sabre",
};

const statusLabels: Record<LessonBooking["status"], string> = {
  scheduled: "Scheduled",
  attended: "Attended",
  no_show: "No-show",
  cancelled: "Cancelled",
  rescheduled: "Rescheduled",
};

export function MemberLessons({
  lessons,
  availableTimesByBooking,
  nowIso,
  cancelAction,
  rescheduleAction,
}: {
  lessons: LessonBooking[];
  availableTimesByBooking: Record<string, AvailableLessonTime[]>;
  nowIso: string;
  cancelAction: LessonMemberFormAction;
  rescheduleAction: LessonMemberFormAction;
}) {
  const { upcoming, history } = splitMemberLessons(lessons, new Date(nowIso));

  return (
    <div className="space-y-10">
      <LessonSection
        id="upcoming-lessons"
        title="Upcoming"
        description="Manage scheduled lessons before they begin."
        empty="You have no upcoming lessons."
        lessons={upcoming}
        renderLesson={(lesson) => (
          <LessonCard key={lesson.id} lesson={lesson}>
            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              <RescheduleForm
                lesson={lesson}
                times={availableTimesByBooking[lesson.id] ?? []}
                action={rescheduleAction}
              />
              <CancelForm lesson={lesson} action={cancelAction} />
            </div>
            {lesson.cancellationDeadline && (
              <p className="mt-4 flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-xs leading-5 text-amber-950 dark:bg-amber-950/40 dark:text-amber-100">
                <Clock3 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                Free cancellation deadline: {formatCapeTownLessonDate(
                  lesson.cancellationDeadline,
                )}. Later cancellations are charged under the current lesson policy.
              </p>
            )}
          </LessonCard>
        )}
      />

      <LessonSection
        id="lesson-history"
        title="History"
        description="Completed, cancelled, rescheduled, and past lessons."
        empty="Your lesson history is empty."
        lessons={history}
        renderLesson={(lesson) => <LessonCard key={lesson.id} lesson={lesson} />}
      />
    </div>
  );
}

function LessonSection({
  id,
  title,
  description,
  empty,
  lessons,
  renderLesson,
}: {
  id: string;
  title: string;
  description: string;
  empty: string;
  lessons: LessonBooking[];
  renderLesson: (lesson: LessonBooking) => React.ReactNode;
}) {
  return (
    <section aria-labelledby={id}>
      <div>
        <h2 id={id} className="font-serif text-3xl font-light text-slate-950 dark:text-white">{title}</h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-white/75">{description}</p>
      </div>
      {lessons.length === 0 ? (
        <div className="mt-5 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-600 dark:border-white/20 dark:bg-white/5 dark:text-white/75">
          {empty}
        </div>
      ) : (
        <div className="mt-5 grid gap-5">
          {lessons.map(renderLesson)}
        </div>
      )}
    </section>
  );
}

function LessonCard({
  lesson,
  children,
}: {
  lesson: LessonBooking;
  children?: React.ReactNode;
}) {
  return (
    <Card className="overflow-hidden border-[#2d176b]/10 shadow-[0_12px_35px_rgba(37,20,92,0.06)] dark:border-white/15 dark:bg-[#140a2e]/55">
      <CardHeader className="border-b border-slate-100 bg-[linear-gradient(110deg,#fbfaff,#ffffff)] dark:border-white/10 dark:bg-none dark:bg-white/5">
        <CardTitle className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
          <span>
            <span className="block font-serif text-2xl font-light text-slate-950 dark:text-white">
              {formatCapeTownLessonDate(lesson.startsAt)}
            </span>
            <span className="mt-1 block text-sm font-normal text-slate-600 dark:text-white/75">
              with {lesson.coachName}
            </span>
          </span>
          <Badge variant="secondary">{statusLabels[lesson.status]}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-5">
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div className="flex items-center gap-2">
            <CalendarClock className="h-4 w-4 text-[#2d176b] dark:text-violet-300" aria-hidden="true" />
            <dt className="sr-only">Lesson</dt>
            <dd>{weaponLabels[lesson.weapon]} · {formatCapeTownTime(lesson.startsAt)} to {formatCapeTownTime(lesson.endsAt)}</dd>
          </div>
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-[#2d176b] dark:text-violet-300" aria-hidden="true" />
            <dt className="sr-only">Participants</dt>
            <dd>{lesson.participants.map((participant) => participant.fullName).join(", ")}</dd>
          </div>
        </dl>
        {lesson.cancellationReason && (
          <p className="mt-4 text-sm text-slate-600 dark:text-white/75">Reason: {lesson.cancellationReason}</p>
        )}
        {lesson.status === "rescheduled" && lesson.rescheduledToBookingId && (
          <p className="mt-4 flex items-center gap-2 text-sm text-slate-600 dark:text-white/75">
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
            This lesson was moved to a new time.
          </p>
        )}
        {children}
      </CardContent>
    </Card>
  );
}

function RescheduleForm({
  lesson,
  times,
  action,
}: {
  lesson: LessonBooking;
  times: AvailableLessonTime[];
  action: LessonMemberFormAction;
}) {
  const [state, formAction, pending] = useActionState(action, initialActionState);
  const alternatives = times.filter((time) => time.startsAt !== lesson.startsAt);
  return (
    <form action={formAction} className="rounded-2xl border border-slate-200 p-4 dark:border-white/10">
      <input type="hidden" name="bookingId" value={lesson.id} />
      <label htmlFor={"reschedule-" + lesson.id} className="block text-sm font-medium text-slate-900 dark:text-white">
        Move this lesson
        <select
          id={"reschedule-" + lesson.id}
          name="startsAt"
          required
          defaultValue=""
          disabled={alternatives.length === 0 || pending}
          className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-900"
        >
          <option value="" disabled>Choose another free time</option>
          {alternatives.map((time) => (
            <option key={time.startsAt} value={time.startsAt}>
              {formatCapeTownLessonDate(time.startsAt)}
            </option>
          ))}
        </select>
      </label>
      {alternatives.length === 0 && (
        <p className="mt-2 text-xs text-slate-600 dark:text-white/75">
          No alternative times are currently free. You can check the coach calendar again later.
        </p>
      )}
      <ActionMessage state={state} />
      <Button type="submit" variant="outline" disabled={pending || alternatives.length === 0} className="mt-3 min-h-11 w-full">
        {pending ? "Moving…" : "Reschedule"}
      </Button>
    </form>
  );
}

function CancelForm({
  lesson,
  action,
}: {
  lesson: LessonBooking;
  action: LessonMemberFormAction;
}) {
  const [state, formAction, pending] = useActionState(action, initialActionState);
  return (
    <form action={formAction} className="rounded-2xl border border-slate-200 p-4 dark:border-white/10">
      <input type="hidden" name="bookingId" value={lesson.id} />
      <label htmlFor={"cancel-reason-" + lesson.id} className="block text-sm font-medium text-slate-900 dark:text-white">
        Cancellation reason
        <input
          id={"cancel-reason-" + lesson.id}
          name="reason"
          type="text"
          maxLength={300}
          placeholder="Optional"
          className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 py-2"
        />
      </label>
      <ActionMessage state={state} />
      <Button type="submit" variant="outline" disabled={pending} className="mt-3 min-h-11 w-full border-red-200 text-red-800 hover:bg-red-50 dark:border-red-400/30 dark:text-red-300 dark:hover:bg-red-950/40">
        {pending ? "Cancelling…" : "Cancel lesson"}
      </Button>
    </form>
  );
}

function ActionMessage({ state }: { state: LessonMemberActionState }) {
  if (state.error) return <p role="alert" className="mt-3 text-sm text-red-700 dark:text-red-300">{state.error}</p>;
  if (state.success) return <p role="status" className="mt-3 text-sm text-emerald-700 dark:text-emerald-300">{state.success}</p>;
  return null;
}

export function LessonsEmptyCallToAction() {
  return (
    <Link href="/protected/book" className="inline-flex min-h-11 items-center rounded-full bg-[#2d176b] px-5 py-3 font-medium text-white dark:bg-violet-600">
      Book a lesson
    </Link>
  );
}
