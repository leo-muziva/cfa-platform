import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import { createLessonBookingAction } from "@/app/actions/lessons";
import { CoachBookingCalendar } from "@/components/lesson-booking/coach-booking-calendar";
import { ProfileIncompleteNotice } from "@/components/lesson-booking/profile-incomplete-notice";
import {
  getLessonBookingPageData,
  quoteLesson,
} from "@/lib/services/LessonBookingService";
import type { LessonQuote } from "@/types/domain";

/** /protected/book/[coachId]: book a lesson with one coach. */
export default async function CoachLessonBookingPage({
  params,
}: {
  params: Promise<{ coachId: string }>;
}) {
  const { coachId } = await params;
  const data = await getLessonBookingPageData(coachId);

  if ("error" in data) {
    if (data.errorCode === "not_authenticated") {
      redirect("/auth/login?next=" + encodeURIComponent("/protected/book/" + coachId));
    }
    if (data.errorCode === "not_found") notFound();
    return (
      <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-5 text-red-900 dark:border-red-400/30 dark:bg-red-950/40 dark:text-red-100">
        {data.error}
      </div>
    );
  }

  const participants = data.participants.map((participant) => ({
    ...participant,
    isSelf: participant.id === data.profile.id,
  }));
  const quotes: LessonQuote[] = [];

  if (data.capabilities.canSeeHouseholdMoney && participants.length > 0) {
    const quoteInputs = [
      participants.slice(0, 1).map((participant) => participant.id),
      participants.slice(0, 2).map((participant) => participant.id),
    ].filter((ids, index, items) => ids.length > 0 && (index === 0 || ids.length !== items[0].length));
    const results = await Promise.all(
      quoteInputs.map((participantIds) => quoteLesson({ participantIds })),
    );
    for (const result of results) {
      if (result.success) quotes.push(result.data);
    }
  }

  return (
    <div className="space-y-7">
      <header>
        <Link href="/protected/book" className="inline-flex min-h-11 items-center gap-2 rounded-full px-1 text-sm font-medium text-cfa-purple hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-cfa-purple dark:text-violet-300 dark:focus-visible:outline-violet-300">
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          All coaches
        </Link>
        <p className="mt-4 text-xs font-semibold uppercase tracking-[0.26em] text-muted-foreground">
          Private lesson
        </p>
        <h1 className="mt-2 font-serif text-4xl font-light tracking-tight text-foreground sm:text-5xl">
          Book with {data.coach.fullName}
        </h1>
      </header>

      {!data.profile.profile_completed_at && !data.capabilities.isAdmin ? <ProfileIncompleteNotice /> : <CoachBookingCalendar
        coach={data.coach}
        times={data.timeOptions}
        participants={participants}
        quotes={data.capabilities.canSeeHouseholdMoney ? quotes : []}
        canSeeQuote={data.capabilities.canSeeHouseholdMoney}
        paymentsAvailable={data.paymentsAvailable}
        dropInFeeCents={data.capabilities.canSeeHouseholdMoney ? data.dropInFeeCents : 0}
        createAction={createLessonBookingAction}
      />}
    </div>
  );
}
