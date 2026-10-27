import { redirect } from "next/navigation";
import { cancelCoachFutureBookingsAction, setCoachLessonProfileAction } from "@/app/actions/lessons";
import { CoachSetup } from "@/components/portal/lesson-operations/coach-setup";
import { getAdminCoachSetupPageData } from "@/lib/services/LessonBookingService";

/** /protected/admin/coaches: which coaches take bookings and for which weapons. */
export default async function AdminCoachSetupPage() {
  const result = await getAdminCoachSetupPageData();
  if ("error" in result) redirect(result.error === "Not authenticated" ? "/auth/login" : "/protected");
  return <CoachSetup coaches={result.coaches} saveAction={setCoachLessonProfileAction} cancelFutureAction={cancelCoachFutureBookingsAction} />;
}
