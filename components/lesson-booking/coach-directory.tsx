import Image from "next/image";
import Link from "next/link";
import { Fragment } from "react";
import { ArrowUpRight, CalendarClock, Swords } from "lucide-react";
import { formatCapeTownLessonDate } from "@/lib/booking-calendar";
import type { LessonCoachSummary } from "@/types/domain";

const weaponLabels = {
  foil: "Foil",
  epee: "Epee",
  sabre: "Sabre",
} as const;

const coachPhotos: Record<string, { url: string; position: string }> = {
  "Dr. Misha Galukhin": {
    url: "/media/coaches/coach_misha.png",
    position: "center 24%",
  },
  "Jacques Viljoen": {
    url: "/media/coaches/coach_jacques.png",
    position: "center 24%",
  },
  "Jeremy Saner": {
    url: "/media/coaches/coach_jeremy.png",
    position: "center 24%",
  },
  "Caden Sampson": {
    url: "/media/coaches/coach_caden.png",
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

        const href = "/protected/book/" + coach.coachId;

        // Layout mirrors the DOMA workspace card: full-bleed portrait, a dark
        // bottom fade, and an inset frosted panel carrying the details.
        return (
          <li key={coach.coachId}>
            <article className="group relative isolate aspect-[4/4.3] overflow-hidden rounded-[22px] bg-[#25145c] shadow-[0_20px_50px_rgba(20,10,46,0.18)]">
              <Image
                src={photo.url}
                alt=""
                fill
                sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 33vw"
                className="-z-10 object-cover transition-transform ease-out [transition-duration:600ms] group-hover:scale-105 motion-reduce:transition-none motion-reduce:group-hover:scale-100"
                style={{ objectPosition: photo.position }}
              />
              <div
                aria-hidden="true"
                className="absolute inset-0 -z-10 bg-[linear-gradient(to_top,rgba(20,10,46,0.82)_0%,rgba(20,10,46,0.2)_50%,transparent_75%)]"
              />
              <p className="absolute left-[18px] top-4 font-mono text-[10px] uppercase tracking-[0.14em] text-white [text-shadow:0_1px_3px_rgba(0,0,0,0.6)]">
                {coach.nextAvailableAt ? "Taking bookings" : "No free times"}
              </p>

              <div className="absolute inset-x-3.5 bottom-3.5 grid grid-cols-[1fr_auto] items-start gap-x-3 gap-y-1.5 rounded-[18px] border border-white/25 bg-white/[0.13] px-[18px] pb-[18px] pt-4 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.2)] backdrop-blur-[22px] backdrop-saturate-150">
                <div className="min-w-0">
                  <p className="mb-2 flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.16em] text-white/85">
                    <Swords className="h-[13px] w-[13px]" aria-hidden="true" />
                    CFA coach
                  </p>
                  <h2 className="text-[21px] font-semibold leading-tight">
                    <Link
                      href={href}
                      className="rounded-sm underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                    >
                      {coach.fullName}
                    </Link>
                  </h2>
                </div>
                <Link
                  href={href}
                  aria-label={"View available times with " + coach.fullName}
                  className="grid h-[38px] w-[38px] place-items-center rounded-xl border border-white/40 bg-white/10 text-white transition-colors hover:bg-white hover:text-[#25145c] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                >
                  <ArrowUpRight className="h-[19px] w-[19px]" aria-hidden="true" />
                </Link>

                <p className="col-span-2 mt-1.5 flex flex-wrap items-center gap-2 text-[13px] text-white/85">
                  <span className="sr-only">Weapons offered:</span>
                  {coach.weapons.map((weapon, index) => (
                    <Fragment key={weapon}>
                      {index > 0 && <i aria-hidden="true" className="h-[3px] w-[3px] rounded-full bg-white/70" />}
                      <span>{weaponLabels[weapon]}</span>
                    </Fragment>
                  ))}
                </p>

                <p className="col-span-2 mt-3.5 flex items-center gap-2 border-t border-white/25 pt-3.5 text-[13px] text-white/85">
                  <CalendarClock className="h-4 w-4 shrink-0" aria-hidden="true" />
                  {coach.nextAvailableAt ? (
                    <span>
                      Next free <strong className="font-mono text-[14px] font-semibold tracking-[0.02em] text-white">{formatCapeTownLessonDate(coach.nextAvailableAt)}</strong>
                    </span>
                  ) : (
                    "No free times in the current booking window"
                  )}
                </p>
              </div>
            </article>
          </li>
        );
      })}
    </ul>
  );
}