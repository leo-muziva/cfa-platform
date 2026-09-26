"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, Mail, MapPin, Users } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { GlassDialog } from "@/components/ui/glass-dialog";
import { TiltCard } from "@/components/ui/tilt-card";
import {
  PUBLIC_CONTACT_LINKS,
  PUBLIC_LEGAL_LINKS,
} from "@/lib/public-site";

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

export function ContactFooter() {
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

  return (
    <section
      id="contact"
      className="relative bg-background text-primary px-4 sm:px-6 md:px-12 py-20 md:py-28"
    >
      <div className="max-w-6xl mx-auto">
        <p className="text-sm font-semibold uppercase tracking-widest text-[#8a6810] dark:text-cfa-gold mb-3">
          Get in Touch
        </p>
        <h2 className="text-3xl md:text-5xl font-normal tracking-[-0.04em] mb-4">
          Find us in Rondebosch.
        </h2>

        <div className="grid md:grid-cols-2 gap-10 mt-12 md:mt-16">
          <motion.ul
            initial={
              shouldReduceMotion
                ? { opacity: 0 }
                : { opacity: 0, y: 24, filter: "blur(12px)" }
            }
            whileInView={
              shouldReduceMotion
                ? { opacity: 1 }
                : { opacity: 1, y: 0, filter: "blur(0px)" }
            }
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="flex flex-col gap-4"
          >
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

          <motion.div
            initial={
              shouldReduceMotion
                ? { opacity: 0 }
                : { opacity: 0, y: 24, filter: "blur(12px)" }
            }
            whileInView={
              shouldReduceMotion
                ? { opacity: 1 }
                : { opacity: 1, y: 0, filter: "blur(0px)" }
            }
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.6, ease: "easeOut", delay: 0.1 }}
          >
            <TiltCard
              className="cfa-light-card h-full rounded-2xl p-6"
              tiltLimit={6}
              scale={1.02}
              spotlightColor="rgba(255,210,28,0.18)"
            >
              <div className="relative z-20">
                <h3 className="text-lg font-medium mb-4">Training hours</h3>
                <ul className="space-y-2 text-muted-foreground">
                  <li>Tue–Thu 18:30 – 21:30</li>
                  <li>Sat 11:00 – 13:30</li>
                </ul>
              </div>
            </TiltCard>
          </motion.div>
        </div>

        <motion.div
          initial={
            shouldReduceMotion
              ? { opacity: 0 }
              : { opacity: 0, y: 24, filter: "blur(12px)" }
          }
          whileInView={
            shouldReduceMotion
              ? { opacity: 1 }
              : { opacity: 1, y: 0, filter: "blur(0px)" }
          }
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6, ease: "easeOut", delay: 0.2 }}
          className="mt-8 md:mt-10 flex gap-3 overflow-x-auto"
        >
          {LOCATION_PHOTOS.map((photo, index) => (
            <button
              key={photo.src}
              type="button"
              onClick={() => setActivePhoto(index)}
              aria-label={`View larger photo: ${photo.alt}`}
              className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl transition-transform hover:scale-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cfa-gold sm:h-20 sm:w-20"
            >
              <Image
                src={photo.src}
                alt=""
                fill
                sizes="80px"
                className="object-cover"
              />
            </button>
          ))}
        </motion.div>

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

        <div className="border-t border-cfa-purple/10 pt-8 mt-16 flex flex-col sm:flex-row justify-between gap-3 text-sm text-muted-foreground">
          <p>© 2026 Cape Fencing Academy</p>
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            <span>Est. 1997 · Rondebosch, Cape Town</span>
            {PUBLIC_LEGAL_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="hover:text-[#8a6810] dark:hover:text-cfa-gold underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-cfa-gold"
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
