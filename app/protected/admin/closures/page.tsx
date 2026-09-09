import { redirect } from "next/navigation";
import { cancelClubClosureAction, createClubClosureAction } from "@/app/actions/lessons";
import { ClosureManager } from "@/components/portal/lesson-operations/closure-manager";
import { getAdminClosuresPageData, getAdminCoachSetupPageData } from "@/lib/services/LessonBookingService";

export default async function AdminClosuresPage() {
  const [result, coachResult] = await Promise.all([getAdminClosuresPageData(), getAdminCoachSetupPageData()]);
  if ("error" in result) redirect(result.error === "Not authenticated" ? "/auth/login" : "/protected");
  if ("error" in coachResult) redirect(coachResult.error === "Not authenticated" ? "/auth/login" : "/protected");
  // Plain object, not a Map — this crosses the server/client boundary as a
  // prop into ClosurePreviewCard, and Maps don't serialize across it.
  const coachNames = Object.fromEntries(coachResult.coaches.map((coach) => [coach.coachId, coach.fullName]));
  return <ClosureManager closures={result.closures} coachNames={coachNames} createAction={createClubClosureAction} cancelAction={cancelClubClosureAction} />;
}
