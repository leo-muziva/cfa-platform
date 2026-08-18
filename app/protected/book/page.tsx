import { redirect } from "next/navigation";
import { CoachDirectory } from "@/components/lesson-booking/coach-directory";
import {
  getAvailableLessonTimes,
  getLessonCoachDirectory,
} from "@/lib/services/LessonBookingService";

export default async function BookLessonPage() {
  const result = await getLessonCoachDirectory();
  if (!result.success && result.errorCode === "not_authenticated") {
    redirect("/auth/login?next=%2Fprotected%2Fbook");
  }

  const coaches = result.success
    ? await Promise.all(result.data.map(async (coach) => {
        const availability = coach.weapons[0]
          ? await getAvailableLessonTimes({
              coachId: coach.coachId,
              weapon: coach.weapons[0],
            })
          : null;
        return {
          ...coach,
          nextAvailableAt: availability?.success
            ? availability.data[0]?.startsAt ?? null
            : null,
        };
      }))
    : [];

  return (
    <div className="space-y-8">
      <header className="max-w-3xl">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.26em] text-slate-500">
          Member Portal
        </p>
        <h1 className="font-serif text-4xl font-light tracking-tight text-slate-950 sm:text-5xl">
          Book a private lesson
        </h1>
        <p className="mt-3 text-sm leading-6 text-slate-600 sm:text-base">
          Choose an active CFA coach, then find a free 30-minute time. Lessons are
          invoiced after their outcome is recorded.
        </p>
      </header>

      {result.success ? (
        <CoachDirectory coaches={coaches} />
      ) : (
        <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-900">
          {result.error}
        </div>
      )}
    </div>
  );
}
