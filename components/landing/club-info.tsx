"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, Clock, Mail, MapPin, Users } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import Image from "next/image";
import { GlassDialog } from "@/components/ui/glass-dialog";
import { TiltCard } from "@/components/ui/tilt-card";
import { PUBLIC_CONTACT_LINKS } from "@/lib/public-site";
import { cn } from "@/lib/utils";

// Club info block: training times, drop-in fee, venue, photos and contact.
// Used on the home page and on /protected/info.

const SESSIONS = [
  {
    days: "Tuesday – Thursday",
    time: "18:30 – 21:30",
    description: "Club training — all levels",
  },
  {
    days: "Saturday",
    time: "11:00 – 13:30",
    description: "Footwork, sparring & open fencing",
  },
] as const;

const CONTACT_ICONS = {
  location: MapPin,
  email: Mail,
  facebook: Users,
} as const;

const LOCATION_PHOTOS = [
  {
    src: "/media/location/01_grounds_green_roofs.jpg",
    alt: "The club's grounds and training hall, seen across the lawn.",
    aspect: "aspect-[4/3]",
  },
  {
    src: "/media/location/02_cream_gable_building.jpg",
    alt: "One of the buildings on the venue grounds.",
    aspect: "aspect-[4/3]",
  },
  {
    src: "/media/location/03_chess_rd_entrance.jpg",
    alt: "Chess Road, the street where the venue entrance is located.",
    aspect: "aspect-[2208/896]",
  },
  {
    src: "/media/location/04_parking_entrance.jpg",
    alt: "The parking area and entrance point at the venue.",
    aspect: "aspect-[2320/848]",
  },
  {
    src: "/media/location/05_map_belvedere.jpg",
    alt: "Map showing the venue location on Chess Road, Rondebosch.",
    aspect: "aspect-[1968/1008]",
  },
  {
    src: "/media/location/06_satellite_belvedere.jpg",
    alt: "Satellite view of the venue grounds and surrounding streets.",
    aspect: "aspect-[1968/1008]",
  },
] as const;

// compact: smaller headings for use inside the portal, under a page heading.
export function ClubInfo({
  id,
  className,
  compact = false,
}: {
  id?: string;
  className?: string;
  compact?: boolean;
}) {
  const shouldReduceMotion = useReducedMotion();
  const [activePhoto, setActivePhoto] = useState<number | null>(null);

  const showPrevious = () =>
    setActivePhoto((current) =>
      current === null
        ? current
        : (current - 1 + LOCATION_PHOTOS.length) % LOCATION_PHOTOS.length,
    );
  const showNext = () =>
    setActivePhoto((current) =>
      current === null ? current : (current + 1) % LOCATION_PHOTOS.length,
    );

  useEffect(() => {
    if (activePhoto === null) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "ArrowLeft") showPrevious();
      if (event.key === "ArrowRight") showNext();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [activePhoto]);

  const fadeIn = (delay: number) => ({
    initial: shouldReduceMotion
      ? { opacity: 0 }
      : { opacity: 0, y: 24, filter: "blur(12px)" },
    whileInView: shouldReduceMotion
      ? { opacity: 1 }
      : { opacity: 1, y: 0, filter: "blur(0px)" },
    viewport: { once: true, margin: "-80px" },
    transition: { duration: 0.6, ease: "easeOut" as const, delay },
  });

  return (
    <section
      id={id}
      className={cn(
        "relative bg-muted/30 text-primary px-4 sm:px-6 md:px-12 py-20 md:py-28",
        className,
      )}
    >
      <div className="max-w-6xl mx-auto">
        {!compact && (
          <p className="text-sm font-semibold uppercase tracking-widest text-[#8a6810] dark:text-cfa-gold mb-3">
            Train With Us
          </p>
        )}
        <h2
          className={
            compact
              ? "text-2xl font-semibold text-foreground"
              : "text-3xl md:text-5xl font-normal tracking-[-0.04em] mb-4"
          }
        >
          Weekly schedule.
        </h2>

        <div
          className={cn(
            "grid grid-cols-1 gap-10 md:grid-cols-2",
            compact ? "mt-6" : "mt-12 md:mt-16",
          )}
        >
          {/* Times and drop-in fee */}
          <div>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-1">
              {SESSIONS.map((session, index) => (
                <motion.div key={session.days} {...fadeIn(index * 0.1)}>
                  <TiltCard
                    className="cfa-light-card h-full rounded-2xl p-6"
                    tiltLimit={6}
                    scale={1.02}
                    spotlightColor="rgba(255,210,28,0.18)"
                  >
                    <div className="relative z-20">
                      <Clock size={24} className="mb-4 text-cfa-purple" aria-hidden="true" />
                      <h3 className="text-xl font-medium mb-1">{session.days}</h3>
                      <p className="text-[#8a6810] dark:text-cfa-gold mb-3">{session.time}</p>
                      <p className="text-muted-foreground">{session.description}</p>
                    </div>
                  </TiltCard>
                </motion.div>
              ))}
            </div>

            {/* TODO: schedule + drop-in fee conflict across old-site pages — confirm with sponsor (SPONSOR-QUESTIONS #11) */}
            <p className="text-muted-foreground text-sm mt-6">
              Visiting fencers welcome — R120 drop-in.
            </p>
          </div>

          {/* Venue, contact and photos */}
          <div>
            <h3
              className={
                compact
                  ? "text-xl font-semibold text-foreground mb-4"
                  : "text-2xl font-normal tracking-[-0.03em] mb-6"
              }
            >
              Find us in Rondebosch.
            </h3>
            <motion.ul {...fadeIn(0.1)} className="flex flex-col gap-4">
              {PUBLIC_CONTACT_LINKS.map((row) => {
                const Icon = CONTACT_ICONS[row.id];
                return (
                  <li key={row.label}>
                    <TiltCard
                      className="cfa-light-card rounded-2xl"
                      tiltLimit={6}
                      scale={1.02}
                      spotlightColor="rgba(255,210,28,0.18)"
                    >
                      <a
                        href={row.href}
                        {...(row.external
                          ? { target: "_blank", rel: "noopener noreferrer" }
                          : {})}
                        className="relative z-20 flex items-center gap-4 rounded-2xl p-6 hover:text-[#8a6810] dark:hover:text-cfa-gold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:[outline-offset:-4px] focus-visible:outline-cfa-purple dark:focus-visible:outline-cfa-gold"
                      >
                        <Icon size={22} className="shrink-0" aria-hidden="true" />
                        <span>{row.label}</span>
                      </a>
                    </TiltCard>
                  </li>
                );
              })}
            </motion.ul>

            {/* Wraps instead of scrolling sideways so every photo is visible. */}
            <motion.div {...fadeIn(0.2)} className="mt-6 grid grid-cols-3 gap-3 sm:grid-cols-6 md:grid-cols-3 lg:grid-cols-6">
              {LOCATION_PHOTOS.map((photo, index) => (
                <button
                  key={photo.src}
                  type="button"
                  onClick={() => setActivePhoto(index)}
                  aria-label={`View larger photo: ${photo.alt}`}
                  className="relative aspect-square w-full overflow-hidden rounded-xl transition-transform hover:scale-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cfa-gold"
                >
                  <Image src={photo.src} alt="" fill sizes="(min-width: 1024px) 90px, 130px" className="object-cover" />
                </button>
              ))}
            </motion.div>
          </div>
        </div>

        <GlassDialog
          open={activePhoto !== null}
          onClose={() => setActivePhoto(null)}
          label="Venue photo"
          className="max-w-3xl items-center p-4 sm:p-6"
        >
          <div className="flex w-full flex-col items-center gap-4">
            <div
              className={`relative max-h-[70vh] w-full overflow-hidden rounded-2xl ${LOCATION_PHOTOS[activePhoto ?? 0].aspect}`}
            >
              <Image
                src={LOCATION_PHOTOS[activePhoto ?? 0].src}
                alt={LOCATION_PHOTOS[activePhoto ?? 0].alt}
                fill
                sizes="(min-width: 768px) 700px, 90vw"
                className="object-contain"
                priority
              />
            </div>
            <div className="flex items-center gap-5">
              <button
                type="button"
                onClick={showPrevious}
                aria-label="Previous photo"
                className="rounded-full p-2 text-muted-foreground hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-cfa-gold"
              >
                <ArrowLeft className="h-5 w-5" aria-hidden="true" />
              </button>
              <span className="text-sm text-muted-foreground">
                {(activePhoto ?? 0) + 1} / {LOCATION_PHOTOS.length}
              </span>
              <button
                type="button"
                onClick={showNext}
                aria-label="Next photo"
                className="rounded-full p-2 text-muted-foreground hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-cfa-gold"
              >
                <ArrowRight className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
          </div>
        </GlassDialog>
      </div>
    </section>
  );
}
