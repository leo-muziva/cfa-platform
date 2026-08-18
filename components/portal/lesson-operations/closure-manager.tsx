import { CalendarOff, ShieldCheck } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { OperationForm, type LessonOperationState } from "./operation-form";

export interface ClosureView {
  id: string;
  startsOn: string;
  endsOn: string;
  reason: string;
  cancelledAt: string | null;
  affectedBookingCount?: number;
  affectedCoachNames?: string[];
  affectedMemberNames?: string[];
}

export interface ClosurePreviewView {
  startsOn: string;
  endsOn: string;
  affectedBookingCount: number;
  affectedCoachNames: string[];
  affectedMemberNames: string[];
}

const displayDate = (date: string) => new Intl.DateTimeFormat("en-ZA", { dateStyle: "long", timeZone: "Africa/Johannesburg" }).format(new Date(`${date}T12:00:00+02:00`));

export function ClosureManager({ closures, preview, createAction, cancelAction }: {
  closures: ClosureView[];
  preview: ClosurePreviewView | null;
  createAction: (state: LessonOperationState, formData: FormData) => Promise<LessonOperationState>;
  cancelAction: (state: LessonOperationState, formData: FormData) => Promise<LessonOperationState>;
}) {
  return <div className="space-y-8">
    <div><h1 className="text-3xl font-bold tracking-tight">Club closures</h1><p className="mt-2 max-w-3xl text-sm text-muted-foreground">Closures cover inclusive Cape Town calendar dates. Preview first, then explicitly confirm no-charge cancellation of affected lessons.</p></div>
    <div className="grid gap-6 xl:grid-cols-[minmax(22rem,0.75fr)_minmax(0,1fr)]">
      <Card className="h-fit border-indigo-200 bg-indigo-50/40"><CardHeader><CardTitle className="flex items-center gap-2"><CalendarOff className="h-5 w-5" aria-hidden="true" />Create closure</CardTitle><CardDescription>Preview the date range before creating a closure. Previewing does not change bookings.</CardDescription></CardHeader><CardContent className="space-y-5">
        <form method="get" className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="previewStartsOn">First closed date</Label><Input id="previewStartsOn" name="startsOn" type="date" defaultValue={preview?.startsOn} required /></div><div className="space-y-2"><Label htmlFor="previewEndsOn">Last closed date</Label><Input id="previewEndsOn" name="endsOn" type="date" defaultValue={preview?.endsOn} required /></div></div>
          <button type="submit" className="inline-flex h-9 items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium shadow-sm hover:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">Preview affected lessons</button>
        </form>
        {preview ? <div role="status" className="space-y-4 border-t border-indigo-200 pt-5">
          <div><h3 className="font-semibold">Preview result</h3><p className="text-sm text-muted-foreground">{displayDate(preview.startsOn)} - {displayDate(preview.endsOn)}</p></div>
          <div className="grid gap-3 sm:grid-cols-3"><div className="rounded-lg bg-white p-3"><p className="text-xs text-muted-foreground">Bookings</p><p className="text-2xl font-semibold tabular-nums">{preview.affectedBookingCount}</p></div><div className="rounded-lg bg-white p-3"><p className="text-xs text-muted-foreground">Coaches</p><p className="text-sm font-medium">{preview.affectedCoachNames.join(", ") || "None"}</p></div><div className="rounded-lg bg-white p-3"><p className="text-xs text-muted-foreground">Members</p><p className="text-sm font-medium">{preview.affectedMemberNames.join(", ") || "None"}</p></div></div>
          <OperationForm action={createAction} submitLabel="Create closure">
            <input type="hidden" name="startsOn" value={preview.startsOn} /><input type="hidden" name="endsOn" value={preview.endsOn} />
            <div className="space-y-2"><Label htmlFor="reason">Reason</Label><Input id="reason" name="reason" required minLength={3} maxLength={240} /></div>
            <label className="flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm"><input type="checkbox" name="cancelAffected" value="true" required={preview.affectedBookingCount > 0} className="mt-1 h-4 w-4" /><span><strong className="block">Confirm affected cancellations{preview.affectedBookingCount > 0 ? " (required)" : ""}</strong>Cancel all lessons in this range at no charge and notify the relevant payers in-app.</span></label>
          </OperationForm>
        </div> : <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">Choose an inclusive date range to see affected bookings, coaches, and members.</p>}
      </CardContent></Card>
      <section aria-labelledby="closure-list-heading" className="space-y-4"><div><h2 id="closure-list-heading" className="text-xl font-semibold">Closure register</h2><p className="text-sm text-muted-foreground">Active and withdrawn date ranges remain visible for operational history.</p></div>
        {closures.length === 0 ? <div className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">No club closures have been configured.</div> : closures.map((closure) => <Card key={closure.id} className={closure.cancelledAt ? "opacity-70" : "border-indigo-200"}>
          <CardHeader><div className="flex flex-col justify-between gap-3 sm:flex-row"><div><CardTitle>{displayDate(closure.startsOn)} - {displayDate(closure.endsOn)}</CardTitle><CardDescription>{closure.reason}</CardDescription></div><span className="h-fit rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide">{closure.cancelledAt ? "Withdrawn" : "Active"}</span></div></CardHeader>
          <CardContent className="space-y-4"><div className="grid gap-3 sm:grid-cols-3"><div className="rounded-lg bg-slate-50 p-3"><p className="text-xs text-muted-foreground">Affected bookings</p><p className="text-xl font-semibold tabular-nums">{closure.affectedBookingCount ?? 0}</p></div><div className="rounded-lg bg-slate-50 p-3"><p className="text-xs text-muted-foreground">Coaches</p><p className="text-sm font-medium">{closure.affectedCoachNames?.join(", ") || "None"}</p></div><div className="rounded-lg bg-slate-50 p-3"><p className="text-xs text-muted-foreground">Members</p><p className="text-sm font-medium">{closure.affectedMemberNames?.join(", ") || "None"}</p></div></div>
            {!closure.cancelledAt ? <OperationForm action={cancelAction} submitLabel="Withdraw closure" pendingLabel="Withdrawing..." variant="outline" className="space-y-1"><input type="hidden" name="closureId" value={closure.id} /></OperationForm> : <p className="flex items-center gap-2 text-sm text-muted-foreground"><ShieldCheck className="h-4 w-4" aria-hidden="true" />Historical record retained.</p>}
          </CardContent>
        </Card>)}
      </section>
    </div>
  </div>;
}
