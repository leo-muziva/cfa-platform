import { ShieldCheck } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { OperationForm, type LessonOperationState } from "./operation-form";
import { ClosurePreviewCard } from "./closure-preview-card";

// A club closure as shown in the list.
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

const displayDate = (date: string) => new Intl.DateTimeFormat("en-ZA", { dateStyle: "long", timeZone: "Africa/Johannesburg" }).format(new Date(`${date}T12:00:00+02:00`));

/** Lists club closures and holds the "add closure" preview card. */
export function ClosureManager({ closures, coachNames, createAction, cancelAction }: {
  closures: ClosureView[];
  coachNames: Record<string, string>;
  createAction: (state: LessonOperationState, formData: FormData) => Promise<LessonOperationState>;
  cancelAction: (state: LessonOperationState, formData: FormData) => Promise<LessonOperationState>;
}) {
  return <div className="space-y-8">
    <div><h1 className="text-3xl font-bold tracking-tight">Club closures</h1><p className="mt-2 max-w-3xl text-sm text-muted-foreground">Closures cover inclusive Cape Town calendar dates. Preview first, then explicitly confirm no-charge cancellation of affected lessons.</p></div>
    <div className="grid gap-6 xl:grid-cols-[minmax(22rem,0.75fr)_minmax(0,1fr)]">
      <ClosurePreviewCard coachNames={coachNames} createAction={createAction} />
      <section aria-labelledby="closure-list-heading" className="space-y-4"><div><h2 id="closure-list-heading" className="text-xl font-semibold">Closure register</h2><p className="text-sm text-muted-foreground">Active and withdrawn date ranges remain visible for operational history.</p></div>
        {closures.length === 0 ? <div className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">No club closures have been configured.</div> : closures.map((closure) => <Card key={closure.id} className={closure.cancelledAt ? "opacity-70" : "border-indigo-200 dark:border-white/15"}>
          <CardHeader><div className="flex flex-col justify-between gap-3 sm:flex-row"><div><CardTitle>{displayDate(closure.startsOn)} - {displayDate(closure.endsOn)}</CardTitle><CardDescription>{closure.reason}</CardDescription></div><span className="h-fit rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide dark:bg-white/10">{closure.cancelledAt ? "Withdrawn" : "Active"}</span></div></CardHeader>
          <CardContent className="space-y-4"><div className="grid gap-3 sm:grid-cols-3"><div className="rounded-lg bg-muted p-3"><p className="text-xs text-muted-foreground">Affected bookings</p><p className="text-xl font-semibold tabular-nums">{closure.affectedBookingCount ?? 0}</p></div><div className="rounded-lg bg-muted p-3"><p className="text-xs text-muted-foreground">Coaches</p><p className="text-sm font-medium">{closure.affectedCoachNames?.join(", ") || "None"}</p></div><div className="rounded-lg bg-muted p-3"><p className="text-xs text-muted-foreground">Members</p><p className="text-sm font-medium">{closure.affectedMemberNames?.join(", ") || "None"}</p></div></div>
            {!closure.cancelledAt ? <OperationForm action={cancelAction} submitLabel="Withdraw closure" pendingLabel="Withdrawing..." variant="outline" className="space-y-1"><input type="hidden" name="closureId" value={closure.id} /></OperationForm> : <p className="flex items-center gap-2 text-sm text-muted-foreground"><ShieldCheck className="h-4 w-4" aria-hidden="true" />Historical record retained.</p>}
          </CardContent>
        </Card>)}
      </section>
    </div>
  </div>;
}
