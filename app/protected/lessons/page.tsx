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
  if ("error" in data) {
    if (data.error === "Not authenticated") redirect("/auth/login?next=%2Fprotected%2Flessons");
    return (
      <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-900 dark:border-red-400/30 dark:bg-red-950/40 dark:text-red-100">
        <h1 className="text-lg font-semibold">Your lessons could not be loaded</h1>
        <p className="mt-2">{data.error}</p>
      </div>
    );
  }

  const nowIso = new Date().toISOString();
  const scheduled = data.lessons.filter(
    (lesson) => lesson.status === "scheduled" && !lesson.awaitingPayment && lesson.startsAt >= nowIso,
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
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.26em] text-muted-foreground">
            Member Portal
          </p>
          <h1 className="font-serif text-4xl font-light tracking-tight text-foreground sm:text-5xl">
            Your lessons
          </h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
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
        canPayOnline={data.capabilities.canSeeHouseholdMoney && data.paymentsAvailable}
      />
    </div>
  );
}
