import Link from "next/link";
import { redirect } from "next/navigation";
import { recordLessonOutcomeAction } from "@/app/actions/lessons";
import { Button } from "@/components/ui/button";
import { LessonAgenda } from "@/components/portal/lesson-operations/lesson-agenda";
import { getCoachLessonsPageData } from "@/lib/services/LessonBookingService";

export default async function CoachDashboardPage() {
  const result = await getCoachLessonsPageData();
  if ("error" in result) redirect(result.error === "Not authenticated" ? "/auth/login" : "/protected");

  const agenda = result.lessons.map((lesson) => ({
    bookingId: lesson.id,
    coachId: lesson.coachId,
    startsAt: lesson.startsAt,
    endsAt: lesson.endsAt,
    weapon: lesson.weapon,
    status: lesson.status,
    participantNames: lesson.participants.map((participant) => participant.fullName),
  }));

  return <div className="space-y-6">
    <div className="flex justify-end"><Button asChild variant="outline"><Link href="/protected/coach/availability">Manage my availability</Link></Button></div>
    <LessonAgenda items={agenda} outcomeAction={recordLessonOutcomeAction} />
  </div>;
}
