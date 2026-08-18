import { redirect } from "next/navigation";
import {
  createCoachAvailabilityExceptionAction,
  createCoachAvailabilityRuleAction,
  deleteCoachAvailabilityExceptionAction,
  deleteCoachAvailabilityRuleAction,
} from "@/app/actions/lessons";
import { AvailabilityManager } from "@/components/portal/lesson-operations/availability-manager";
import { getCoachAvailabilityPageData } from "@/lib/services/LessonBookingService";

export default async function CoachAvailabilityPage({ searchParams }: { searchParams: Promise<{ preview?: string; startsAt?: string; endsAt?: string }> }) {
  const search = await searchParams
  const preview = search.preview === 'true' && search.startsAt && search.endsAt
    ? { startsAt: new Date(`${search.startsAt}+02:00`).toISOString(), endsAt: new Date(`${search.endsAt}+02:00`).toISOString() }
    : undefined
  const result = await getCoachAvailabilityPageData(preview);
  if ("error" in result) redirect(result.error === "Not authenticated" ? "/auth/login" : "/protected");
  return <AvailabilityManager coachId={result.profile.id} rules={result.rules} exceptions={result.exceptions} affectedBookings={result.affectedBookings} createRuleAction={createCoachAvailabilityRuleAction} deleteRuleAction={deleteCoachAvailabilityRuleAction} createExceptionAction={createCoachAvailabilityExceptionAction} deleteExceptionAction={deleteCoachAvailabilityExceptionAction} />;
}
