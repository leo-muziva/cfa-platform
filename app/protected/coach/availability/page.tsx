import { redirect } from "next/navigation";
import {
  createCoachAvailabilityExceptionAction,
  createCoachAvailabilityRuleAction,
  deleteCoachAvailabilityExceptionAction,
  deleteCoachAvailabilityRuleAction,
} from "@/app/actions/lessons";
import { AvailabilityManager } from "@/components/portal/lesson-operations/availability-manager";
import { getCoachAvailabilityPageData } from "@/lib/services/LessonBookingService";

/** /protected/coach/availability: the coach's weekly hours and one-off changes. */
export default async function CoachAvailabilityPage() {
  const result = await getCoachAvailabilityPageData();
  if ("error" in result) redirect(result.error === "Not authenticated" ? "/auth/login" : "/protected");
  return <AvailabilityManager coachId={result.profile.id} rules={result.rules} exceptions={result.exceptions} createRuleAction={createCoachAvailabilityRuleAction} deleteRuleAction={deleteCoachAvailabilityRuleAction} createExceptionAction={createCoachAvailabilityExceptionAction} deleteExceptionAction={deleteCoachAvailabilityExceptionAction} />;
}
