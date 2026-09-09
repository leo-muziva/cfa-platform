"use client";

import { useState, useTransition } from "react";
import { CalendarOff } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GlassDialog } from "@/components/ui/glass-dialog";
import { previewClosureImpactAction } from "@/app/actions/lessons";
import { OperationForm, type LessonOperationState } from "./operation-form";
import type { ClosureAffectedBooking } from "@/types/domain";

// startsOn/endsOn here are live state from a controlled date <input>, not a
// server-validated value — an in-progress or otherwise malformed edit can
// reach this before the browser reports a complete date, so fall back
// instead of letting an invalid Date crash the whole card.
const displayDate = (date: string) => {
  const parsed = new Date(`${date}T12:00:00+02:00`);
  if (Number.isNaN(parsed.getTime())) return "";
  return new Intl.DateTimeFormat("en-ZA", { dateStyle: "long", timeZone: "Africa/Johannesburg" }).format(parsed);
};

export function ClosurePreviewCard({
  coachNames,
  createAction,
}: {
  coachNames: Record<string, string>;
  createAction: (state: LessonOperationState, formData: FormData) => Promise<LessonOperationState>;
}) {
  const [startsOn, setStartsOn] = useState("");
  const [endsOn, setEndsOn] = useState("");
  const [affectedBookings, setAffectedBookings] = useState<ClosureAffectedBooking[] | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [isPreviewing, startPreviewTransition] = useTransition();

  const runPreview = (event: React.FormEvent) => {
    event.preventDefault();
    if (!startsOn || !endsOn) return;
    setPreviewError(null);
    startPreviewTransition(async () => {
      const result = await previewClosureImpactAction({ startsOn, endsOn });
      if (result.success) {
        setAffectedBookings(result.data);
        setOpen(true);
      } else {
        setPreviewError(result.error);
      }
    });
  };

  const affectedCoachNames = affectedBookings
    ? [...new Set(affectedBookings.map((booking) => coachNames[booking.coachId] ?? "Unknown coach"))]
    : [];
  const affectedMemberNames = affectedBookings
    ? [...new Set(affectedBookings.flatMap((booking) => booking.participantNames))]
    : [];

  return (
    <Card className="h-fit border-indigo-200 bg-indigo-50/40">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CalendarOff className="h-5 w-5" aria-hidden="true" />
          Create closure
        </CardTitle>
        <CardDescription>Preview the date range before creating a closure. Previewing does not change bookings.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <form onSubmit={runPreview} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="previewStartsOn">First closed date</Label>
              <Input id="previewStartsOn" type="date" value={startsOn} onChange={(event) => setStartsOn(event.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="previewEndsOn">Last closed date</Label>
              <Input id="previewEndsOn" type="date" value={endsOn} onChange={(event) => setEndsOn(event.target.value)} required />
            </div>
          </div>
          <button
            type="submit"
            disabled={isPreviewing}
            className="inline-flex h-9 items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium shadow-sm hover:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-60"
          >
            {isPreviewing ? "Checking..." : "Preview affected lessons"}
          </button>
          {previewError && <p role="alert" className="text-sm text-destructive">{previewError}</p>}
        </form>
        {!affectedBookings && (
          <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
            Choose an inclusive date range to see affected bookings, coaches, and members.
          </p>
        )}
      </CardContent>

      <GlassDialog open={open} onClose={() => setOpen(false)} labelledBy="closure-preview-heading" className="max-w-lg">
        <h3 id="closure-preview-heading" className="text-lg font-semibold text-foreground">Preview result</h3>
        <p className="mt-1 text-sm text-muted-foreground">{startsOn && endsOn ? `${displayDate(startsOn)} - ${displayDate(endsOn)}` : ""}</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg bg-muted p-3">
            <p className="text-xs text-muted-foreground">Bookings</p>
            <p className="text-2xl font-semibold tabular-nums">{affectedBookings?.length ?? 0}</p>
          </div>
          <div className="rounded-lg bg-muted p-3">
            <p className="text-xs text-muted-foreground">Coaches</p>
            <p className="text-sm font-medium">{affectedCoachNames.join(", ") || "None"}</p>
          </div>
          <div className="rounded-lg bg-muted p-3">
            <p className="text-xs text-muted-foreground">Members</p>
            <p className="text-sm font-medium">{affectedMemberNames.join(", ") || "None"}</p>
          </div>
        </div>
        <OperationForm action={createAction} submitLabel="Create closure" className="mt-5 space-y-4" onSuccess={() => setOpen(false)}>
          <input type="hidden" name="startsOn" value={startsOn} />
          <input type="hidden" name="endsOn" value={endsOn} />
          <div className="space-y-2">
            <Label htmlFor="reason">Reason</Label>
            <Input id="reason" name="reason" required minLength={3} maxLength={240} />
          </div>
          <label className="flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200">
            <input type="checkbox" name="cancelAffected" value="true" required={(affectedBookings?.length ?? 0) > 0} className="mt-1 h-4 w-4" />
            <span>
              <strong className="block">Confirm affected cancellations{(affectedBookings?.length ?? 0) > 0 ? " (required)" : ""}</strong>
              Cancel all lessons in this range at no charge and notify the relevant payers in-app.
            </span>
          </label>
        </OperationForm>
      </GlassDialog>
    </Card>
  );
}
