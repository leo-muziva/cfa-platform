import { redirect } from "next/navigation";
import { cancelClubClosureAction, createClubClosureAction } from "@/app/actions/lessons";
import { ClosureManager } from "@/components/portal/lesson-operations/closure-manager";
import { getAdminClosuresPageData, getAdminCoachSetupPageData } from "@/lib/services/LessonBookingService";

export default async function AdminClosuresPage({ searchParams }: { searchParams: Promise<{ startsOn?: string; endsOn?: string }> }) {
  const query = await searchParams;
  const rawPreview = query.startsOn && query.endsOn ? { startsOn: query.startsOn, endsOn: query.endsOn } : undefined;
  const [result, coachResult] = await Promise.all([getAdminClosuresPageData(rawPreview), getAdminCoachSetupPageData()]);
  if ("error" in result) redirect(result.error === "Not authenticated" ? "/auth/login" : "/protected");
  if ("error" in coachResult) redirect(coachResult.error === "Not authenticated" ? "/auth/login" : "/protected");
  const coachNames = new Map(coachResult.coaches.map((coach) => [coach.coachId, coach.fullName]));
  const preview = rawPreview ? {
    ...rawPreview,
    affectedBookingCount: result.affectedBookings.length,
    affectedCoachNames: [...new Set(result.affectedBookings.map((booking) => coachNames.get(booking.coachId) ?? "Unknown coach"))],
    affectedMemberNames: [...new Set(result.affectedBookings.flatMap((booking) => booking.participantNames))],
  } : null;
  return <ClosureManager closures={result.closures} preview={preview} createAction={createClubClosureAction} cancelAction={cancelClubClosureAction} />;
}
