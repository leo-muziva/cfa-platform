import { AlertTriangle, UserCheck, UserX } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { OperationForm, type LessonOperationState } from "./operation-form";

// A coach's booking status and weapons.
export interface CoachSetupView {
  coachId: string;
  fullName: string;
  isActive: boolean;
  weapons: string[];
  futureBookingCount?: number;
}

const WEAPONS = ["foil", "epee", "sabre"] as const;

/** Per-coach booking switch and weapons, plus "cancel all future lessons". */
export function CoachSetup({ coaches, saveAction, cancelFutureAction }: {
  coaches: CoachSetupView[];
  saveAction: (state: LessonOperationState, formData: FormData) => Promise<LessonOperationState>;
  cancelFutureAction: (state: LessonOperationState, formData: FormData) => Promise<LessonOperationState>;
}) {
  return <div className="space-y-6">
    <div><h1 className="text-3xl font-bold tracking-tight">Coach lesson setup</h1><p className="mt-2 max-w-3xl text-sm text-muted-foreground">Choose which weapons each coach offers and whether they accept new bookings. Deactivation preserves history and does not cancel scheduled lessons.</p></div>
    {coaches.length === 0 ? <div className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">No coach staff profiles are available.</div> : <div className="grid gap-5 lg:grid-cols-2">
      {coaches.map((coach) => <Card key={coach.coachId} className={coach.isActive ? "border-emerald-200 dark:border-emerald-900" : "border-border bg-muted"}>
        <CardHeader><div className="flex items-start justify-between gap-4"><div><CardTitle>{coach.fullName}</CardTitle><CardDescription>{coach.isActive ? "Accepting lesson bookings" : "Lesson offering inactive"}</CardDescription></div><div className={`rounded-full p-2 ${coach.isActive ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300" : "bg-slate-200 text-slate-600 dark:bg-slate-500/20 dark:text-slate-300"}`}>{coach.isActive ? <UserCheck aria-hidden="true" /> : <UserX aria-hidden="true" />}</div></div></CardHeader>
        <CardContent className="space-y-5">
          <OperationForm action={saveAction} submitLabel="Save offering" pendingLabel="Saving...">
            <input type="hidden" name="coachId" value={coach.coachId} />
            <fieldset className="space-y-2"><legend className="text-sm font-medium">Weapons offered</legend><div className="grid grid-cols-3 gap-2">{WEAPONS.map((weapon) => <label key={weapon} className="flex items-center gap-2 rounded-lg border bg-background p-3 text-sm capitalize"><input type="checkbox" name="weapons" value={weapon} defaultChecked={coach.weapons.includes(weapon)} className="h-4 w-4" />{weapon}</label>)}</div></fieldset>
            <label className="flex items-start gap-3 rounded-lg border p-3 text-sm"><input type="checkbox" name="isActive" value="true" defaultChecked={coach.isActive} className="mt-1 h-4 w-4" /><span><strong className="block">Accept new lesson bookings</strong>Turning this off preserves all history and existing future bookings.</span></label>
          </OperationForm>
          <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 dark:border-amber-400/30 dark:bg-amber-950/40 dark:text-amber-100">
            <h3 className="flex items-center gap-2 font-semibold text-amber-950 dark:text-amber-100"><AlertTriangle className="h-4 w-4" aria-hidden="true" />Future lesson cancellations</h3>
            <p className="mt-1 text-sm text-amber-900 dark:text-amber-100">This is separate from deactivation. It cancels every scheduled future lesson for this coach at no charge and cannot be undone.</p>
            {typeof coach.futureBookingCount === "number" ? <p className="mt-2 text-sm font-medium text-amber-950 dark:text-amber-100">{coach.futureBookingCount} future booking{coach.futureBookingCount === 1 ? "" : "s"}</p> : null}
            <OperationForm action={cancelFutureAction} submitLabel="Cancel future bookings" pendingLabel="Cancelling..." variant="destructive" className="mt-4 space-y-3">
              <input type="hidden" name="coachId" value={coach.coachId} />
              <div className="space-y-2"><Label htmlFor={`cancel-reason-${coach.coachId}`}>Cancellation reason</Label><Input id={`cancel-reason-${coach.coachId}`} name="reason" required minLength={3} maxLength={240} /></div>
              <label className="flex items-start gap-2 text-sm"><input type="checkbox" name="confirm" value="true" required className="mt-1 h-4 w-4" />I understand all future bookings for this coach will be cancelled at no charge.</label>
            </OperationForm>
          </div>
        </CardContent>
      </Card>)}
    </div>}
  </div>;
}
