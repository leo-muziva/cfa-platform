import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import { createLessonBookingAction } from "@/app/actions/lessons";
import { CoachBookingCalendar } from "@/components/lesson-booking/coach-booking-calendar";
import {
  getLessonBookingPageData,
  quoteLesson,
} from "@/lib/services/LessonBookingService";
import type { LessonQuote } from "@/types/domain";

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
      <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-5 text-red-900">
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
        <Link href="/protected/book" className="inline-flex min-h-11 items-center gap-2 rounded-full px-1 text-sm font-medium text-[#2d176b] hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#2d176b]">
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          All coaches
        </Link>
        <p className="mt-4 text-xs font-semibold uppercase tracking-[0.26em] text-slate-500">
          Private lesson
        </p>
        <h1 className="mt-2 font-serif text-4xl font-light tracking-tight text-slate-950 sm:text-5xl">
          Book with {data.coach.fullName}
        </h1>
        <p className="mt-3 text-sm text-slate-600">
          Free times are current when this page loads and are always rechecked when you confirm.
        </p>
      </header>

      <CoachBookingCalendar
        coach={data.coach}
        times={data.availableTimes}
        participants={participants}
        quotes={data.capabilities.canSeeHouseholdMoney ? quotes : []}
        canSeeQuote={data.capabilities.canSeeHouseholdMoney}
        createAction={createLessonBookingAction}
      />
    </div>
  );
}
