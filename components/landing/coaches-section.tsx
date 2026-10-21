import Image from "next/image";

const COACHES = [
  {
    name: "Dr. Misha Galukhin",
    description:
      "Russian maestro Dr. Misha Galukhin earned a PhD in sport science in Moscow, with research on attacking technique and footwork in elite foil fencers. He founded Cape Fencing Academy in 1997 and still leads its coaching. He has been the coach behind many of South Africa’s National Champions over the years.",
    src: "/media/coaches/coach_misha.png",
  },
  {
    name: "Jacques Viljoen",
    description:
      "Jacques started fencing with Misha at CFA in 2000. He went on to fence professionally, winning multiple South African foil titles and medalling internationally while living and training in the UK, Germany and Italy. He returned to Cape Town during the Covid pandemic and now coaches foil at the club.",
    src: "/media/coaches/coach_jacques.png",
  },
  {
    name: "Jeremy Saner",
    description:
      "Jeremy learned to fence under Misha’s compatriot Dr. Tyshler in Johannesburg before moving to Cape Town to train with Misha. He coaches all three weapons, specialises in sabre, and is the current South African senior men’s sabre champion.",
    src: "/media/coaches/coach_jeremy.png",
  },
  {
    name: "Caden Sampson",
    description:
      "Caden is a multiple-time South African senior men’s foil champion and the current national title holder. He also coaches fencing at Bishops.",
    src: "/media/coaches/coach_caden.png",
  },
] as const;

export function CoachesSection() {
  return (
    <section
      id="coaches"
      className="relative overflow-hidden bg-background px-4 py-20 text-primary sm:px-6 md:px-12 md:py-28"
    >
      <div className="pointer-events-none absolute -left-24 top-20 h-64 w-64 rounded-full bg-cfa-gold/15 blur-3xl" />
      <div className="pointer-events-none absolute -right-20 bottom-8 h-72 w-72 rounded-full bg-cfa-purple/10 blur-3xl" />
      <div className="relative mx-auto max-w-6xl">
        <p className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-[#8a6810] dark:text-cfa-gold">
          The Coaches
        </p>
        <h2 className="mb-4 max-w-3xl text-3xl font-normal tracking-[-0.04em] md:text-5xl">
          Train with national champions
        </h2>
        <p className="max-w-2xl text-muted-foreground">
          Our coaches include several South African champions who have competed
          on the international circuit, led by founder and head coach Dr. Misha
          Galukhin.
        </p>

        {/* 4 across on desktop, 2x2 on tablet. On phones it's a short list
            with a small photo beside the name. Bios always show. */}
        <ul className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-4 md:mt-16">
          {COACHES.map((coach) => (
            <li key={coach.name} className="cfa-light-card overflow-hidden rounded-2xl">
              <div className="flex items-center sm:block">
                <div className="relative aspect-square w-24 shrink-0 overflow-hidden sm:aspect-[3/4] sm:w-full">
                  <Image
                    src={coach.src}
                    alt=""
                    fill
                    sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 96px"
                    className="object-cover object-top"
                  />
                </div>
                <div className="p-4 sm:px-5 sm:pt-5 sm:pb-2">
                  <h3 className="text-base font-medium sm:text-lg">{coach.name}</h3>
                </div>
              </div>
              <p className="px-4 pb-4 text-sm leading-6 text-muted-foreground sm:px-5 sm:pb-5">
                {coach.description}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
