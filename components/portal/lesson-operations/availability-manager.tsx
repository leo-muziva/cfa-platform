import { CalendarClock, Trash2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { OperationForm, type LessonOperationState } from "./operation-form";
import { ExceptionPreviewCard } from "./exception-preview-card";

export interface AvailabilityRuleView {
  id: string;
  isoWeekday: number;
  startsAtLocal: string;
  endsAtLocal: string;
  isActive: boolean;
  accessRule?: "guest_allowed" | "active_members_only";
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
  createRuleAction,
  deleteRuleAction,
  createExceptionAction,
  deleteExceptionAction,
}: {
  coachId: string;
  rules: AvailabilityRuleView[];
  exceptions: AvailabilityExceptionView[];
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
                    <p className="text-sm text-muted-foreground">{rule.startsAtLocal.slice(0, 5)} - {rule.endsAtLocal.slice(0, 5)}{rule.accessRule === "active_members_only" ? " · Members only" : " · Open to guests"}</p>
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

        <Card className="h-fit border-indigo-200 bg-indigo-50/40 dark:border-white/15 dark:bg-[#140a2e]/55">
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
              <label className="flex items-start gap-2 text-sm"><input type="checkbox" name="membersOnly" className="mt-1" /><span>Members only<span className="block text-muted-foreground">Guests cannot book these hours.</span></span></label>
            </OperationForm>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(22rem,0.7fr)]">
        <section aria-labelledby="exceptions-heading" className="space-y-4">
          <div><h2 id="exceptions-heading" className="text-xl font-semibold">Exceptions</h2><p className="text-sm text-muted-foreground">Extra hours add availability. Blocks remove availability from the selected range.</p></div>
          <div className="grid gap-3">
            {exceptions.length === 0 ? <div className="rounded-xl border border-dashed p-5 text-sm text-muted-foreground">No availability exceptions.</div> : exceptions.map((exception) => (
              <Card key={exception.id} className={exception.exceptionType === "block" ? "border-amber-300 dark:border-amber-400/30" : "border-emerald-200 dark:border-emerald-400/30"}>
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

        <ExceptionPreviewCard coachId={coachId} createExceptionAction={createExceptionAction} />
      </div>
    </div>
  );
}
