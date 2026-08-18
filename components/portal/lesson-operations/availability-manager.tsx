import { CalendarClock, CirclePlus, ShieldAlert, Trash2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { OperationForm, type LessonOperationState } from "./operation-form";
import type { ClosureAffectedBooking } from "@/types/domain";

export interface AvailabilityRuleView {
  id: string;
  isoWeekday: number;
  startsAtLocal: string;
  endsAtLocal: string;
  isActive: boolean;
}

export interface AvailabilityExceptionView {
  id: string;
  exceptionType: "block" | "extra";
  startsAt: string;
  endsAt: string;
  reason: string | null;
}

const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

function localDateTime(value: string) {
  const formatter = new Intl.DateTimeFormat("en-ZA", {
    timeZone: "Africa/Johannesburg",
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  return formatter.format(new Date(value));
}

export function AvailabilityManager({
  coachId,
  rules,
  exceptions,
  affectedBookings,
  createRuleAction,
  deleteRuleAction,
  createExceptionAction,
  deleteExceptionAction,
}: {
  coachId: string;
  rules: AvailabilityRuleView[];
  exceptions: AvailabilityExceptionView[];
  affectedBookings: ClosureAffectedBooking[];
  createRuleAction: (state: LessonOperationState, formData: FormData) => Promise<LessonOperationState>;
  deleteRuleAction: (state: LessonOperationState, formData: FormData) => Promise<LessonOperationState>;
  createExceptionAction: (state: LessonOperationState, formData: FormData) => Promise<LessonOperationState>;
  deleteExceptionAction: (state: LessonOperationState, formData: FormData) => Promise<LessonOperationState>;
}) {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Lesson availability</h1>
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground">Set recurring hours and date-specific changes in Cape Town time. Existing bookings are preserved unless you explicitly confirm cancellation for a blocking exception.</p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(22rem,0.7fr)]">
        <section aria-labelledby="standing-hours-heading" className="space-y-4">
          <div>
            <h2 id="standing-hours-heading" className="text-xl font-semibold">Standing weekly hours</h2>
            <p className="text-sm text-muted-foreground">Multiple ranges per day are supported. Lessons are generated in 30-minute intervals.</p>
          </div>
          <div className="grid gap-3">
            {rules.length === 0 ? <div className="rounded-xl border border-dashed p-5 text-sm text-muted-foreground">No recurring hours yet.</div> : rules.map((rule) => (
              <Card key={rule.id}>
                <CardContent className="flex items-center justify-between gap-4 pt-6">
                  <div>
                    <p className="font-semibold">{WEEKDAYS[rule.isoWeekday - 1] ?? "Day"}</p>
                    <p className="text-sm text-muted-foreground">{rule.startsAtLocal.slice(0, 5)} - {rule.endsAtLocal.slice(0, 5)}</p>
                  </div>
                  <OperationForm action={deleteRuleAction} submitLabel="Remove" pendingLabel="Removing..." variant="ghost" className="space-y-1">
                    <input type="hidden" name="ruleId" value={rule.id} />
                    <span className="sr-only"><Trash2 aria-hidden="true" />Remove recurring range</span>
                  </OperationForm>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <Card className="h-fit border-indigo-200 bg-indigo-50/40">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><CalendarClock className="h-5 w-5" aria-hidden="true" />Add weekly range</CardTitle>
            <CardDescription>Times use the club&apos;s Cape Town timezone.</CardDescription>
          </CardHeader>
          <CardContent>
            <OperationForm action={createRuleAction} submitLabel="Add recurring hours">
              <input type="hidden" name="coachId" value={coachId} />
              <div className="space-y-2">
                <Label htmlFor="isoWeekday">Weekday</Label>
                <select id="isoWeekday" name="isoWeekday" required className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                  {WEEKDAYS.map((day, index) => <option key={day} value={index + 1}>{day}</option>)}
                </select>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2"><Label htmlFor="startsAtLocal">Starts</Label><Input id="startsAtLocal" name="startsAtLocal" type="time" step="1800" required /></div>
                <div className="space-y-2"><Label htmlFor="endsAtLocal">Ends</Label><Input id="endsAtLocal" name="endsAtLocal" type="time" step="1800" required /></div>
              </div>
            </OperationForm>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(22rem,0.7fr)]">
        <section aria-labelledby="exceptions-heading" className="space-y-4">
          <div><h2 id="exceptions-heading" className="text-xl font-semibold">Exceptions</h2><p className="text-sm text-muted-foreground">Extra hours add availability. Blocks remove availability from the selected range.</p></div>
          <div className="grid gap-3">
            {exceptions.length === 0 ? <div className="rounded-xl border border-dashed p-5 text-sm text-muted-foreground">No availability exceptions.</div> : exceptions.map((exception) => (
              <Card key={exception.id} className={exception.exceptionType === "block" ? "border-amber-300" : "border-emerald-200"}>
                <CardContent className="flex flex-col gap-4 pt-6 sm:flex-row sm:items-center sm:justify-between">
                  <div><p className="font-semibold capitalize">{exception.exceptionType}</p><p className="text-sm text-muted-foreground">{localDateTime(exception.startsAt)} - {localDateTime(exception.endsAt)}</p>{exception.reason ? <p className="mt-1 text-sm">{exception.reason}</p> : null}</div>
                  <OperationForm action={deleteExceptionAction} submitLabel="Remove" pendingLabel="Removing..." variant="ghost" className="space-y-1">
                    <input type="hidden" name="exceptionId" value={exception.id} />
                  </OperationForm>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <Card className="h-fit border-teal-200 bg-teal-50/40">
          <CardHeader><CardTitle className="flex items-center gap-2"><CirclePlus className="h-5 w-5" aria-hidden="true" />Add exception</CardTitle><CardDescription>A blocking range may overlap booked lessons.</CardDescription></CardHeader>
          <CardContent>
            <form method="get" className="mb-5 space-y-3 rounded-lg border border-amber-200 bg-amber-50/60 p-3">
              <input type="hidden" name="preview" value="true" />
              <p className="text-sm font-medium text-amber-950">Preview a blocking range before confirming cancellations.</p>
              <div className="grid gap-3 sm:grid-cols-2"><div className="space-y-1"><Label htmlFor="preview-start">Starts</Label><Input id="preview-start" name="startsAt" type="datetime-local" step="1800" required /></div><div className="space-y-1"><Label htmlFor="preview-end">Ends</Label><Input id="preview-end" name="endsAt" type="datetime-local" step="1800" required /></div></div>
              <button type="submit" className="min-h-10 rounded-md border border-amber-400 bg-white px-3 text-sm font-medium text-amber-950">Preview affected lessons</button>
            </form>
            {affectedBookings.length > 0 && <div role="status" className="mb-5 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950"><strong>{affectedBookings.length} affected lesson{affectedBookings.length === 1 ? "" : "s"}</strong><ul className="mt-2 space-y-1">{affectedBookings.map((booking) => <li key={booking.bookingId}>{localDateTime(booking.startsAt)} - {booking.participantNames.join(", ")}</li>)}</ul><p className="mt-2">Review these lessons, then use the cancellation confirmation below for the same range.</p></div>}
            <OperationForm action={createExceptionAction} submitLabel="Add exception">
              <input type="hidden" name="coachId" value={coachId} />
              <div className="space-y-2"><Label htmlFor="exceptionType">Change type</Label><select id="exceptionType" name="exceptionType" required className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"><option value="extra">Add extra hours</option><option value="block">Block availability</option></select></div>
              <div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="startsAt">Starts</Label><Input id="startsAt" name="startsAt" type="datetime-local" step="1800" required /></div><div className="space-y-2"><Label htmlFor="endsAt">Ends</Label><Input id="endsAt" name="endsAt" type="datetime-local" step="1800" required /></div></div>
              <div className="space-y-2"><Label htmlFor="reason">Reason (optional)</Label><Input id="reason" name="reason" maxLength={240} /></div>
              <label className="flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm">
                <input type="checkbox" name="cancelAffected" value="true" className="mt-1 h-4 w-4" />
                <span><strong className="flex items-center gap-1"><ShieldAlert className="h-4 w-4" aria-hidden="true" />Confirm affected cancellations</strong>For a block, cancel overlapping future bookings at no charge. Leave unchecked to preserve bookings and receive an affected-booking warning.</span>
              </label>
            </OperationForm>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
