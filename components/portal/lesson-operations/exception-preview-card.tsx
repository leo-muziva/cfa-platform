"use client";

import { useState, useTransition } from "react";
import { CirclePlus, ShieldAlert } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GlassDialog } from "@/components/ui/glass-dialog";
import { previewCoachAvailabilityExceptionImpactAction } from "@/app/actions/lessons";
import { capeTownDateTimeToIso } from "@/lib/cape-town-time";
import { OperationForm, type LessonOperationState } from "./operation-form";
import type { ClosureAffectedBooking } from "@/types/domain";

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

export function ExceptionPreviewCard({
  coachId,
  createExceptionAction,
}: {
  coachId: string;
  createExceptionAction: (state: LessonOperationState, formData: FormData) => Promise<LessonOperationState>;
}) {
  // Controlled, starting empty on purpose: the browser can't silently fall
  // back to a real choice the way an uncontrolled <select>'s first <option>
  // would, so a coach can never submit "extra" (adds availability) when they
  // meant "block" (removes it) just by forgetting to touch the dropdown.
  const [exceptionType, setExceptionType] = useState<"" | "block" | "extra">("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [affectedBookings, setAffectedBookings] = useState<ClosureAffectedBooking[] | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [isPreviewing, startPreviewTransition] = useTransition();

  const runPreview = () => {
    if (!startsAt || !endsAt) return;
    setPreviewError(null);
    startPreviewTransition(async () => {
      const isoStarts = String(capeTownDateTimeToIso(startsAt));
      const isoEnds = String(capeTownDateTimeToIso(endsAt));
      const result = await previewCoachAvailabilityExceptionImpactAction({ coachId, startsAt: isoStarts, endsAt: isoEnds });
      if (result.success) {
        setAffectedBookings(result.data);
        setOpen(true);
      } else {
        setPreviewError(result.error);
      }
    });
  };

  return (
    <Card className="h-fit border-teal-200 bg-teal-50/40">
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><CirclePlus className="h-5 w-5" aria-hidden="true" />Add exception</CardTitle>
        <CardDescription>A blocking range may overlap booked lessons.</CardDescription>
      </CardHeader>
      <CardContent>
        <OperationForm action={createExceptionAction} submitLabel="Add exception">
          <input type="hidden" name="coachId" value={coachId} />
          <div className="space-y-2">
            <Label htmlFor="exceptionType">Change type</Label>
            <select
              id="exceptionType"
              name="exceptionType"
              required
              value={exceptionType}
              onChange={(event) => setExceptionType(event.target.value as "" | "block" | "extra")}
              className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="" disabled>Select an action</option>
              <option value="block">Block availability</option>
              <option value="extra">Add extra hours</option>
            </select>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="startsAt">Starts</Label>
              <Input id="startsAt" name="startsAt" type="datetime-local" step="1800" required value={startsAt} onChange={(event) => setStartsAt(event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endsAt">Ends</Label>
              <Input id="endsAt" name="endsAt" type="datetime-local" step="1800" required value={endsAt} onChange={(event) => setEndsAt(event.target.value)} />
            </div>
          </div>
          <div className="space-y-2"><Label htmlFor="reason">Reason (optional)</Label><Input id="reason" name="reason" maxLength={240} /></div>
          <label className="flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200">
            <input type="checkbox" name="cancelAffected" value="true" className="mt-1 h-4 w-4" />
            <span>
              <strong className="flex items-center gap-1"><ShieldAlert className="h-4 w-4" aria-hidden="true" />Confirm affected cancellations</strong>
              For a block, cancel overlapping future bookings at no charge. Leave unchecked to preserve bookings and receive an affected-booking warning.
            </span>
          </label>
          <div>
            <button
              type="button"
              onClick={runPreview}
              disabled={isPreviewing || !startsAt || !endsAt}
              className="min-h-10 rounded-md border border-amber-500 bg-amber-50 px-3 text-sm font-medium text-amber-950 disabled:opacity-60 dark:border-amber-400 dark:bg-amber-950/40 dark:text-amber-200"
            >
              {isPreviewing ? "Checking..." : "Preview affected lessons"}
            </button>
            {previewError && <p role="alert" className="mt-2 text-sm text-destructive">{previewError}</p>}
          </div>
        </OperationForm>
      </CardContent>

      <GlassDialog open={open} onClose={() => setOpen(false)} labelledBy="exception-preview-heading" className="max-w-lg">
        <h3 id="exception-preview-heading" className="text-lg font-semibold text-foreground">
          {affectedBookings && affectedBookings.length > 0
            ? `${affectedBookings.length} affected lesson${affectedBookings.length === 1 ? "" : "s"}`
            : "No affected lessons"}
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          {affectedBookings && affectedBookings.length > 0
            ? "Review these lessons, then use the cancellation confirmation above for the same range."
            : "Nothing booked overlaps this range."}
        </p>
        {affectedBookings && affectedBookings.length > 0 && (
          <ul className="mt-4 space-y-1 text-sm">
            {affectedBookings.map((booking) => (
              <li key={booking.bookingId} className="rounded-lg bg-muted p-2">
                {localDateTime(booking.startsAt)} - {booking.participantNames.join(", ")}
              </li>
            ))}
          </ul>
        )}
      </GlassDialog>
    </Card>
  );
}
