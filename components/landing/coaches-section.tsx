"use client";

import { CircularCoachProfiles } from "@/components/ui/circular-testimonials";

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
        <div className="mt-12 flex justify-center md:mt-16">
          <CircularCoachProfiles profiles={[...COACHES]} autoplay />
        </div>
      </div>
    </section>
  );
}
