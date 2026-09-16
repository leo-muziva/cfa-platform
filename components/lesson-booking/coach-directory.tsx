import Link from "next/link";
import { ArrowRight, CalendarClock, ShieldCheck } from "lucide-react";
import { formatCapeTownLessonDate } from "@/lib/booking-calendar";
import type { LessonCoachSummary } from "@/types/domain";

const weaponLabels = {
  foil: "Foil",
  epee: "Epee",
  sabre: "Sabre",
} as const;

const coachPhotos: Record<string, { url: string; position: string }> = {
  "Dr. Misha Galukhin": {
    url: "https://images.unsplash.com/photo-1560250097-0b93528c311a?q=85&w=1200&auto=format&fit=crop",
    position: "center 24%",
  },
  "Jacques Viljoen": {
    url: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?q=85&w=1200&auto=format&fit=crop",
    position: "center 24%",
  },
  "Jeremy Saner": {
    url: "https://images.unsplash.com/photo-1568602471122-7832951cc4c5?q=85&w=1200&auto=format&fit=crop",
    position: "center 24%",
  },
};

const fallbackCoachPhoto = coachPhotos["Dr. Misha Galukhin"];

export type LessonCoachDirectoryEntry = LessonCoachSummary & {
  nextAvailableAt: string | null;
};

export function CoachDirectory({ coaches }: { coaches: LessonCoachDirectoryEntry[] }) {
  if (coaches.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6">
        <h2 className="font-serif text-2xl text-slate-950">No coaches are taking bookings</h2>
        <p className="mt-2 text-sm text-slate-600">
          Check again soon. Existing lessons are still available in your lesson history.
        </p>
      </div>
    );
  }

  return (
    <ul className="grid gap-5 md:grid-cols-2 xl:grid-cols-3" aria-label="Available lesson coaches">
      {coaches.map((coach) => {
        const photo = coachPhotos[coach.fullName] ?? fallbackCoachPhoto;

        return (
          <li key={coach.coachId}>
            <article className="group flex h-full flex-col overflow-hidden rounded-3xl border border-[#2d176b]/10 bg-[linear-gradient(145deg,#ffffff,#faf8ff)] shadow-[0_16px_45px_rgba(37,20,92,0.08)]">
              <div className="relative h-44 overflow-hidden bg-[#2d176b]">
                <div
                  aria-hidden="true"
                  className="absolute inset-0 bg-cover transition-transform duration-500 group-hover:scale-105"
                  style={{ backgroundImage: `url("${photo.url}")`, backgroundPosition: photo.position }}
                />
                <div aria-hidden="true" className="absolute inset-0 bg-[linear-gradient(120deg,rgba(37,20,92,0.78),rgba(37,20,92,0.12))]" />
                <p className="absolute bottom-5 left-6 text-xs font-semibold uppercase tracking-[0.2em] text-white/90">
                  CFA coach
                </p>
                <span className="absolute right-5 top-5 rounded-full bg-emerald-50 p-2 text-emerald-700 shadow-sm" title="Taking bookings">
                  <ShieldCheck className="h-5 w-5" aria-hidden="true" />
                  <span className="sr-only">Taking bookings</span>
                </span>
              </div>

              <div className="flex flex-1 flex-col p-6">
                <h2 className="font-serif text-3xl font-light text-slate-950">
                  {coach.fullName}
                </h2>

                <div className="mt-5 flex flex-wrap gap-2" aria-label="Weapons offered">
                  {coach.weapons.map((weapon) => (
                    <span
                      key={weapon}
                      className="rounded-full border border-[#2d176b]/15 bg-white px-3 py-1 text-sm text-[#423368]"
                    >
                      {weaponLabels[weapon]}
                    </span>
                  ))}
                </div>

                <p className="mt-6 flex items-center gap-2 text-sm text-slate-600">
                  <CalendarClock className="h-4 w-4 shrink-0 text-[#2d176b]" aria-hidden="true" />
                  {coach.nextAvailableAt
                    ? "Next free: " + formatCapeTownLessonDate(coach.nextAvailableAt)
                    : "No free times in the current booking window"}
                </p>

                <Link
                  href={"/protected/book/" + coach.coachId}
                  className="mt-6 inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-[#2d176b] px-5 py-3 font-medium text-white transition-colors hover:bg-[#43258c] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2d176b]"
                >
                  View available times
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" aria-hidden="true" />
                </Link>
              </div>
            </article>
          </li>
        );
      })}
    </ul>
  );
}