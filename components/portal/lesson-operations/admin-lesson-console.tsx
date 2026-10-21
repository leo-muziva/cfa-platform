import Link from "next/link";
import { Activity, CalendarDays, CircleDollarSign, ExternalLink, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { capeTownDateKey, formatCapeTownDate, formatCapeTownTime } from "@/lib/booking-calendar";
import { OperationForm, type LessonOperationState } from "./operation-form";

export interface AdminLessonView {
  id: string;
  coachId: string;
  coachName: string;
  startsAt: string;
  endsAt: string;
  weapon: string;
  status: string;
  participants: Array<{ id: string; fullName: string; attendanceOutcome?: 'attended' | 'no_show' | null }>;
}

export interface LessonActivityView {
  id: string;
  eventType: string;
  createdAt: string;
  actorName?: string | null;
  bookingId?: string | null;
  description?: string;
}

export interface AdminCoachFilterView { coachId: string; fullName: string }

function groupedByDate(bookings: AdminLessonView[]) {
  return bookings.reduce<Record<string, AdminLessonView[]>>((groups, booking) => {
    const key = capeTownDateKey(booking.startsAt);
    groups[key] = [...(groups[key] ?? []), booking];
    return groups;
  }, {});
}

const eventLabel = (eventType: string) => eventType.replace(/^lesson\./, "").replaceAll("_", " ");

export function AdminLessonConsole({ bookings, activity, coaches, cancelAction, outcomeAction, waiveAction }: {
  bookings: AdminLessonView[];
  activity: LessonActivityView[];
  coaches: AdminCoachFilterView[];
  cancelAction: (state: LessonOperationState, formData: FormData) => Promise<LessonOperationState>;
  outcomeAction: (state: LessonOperationState, formData: FormData) => Promise<LessonOperationState>;
  waiveAction: (state: LessonOperationState, formData: FormData) => Promise<LessonOperationState>;
}) {
  const dates = groupedByDate(bookings);
  const scheduledCount = bookings.filter((booking) => booking.status === "scheduled").length;
  const outcomeCount = bookings.filter((booking) => booking.status === "scheduled" && new Date(booking.endsAt) < new Date()).length;
  return <div className="space-y-8">
    <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end"><div><h1 className="text-3xl font-bold tracking-tight">Lesson operations</h1><p className="mt-2 max-w-3xl text-sm text-muted-foreground">All-coach schedule, booking activity, no-charge adjustments, and booking-on-behalf entry.</p></div><Button asChild><Link href="/protected/book">Book on behalf <ExternalLink aria-hidden="true" /></Link></Button></div>
    <div className="grid gap-4 sm:grid-cols-3"><Card><CardContent className="pt-6"><CalendarDays className="mb-3 h-5 w-5 text-indigo-700 dark:text-indigo-300" aria-hidden="true" /><p className="text-3xl font-semibold tabular-nums">{scheduledCount}</p><p className="text-sm text-muted-foreground">Scheduled lessons</p></CardContent></Card><Card><CardContent className="pt-6"><Users className="mb-3 h-5 w-5 text-teal-700 dark:text-teal-300" aria-hidden="true" /><p className="text-3xl font-semibold tabular-nums">{coaches.length}</p><p className="text-sm text-muted-foreground">Configured coaches</p></CardContent></Card><Card><CardContent className="pt-6"><Activity className="mb-3 h-5 w-5 text-amber-700 dark:text-amber-300" aria-hidden="true" /><p className="text-3xl font-semibold tabular-nums">{outcomeCount}</p><p className="text-sm text-muted-foreground">Outcomes overdue</p></CardContent></Card></div>

    <section aria-labelledby="calendar-heading" className="space-y-4"><div><h2 id="calendar-heading" className="text-xl font-semibold">All-coach calendar</h2><p className="text-sm text-muted-foreground">Cape Town time. Scroll each day horizontally on smaller screens.</p></div>
      {Object.keys(dates).length === 0 ? <div className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">No lesson bookings to display.</div> : Object.entries(dates).sort(([a], [b]) => a.localeCompare(b)).map(([date, lessons]) => <Card key={date}><CardHeader><CardTitle>{formatCapeTownDate(date)}</CardTitle><CardDescription>{lessons.length} lesson{lessons.length === 1 ? "" : "s"}</CardDescription></CardHeader><CardContent><div className="flex snap-x gap-3 overflow-x-auto pb-2">{lessons.map((lesson) => <article key={lesson.id} className="min-w-[17rem] snap-start rounded-xl border bg-muted p-4"><div className="flex items-start justify-between gap-2"><p className="text-lg font-semibold tabular-nums">{formatCapeTownTime(lesson.startsAt)}</p><Badge variant="secondary" className="capitalize">{lesson.status.replaceAll("_", " ")}</Badge></div><p className="mt-2 font-medium">{lesson.coachName}</p><p className="text-sm text-muted-foreground capitalize">{lesson.weapon} - {lesson.participants.map((participant) => participant.fullName).join(" and ")}</p></article>)}</div></CardContent></Card>)}
    </section>

    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(22rem,0.7fr)]">
      <section aria-labelledby="bookings-heading" className="space-y-4"><div><h2 id="bookings-heading" className="text-xl font-semibold">Bookings and waivers</h2><p className="text-sm text-muted-foreground">A waiver removes unpaid invoice lines. Paid charges receive an offsetting ledger credit and preserve the receipt.</p></div>
        {bookings.length === 0 ? <div className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">No bookings available.</div> : bookings.map((booking) => <Card key={booking.id}><CardHeader><div className="flex flex-col justify-between gap-2 sm:flex-row"><div><CardTitle>{formatCapeTownDate(capeTownDateKey(booking.startsAt))}, {formatCapeTownTime(booking.startsAt)}</CardTitle><CardDescription>{booking.coachName} - {booking.participants.map((participant) => participant.fullName).join(" and ")}</CardDescription></div><Badge variant="secondary" className="h-fit w-fit capitalize">{booking.status.replaceAll("_", " ")}</Badge></div></CardHeader><CardContent>
          <div className="space-y-3">
            {booking.status === "scheduled" && new Date(booking.endsAt) <= new Date() ? <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 dark:border-amber-400/30 dark:bg-amber-950/40 dark:text-amber-100"><p className="text-sm font-medium">Outcome required</p><div className="mt-3 space-y-3">{booking.participants.map((participant) => <div key={participant.id}><p className="mb-2 text-sm">{participant.fullName}</p>{participant.attendanceOutcome ? <Badge>{participant.attendanceOutcome.replaceAll("_", " ")}</Badge> : <div className="grid gap-2 sm:grid-cols-2">{(["attended", "no_show"] as const).map((outcome) => <OperationForm key={outcome} action={outcomeAction} submitLabel={outcome === "attended" ? "Attended" : "No-show"} pendingLabel="Recording..." className="space-y-1" submitClassName="w-full"><input type="hidden" name="bookingId" value={booking.id} /><input type="hidden" name="participantId" value={participant.id} /><input type="hidden" name="outcome" value={outcome} /></OperationForm>)}</div>}</div>)}</div></div> : null}
            {booking.status === "scheduled" && new Date(booking.startsAt) > new Date() ? <details className="rounded-lg border p-3"><summary className="cursor-pointer text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 dark:focus-visible:outline-violet-300">Cancel booking at no charge</summary><OperationForm action={cancelAction} submitLabel="Cancel booking" pendingLabel="Cancelling..." variant="destructive" className="mt-3 space-y-3"><input type="hidden" name="bookingId" value={booking.id} /><div className="space-y-2"><Label htmlFor={`cancel-${booking.id}`}>Cancellation reason</Label><Input id={`cancel-${booking.id}`} name="reason" required minLength={3} maxLength={240} /></div><label className="flex items-start gap-2 text-sm"><input type="checkbox" name="confirm" value="true" required className="mt-1 h-4 w-4" />I understand CFA-initiated cancellation is at no charge.</label></OperationForm></details> : null}
            <details className="rounded-lg border p-3"><summary className="cursor-pointer text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 dark:focus-visible:outline-violet-300">Waive all lesson charges</summary><p className="mt-3 text-sm text-muted-foreground">This action applies to every participant charge attached to this booking.</p><OperationForm action={waiveAction} submitLabel="Waive booking charges" pendingLabel="Waiving..." variant="destructive" className="mt-3 space-y-3"><input type="hidden" name="bookingId" value={booking.id} /><div className="space-y-2"><Label htmlFor={`waiver-${booking.id}`}>Waiver reason</Label><Input id={`waiver-${booking.id}`} name="reason" required minLength={3} maxLength={240} /></div><label className="flex items-start gap-2 text-sm"><input type="checkbox" name="confirm" value="true" required className="mt-1 h-4 w-4" />I understand this may create a ledger credit for settled charges.</label></OperationForm></details>
          </div>
        </CardContent></Card>)}
      </section>
      <section aria-labelledby="activity-heading" className="space-y-4"><div><h2 id="activity-heading" className="text-xl font-semibold">Recent activity</h2><p className="text-sm text-muted-foreground">Cancellations, outcomes, reschedules, and waivers.</p></div><Card><CardContent className="pt-6">{activity.length === 0 ? <p className="text-sm text-muted-foreground">No recent lesson activity.</p> : <ol className="space-y-4">{activity.map((item) => <li key={item.id} className="relative border-l-2 border-indigo-200 pl-4 dark:border-white/15"><p className="font-medium capitalize">{eventLabel(item.eventType)}</p>{item.description ? <p className="text-sm text-muted-foreground">{item.description}</p> : null}<p className="mt-1 text-xs text-muted-foreground">{new Intl.DateTimeFormat("en-ZA", { timeZone: "Africa/Johannesburg", dateStyle: "medium", timeStyle: "short" }).format(new Date(item.createdAt))}{item.actorName ? ` by ${item.actorName}` : ""}</p></li>)}</ol>}</CardContent></Card></section>
    </div>
    <Card className="border-indigo-200 bg-indigo-50/40 dark:border-white/15 dark:bg-[#140a2e]/55"><CardHeader><CardTitle className="flex items-center gap-2"><CircleDollarSign className="h-5 w-5" aria-hidden="true" />Lesson billing</CardTitle><CardDescription>Pay-later charges remain provisional. They are excluded from outstanding totals and invoice runs until attendance, no-show, or a chargeable late cancellation finalizes them.</CardDescription></CardHeader></Card>
  </div>;
}
