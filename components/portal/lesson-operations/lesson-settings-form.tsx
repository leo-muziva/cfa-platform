import { BadgeCent, CalendarRange, Clock, LockKeyhole, ReceiptText } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { OperationForm, type LessonOperationState } from "./operation-form";

export interface LessonSettingsView {
  cancellationWindowHours: number;
  lateCancellationFeeMultiplier: number;
  cancellationPartialWindowHours: number;
  cancellationPartialFeeMultiplier: number;
  noShowFeeMultiplier: number;
  bookingHorizonDays: number;
  bookingHorizonCalendarMonths: number;
  bookingCutoffMinutes: number;
  singleLessonPriceCents: number;
  paymentMode: string;
  doubleLessonMultiplier: number;
  doubleLessonAtomic: boolean;
  closureMode: string;
  lessonDurationMinutes: number;
  arrearsBlockingEnabled: boolean;
  futureBookingCapPerFencer: number | null;
  externalRemindersEnabled?: boolean;
}

function NumberField({ id, label, value, min = 0, step = 1, hint }: { id: string; label: string; value: number; min?: number; step?: number; hint?: string }) {
  return <div className="space-y-2"><Label htmlFor={id}>{label}</Label><Input id={id} name={id} type="number" defaultValue={value} min={min} step={step} required />{hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}</div>;
}

export function LessonSettingsForm({ settings, action }: {
  settings: LessonSettingsView;
  action: (state: LessonOperationState, formData: FormData) => Promise<LessonOperationState>;
}) {
  return <div className="space-y-8">
    <div><h1 className="text-3xl font-bold tracking-tight">Lesson settings</h1><p className="mt-2 max-w-3xl text-sm text-muted-foreground">This singleton is the authoritative policy and pricing source for lesson booking. Changes apply to new decisions made after saving.</p></div>
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
      <Card className="border-indigo-200 dark:border-white/15"><CardHeader><CardTitle>Editable policy</CardTitle><CardDescription>Validated server-side before the settings record is updated.</CardDescription></CardHeader><CardContent>
        <OperationForm action={action} submitLabel="Save lesson settings" pendingLabel="Saving settings...">
          <fieldset className="space-y-4"><legend className="flex items-center gap-2 text-lg font-semibold"><BadgeCent className="h-5 w-5 text-indigo-700 dark:text-indigo-300" aria-hidden="true" />Cancellation and no-show fees</legend><p className="text-sm text-muted-foreground">Cancelling before the free window is free. Between the free window and the reduced-fee window the reduced share applies; after that the late share applies. Each booking keeps the terms it was made under.</p><div className="grid gap-4 sm:grid-cols-3"><NumberField id="cancellationWindowHours" label="Free cancellation until (hours before)" value={settings.cancellationWindowHours} /><NumberField id="cancellationPartialWindowHours" label="Reduced fee until (hours before)" value={settings.cancellationPartialWindowHours} hint="0 turns the reduced band off" /><NumberField id="cancellationPartialFeeMultiplier" label="Reduced fee share" value={settings.cancellationPartialFeeMultiplier} step={0.01} hint="0.5 means half the lesson price" /><NumberField id="lateCancellationFeeMultiplier" label="Late cancellation share" value={settings.lateCancellationFeeMultiplier} step={0.01} /><NumberField id="noShowFeeMultiplier" label="No-show share" value={settings.noShowFeeMultiplier} step={0.01} /></div></fieldset>
          <fieldset className="space-y-4"><legend className="flex items-center gap-2 text-lg font-semibold"><CalendarRange className="h-5 w-5 text-teal-700 dark:text-teal-300" aria-hidden="true" />Booking window</legend><div className="grid gap-4 sm:grid-cols-2"><NumberField id="bookingHorizonCalendarMonths" label="Booking horizon (calendar months)" value={settings.bookingHorizonCalendarMonths} min={1} /><NumberField id="bookingCutoffMinutes" label="Booking cutoff (minutes before start)" value={settings.bookingCutoffMinutes} /></div></fieldset>
        </OperationForm>
      </CardContent></Card>
      <aside aria-labelledby="locked-settings-heading" className="space-y-4"><Card className="bg-slate-950 text-white"><CardHeader><CardTitle id="locked-settings-heading" className="flex items-center gap-2"><LockKeyhole className="h-5 w-5" aria-hidden="true" />Locked build rules</CardTitle><CardDescription className="text-white/65">These values define the approved demo and cannot be changed from this form.</CardDescription></CardHeader><CardContent><dl className="space-y-3 text-sm"><div><dt className="text-white/60">Payment</dt><dd className="font-medium capitalize">{settings.paymentMode.replaceAll("_", " ")}</dd></div><div><dt className="text-white/60">Lesson duration</dt><dd className="font-medium">{settings.lessonDurationMinutes} minutes</dd></div><div><dt className="text-white/60">Double lesson</dt><dd className="font-medium">{settings.doubleLessonMultiplier} participants, {settings.doubleLessonAtomic ? "atomic" : "non-atomic"}</dd></div><div><dt className="text-white/60">Closures</dt><dd className="font-medium capitalize">{settings.closureMode.replaceAll("_", " ")}</dd></div><div><dt className="text-white/60">Arrears blocking</dt><dd className="font-medium">{settings.arrearsBlockingEnabled ? "Enabled" : "Disabled"}</dd></div><div><dt className="text-white/60">Future cap</dt><dd className="font-medium">{settings.futureBookingCapPerFencer ?? "None"}</dd></div></dl></CardContent></Card>
        <Card><CardHeader><CardTitle className="flex items-center gap-2"><ReceiptText className="h-5 w-5" aria-hidden="true" />Billing behavior</CardTitle><CardDescription>Lesson prices come from the lesson products (standard, intro and beginner package). Provisional lesson charges do not enter the outstanding balance.</CardDescription></CardHeader></Card>
        <Card><CardHeader><CardTitle className="flex items-center gap-2"><Clock className="h-5 w-5" aria-hidden="true" />Timezone</CardTitle><CardDescription>Availability, cutoffs, and closure dates use Africa/Johannesburg.</CardDescription></CardHeader></Card>
      </aside>
    </div>
  </div>;
}
