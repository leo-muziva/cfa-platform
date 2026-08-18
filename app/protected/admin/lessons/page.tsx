import { redirect } from "next/navigation";
import { cancelLessonBookingAction, recordLessonOutcomeAction, waiveLessonChargesAction } from "@/app/actions/lessons";
import { AdminLessonConsole } from "@/components/portal/lesson-operations/admin-lesson-console";
import { getAdminLessonsPageData } from "@/lib/services/LessonBookingService";

export default async function AdminLessonsPage() {
  const result = await getAdminLessonsPageData();
  if ("error" in result) redirect(result.error === "Not authenticated" ? "/auth/login" : "/protected");

  return <AdminLessonConsole bookings={result.bookings} activity={result.activity} coaches={result.coaches} cancelAction={cancelLessonBookingAction} outcomeAction={recordLessonOutcomeAction} waiveAction={waiveLessonChargesAction} />;
}
