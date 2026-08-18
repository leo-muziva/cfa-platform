import { redirect } from "next/navigation";
import {
  cancelLessonBookingAction,
  rescheduleLessonBookingAction,
} from "@/app/actions/lessons";
import {
  LessonsEmptyCallToAction,
  MemberLessons,
} from "@/components/lesson-booking/member-lessons";
import {
  getAvailableLessonTimes,
  getMemberLessonsPageData,
} from "@/lib/services/LessonBookingService";
import type { AvailableLessonTime } from "@/types/domain";

export default async function LessonsPage() {
  const data = await getMemberLessonsPageData();
  if ("error" in data) redirect("/auth/login?next=%2Fprotected%2Flessons");

  const nowIso = new Date().toISOString();
  const scheduled = data.lessons.filter(
    (lesson) => lesson.status === "scheduled" && lesson.startsAt >= nowIso,
  );
  const availability = await Promise.all(
    scheduled.map(async (lesson) => ({
      bookingId: lesson.id,
      result: await getAvailableLessonTimes({
        coachId: lesson.coachId,
        weapon: lesson.weapon,
      }),
    })),
  );
  const availableTimesByBooking: Record<string, AvailableLessonTime[]> = {};
  for (const item of availability) {
    availableTimesByBooking[item.bookingId] = item.result.success ? item.result.data : [];
  }

  return (
    <div className="space-y-8">
      <header className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div className="max-w-3xl">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.26em] text-slate-500">
            Member Portal
          </p>
          <h1 className="font-serif text-4xl font-light tracking-tight text-slate-950 sm:text-5xl">
            Your lessons
          </h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Review upcoming lessons, make a time change, or see your fencing history.
            This page never includes billing information.
          </p>
        </div>
        <LessonsEmptyCallToAction />
      </header>

      <MemberLessons
        lessons={data.lessons}
        availableTimesByBooking={availableTimesByBooking}
        nowIso={nowIso}
        cancelAction={cancelLessonBookingAction}
        rescheduleAction={rescheduleLessonBookingAction}
      />
    </div>
  );
}
