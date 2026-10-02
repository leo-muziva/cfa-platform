"use client";

import { useState } from "react";
import Image from "next/image";
import { ChevronDown } from "lucide-react";

const COACHES = [
  {
    name: "Dr. Misha Galukhin",
    designation: "Founder & Head Coach",
    description:
      "Founder and head coach of Cape Fencing Academy, guiding the club's coaching programme and the development of its fencers.",
    src: "/media/coaches/coach_misha.png",
  },
  {
    name: "Jacques Viljoen",
    designation: "Senior Foil Coach",
    description:
      "Focused on foil coaching, technical foundations and helping fencers build precision, timing and confidence on the piste.",
    src: "/media/coaches/coach_jacques.png",
  },
  {
    name: "Jeremy Saner",
    designation: "Sabre · Épée · Foil",
    description:
      "Works across all three weapons, supporting fencers as they develop their technique, tactical awareness and competitive experience.",
    src: "/media/coaches/coach_jeremy.png",
  },
  {
    name: "Caden Sampson",
    designation: "Foil Coach",
    description:
      "Supports foil fencers with focused individual attention and practical coaching for training, sparring and competition.",
    src: "/media/coaches/coach_caden.png",
  },
] as const;

export function CoachesSection() {
  // Which coach's bio is open. Only one at a time.
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section
      id="coaches"
      className="relative overflow-hidden bg-muted/30 px-4 py-20 text-primary sm:px-6 md:px-12 md:py-28"
    >
      <div className="pointer-events-none absolute -left-24 top-20 h-64 w-64 rounded-full bg-cfa-gold/15 blur-3xl" />
      <div className="pointer-events-none absolute -right-20 bottom-8 h-72 w-72 rounded-full bg-cfa-purple/10 blur-3xl" />
      <div className="relative mx-auto max-w-6xl">
        <p className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-[#8a6810] dark:text-cfa-gold">
          The Coaches
        </p>
        <h2 className="mb-4 max-w-3xl text-3xl font-normal tracking-[-0.04em] md:text-5xl">
          Learn from the best blades in the country.
        </h2>
        <p className="max-w-2xl text-muted-foreground">
          Meet the coaching team behind CFA&rsquo;s individual attention,
          technical development and competitive fencing.
        </p>

        {/* 4 across on desktop, 2x2 on tablet, stacked on phones. Tapping a
            card (or Enter when focused) opens that coach's bio in the card. */}
        <ul className="mt-12 grid grid-cols-1 items-start gap-6 sm:grid-cols-2 lg:grid-cols-4 md:mt-16">
          {COACHES.map((coach, index) => {
            const open = openIndex === index;
            const bioId = `coach-bio-${index}`;
            return (
              <li key={coach.name} className="cfa-light-card overflow-hidden rounded-2xl">
                <button
                  type="button"
                  onClick={() => setOpenIndex(open ? null : index)}
                  aria-expanded={open}
                  aria-controls={bioId}
                  className="group block w-full text-left focus-visible:outline focus-visible:outline-2 focus-visible:[outline-offset:-4px] focus-visible:outline-cfa-purple dark:focus-visible:outline-cfa-gold"
                >
                  <div className="relative aspect-[3/4] w-full overflow-hidden">
                    <Image
                      src={coach.src}
                      alt={coach.name}
                      fill
                      sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
                      className="object-cover motion-safe:transition-transform motion-safe:duration-500 group-hover:scale-105"
                    />
                  </div>
                  <div className="flex items-start justify-between gap-3 p-5">
                    <div>
                      <h3 className="text-lg font-medium">{coach.name}</h3>
                      <p className="text-sm text-[#8a6810] dark:text-cfa-gold">{coach.designation}</p>
                    </div>
                    <ChevronDown
                      className={`mt-1 h-5 w-5 shrink-0 text-muted-foreground motion-safe:transition-transform ${open ? "rotate-180" : ""}`}
                      aria-hidden="true"
                    />
                  </div>
                </button>
                <div
                  id={bioId}
                  hidden={!open}
                  className="px-5 pb-5 text-sm leading-6 text-muted-foreground"
                >
                  {coach.description}
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
