import { AlertTriangle, CalendarDays, CheckCircle2, Clock3, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCapeTownLessonDate, formatCapeTownTime } from "@/lib/booking-calendar";
import { OperationForm, type LessonOperationState } from "./operation-form";

// A lesson on the coach's agenda. No money fields.
export interface CoachAgendaLesson {
  bookingId: string;
  coachId: string;
  startsAt: string;
  endsAt: string;
  weapon: string;
  status: string;
  participantNames: string[];
  participants?: Array<{ id: string; fullName: string; attendanceOutcome?: 'attended' | 'no_show' | null }>;
}

/**
 * Splits scheduled lessons into: finished but still needing attendance,
 * later today, and the rest of the next seven days.
 */
export function partitionCoachAgenda(items: CoachAgendaLesson[], now = new Date()) {
  const day = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Johannesburg",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const todayKey = day.format(now);
  const weekEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const scheduled = items.filter((item) => item.status === "scheduled");

  return {
    outcomeRequired: scheduled.filter((item) => new Date(item.endsAt) <= now),
    today: scheduled.filter((item) => new Date(item.startsAt) > now && day.format(new Date(item.startsAt)) === todayKey),
    upcoming: scheduled.filter((item) => new Date(item.startsAt) > now && day.format(new Date(item.startsAt)) !== todayKey && new Date(item.startsAt) <= weekEnd),
  };
}

// Time, weapon and participant names for one lesson.
function LessonIdentity({ lesson }: { lesson: CoachAgendaLesson }) {
  return (
    <div className="min-w-0 space-y-2">
      <p className="font-semibold text-slate-950 dark:text-white">{formatCapeTownLessonDate(lesson.startsAt)}</p>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
        <span className="inline-flex items-center gap-1"><Clock3 className="h-4 w-4" aria-hidden="true" />{formatCapeTownTime(lesson.startsAt)} - {formatCapeTownTime(lesson.endsAt)}</span>
        <span className="inline-flex items-center gap-1 capitalize"><Users className="h-4 w-4" aria-hidden="true" />{lesson.participantNames.join(" and ")}</span>
      </div>
      <Badge variant="secondary" className="capitalize">{lesson.weapon}</Badge>
    </div>
  );
}

// Attended / no-show buttons, per participant in a shared lesson.
function OutcomeControls({
  lesson,
  action,
}: {
  lesson: CoachAgendaLesson;
  action: (state: LessonOperationState, formData: FormData) => Promise<LessonOperationState>;
}) {
  return (
    <div className="space-y-3 lg:w-[22rem]">
      {(lesson.participants ?? []).map((participant) => (
        <div key={participant.id} className="space-y-2">
          <p className="text-sm font-medium">{participant.fullName}</p>
          {participant.attendanceOutcome ? <Badge variant="secondary">{participant.attendanceOutcome === "attended" ? "Attended" : "No-show"}</Badge> : (
            <div className="grid grid-cols-2 gap-2" aria-label={`Record outcome for ${participant.fullName}`}>
              {(["attended", "no_show"] as const).map((outcome) => (
                <OperationForm key={outcome} action={action} submitLabel={outcome === "attended" ? "Attended" : "No-show"} pendingLabel="Recording..." variant={outcome === "attended" ? "default" : "outline"} className="space-y-1" submitClassName="w-full">
                  <input type="hidden" name="bookingId" value={lesson.bookingId} />
                  <input type="hidden" name="participantId" value={participant.id} />
                  <input type="hidden" name="outcome" value={outcome} />
                </OperationForm>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// A titled group of agenda lessons.
function AgendaSection({
  title,
  description,
  items,
  empty,
  outcomeAction,
  outcomeRequired = false,
}: {
  title: string;
  description: string;
  items: CoachAgendaLesson[];
  empty: string;
  outcomeAction: (state: LessonOperationState, formData: FormData) => Promise<LessonOperationState>;
  outcomeRequired?: boolean;
}) {
  return (
    <section aria-labelledby={`${title.toLowerCase().replaceAll(" ", "-")}-heading`} className="space-y-3">
      <div>
        <h2 id={`${title.toLowerCase().replaceAll(" ", "-")}-heading`} className="text-xl font-semibold">{title}</h2>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      {items.length === 0 ? (
        <div className="rounded-xl border border-dashed p-5 text-sm text-muted-foreground">{empty}</div>
      ) : (
        <div className="grid gap-3">
          {items.map((lesson) => (
            <Card key={lesson.bookingId} className={outcomeRequired ? "border-amber-300 bg-amber-50/60 dark:border-amber-400/30 dark:bg-amber-950/40" : undefined}>
              <CardContent className="flex flex-col gap-4 pt-6 lg:flex-row lg:items-center lg:justify-between">
                <LessonIdentity lesson={lesson} />
                {outcomeRequired ? <OutcomeControls lesson={lesson} action={outcomeAction} /> : null}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </section>
  );
}

/** The coach dashboard agenda. */
export function LessonAgenda({
  items,
  outcomeAction,
}: {
  items: CoachAgendaLesson[];
  outcomeAction: (state: LessonOperationState, formData: FormData) => Promise<LessonOperationState>;
}) {
  const sections = partitionCoachAgenda(items);
  return (
    <div className="space-y-8">
      <Card className="overflow-hidden border-0 bg-gradient-to-br from-slate-950 via-indigo-950 to-teal-900 text-white shadow-xl">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-white/10 p-3"><CalendarDays aria-hidden="true" /></div>
            <div>
              <CardTitle className="text-2xl">Coach agenda</CardTitle>
              <CardDescription className="text-white/70">Cape Town time. Participant and lesson details only.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl bg-white/10 p-4"><AlertTriangle className="mb-2 h-5 w-5 text-amber-300" aria-hidden="true" /><strong className="text-2xl tabular-nums">{sections.outcomeRequired.length}</strong><p className="text-sm text-white/70">Outcomes required</p></div>
          <div className="rounded-xl bg-white/10 p-4"><Clock3 className="mb-2 h-5 w-5 text-cyan-200" aria-hidden="true" /><strong className="text-2xl tabular-nums">{sections.today.length}</strong><p className="text-sm text-white/70">Remaining today</p></div>
          <div className="rounded-xl bg-white/10 p-4"><CheckCircle2 className="mb-2 h-5 w-5 text-emerald-200" aria-hidden="true" /><strong className="text-2xl tabular-nums">{sections.upcoming.length}</strong><p className="text-sm text-white/70">Next seven days</p></div>
        </CardContent>
      </Card>
      <AgendaSection title="Outcome required" description="Past lessons remain here until attendance is recorded." items={sections.outcomeRequired} empty="No overdue lesson outcomes." outcomeAction={outcomeAction} outcomeRequired />
      <AgendaSection title="Today" description="Your remaining lessons today." items={sections.today} empty="No more lessons today." outcomeAction={outcomeAction} />
      <AgendaSection title="Upcoming week" description="Scheduled lessons over the next seven days." items={sections.upcoming} empty="No lessons scheduled in the next seven days." outcomeAction={outcomeAction} />
    </div>
  );
}
