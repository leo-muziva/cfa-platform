import { redirect } from "next/navigation";
import { updateLessonSettingsAction } from "@/app/actions/lessons";
import { LessonSettingsForm } from "@/components/portal/lesson-operations/lesson-settings-form";
import { getLessonSettingsForAdmin } from "@/lib/services/LessonBookingService";

/** /protected/admin/lesson-settings: cancellation windows, fees and booking horizon. */
export default async function AdminLessonSettingsPage() {
  const result = await getLessonSettingsForAdmin();
  if ("error" in result) redirect(result.error === "Not authenticated" ? "/auth/login" : "/protected");
  return <LessonSettingsForm settings={result.settings} action={updateLessonSettingsAction} />;
}
