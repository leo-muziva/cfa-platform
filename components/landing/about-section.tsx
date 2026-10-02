"use client";

import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import Image from "next/image";
import { ChevronDown } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { VerticalVideoReel } from "@/components/landing/vertical-video-reel";

// Weapon cards — kept as data so the entrance stagger and markup stay in sync.
const WEAPONS = [
  {
    name: "Foil",
    description: "The duel of precision — point control, tempo and right-of-way.",
    image: "/media/weapon-examples/foil_ex_card.png",
    alt: "Two fencers in a close foil exchange.",
  },
  {
    name: "Épée",
    description: "The whole body is a target. Patience, timing, nerve.",
    image: "/media/weapon-examples/epee_ex_card.png",
    alt: "An épée bout mid-lunge, referee looking on.",
  },
  {
    name: "Sabre",
    description: "Slashing speed — the cavalry weapon of explosive attacks.",
    image: "/media/weapon-examples/sabre_ex_card.png",
    alt: "Two sabre fencers in a fast exchange.",
  },
] as const;

export function AboutSection() {
  const shouldReduceMotion = useReducedMotion();
  // Which weapon card is open. Only one at a time.
  const [openWeapon, setOpenWeapon] = useState<string | null>(null);

  return (
    <section
      id="about"
      className="relative bg-background text-primary px-4 sm:px-6 md:px-12 py-20 md:py-28"
    >
      <div className="max-w-6xl mx-auto">
        {/* Intro text with the vertical video reel beside it on desktop,
            stacked under the text on phones. */}
        <div className="mb-12 grid gap-10 md:mb-16 md:grid-cols-[1fr_auto] md:items-center">
          <div>
            <p className="text-sm font-semibold uppercase tracking-widest text-[#8a6810] dark:text-cfa-gold mb-3">
              The Club
            </p>
            <h2 className="text-3xl md:text-5xl font-normal tracking-[-0.04em] mb-4">
              Cape Town&rsquo;s home of fencing since 1997.
            </h2>
            <p className="text-muted-foreground max-w-2xl mb-8">
              South Africa&rsquo;s premier fencing club, training at the Belvedere
              Community Centre in Rondebosch — from first-time beginners to
              national champions.
            </p>

            {/* Logged-out visitors get sent to login by the proxy. */}
            <Button asChild size="lg" className="h-12 rounded-full px-10 text-base">
              <Link href="/protected/book">Start Fencing Now</Link>
            </Button>
          </div>

          <motion.div
            initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 24, filter: "blur(12px)" }}
            whileInView={shouldReduceMotion ? { opacity: 1 } : { opacity: 1, y: 0, filter: "blur(0px)" }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="mx-auto w-[220px] sm:w-[240px] md:mx-0 lg:w-[260px]"
          >
            <VerticalVideoReel />
          </motion.div>
        </div>

        {/* Click, tap or Enter on a card opens the bit about that weapon.
            Click it again or open another one to close it. */}
        <div className="grid items-start md:grid-cols-3 gap-6">
          {WEAPONS.map((weapon, index) => {
            const open = openWeapon === weapon.name;
            const panelId = `weapon-${index}`;
            return (
            <motion.div
              key={weapon.name}
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
              transition={{ duration: 0.6, ease: "easeOut", delay: index * 0.1 }}
              className="cfa-light-card overflow-hidden rounded-2xl"
            >
              <button
                type="button"
                onClick={() => setOpenWeapon(open ? null : weapon.name)}
                aria-expanded={open}
                aria-controls={panelId}
                className="group relative block aspect-[4/3] w-full overflow-hidden text-left focus-visible:outline focus-visible:outline-2 focus-visible:[outline-offset:-4px] focus-visible:outline-cfa-gold"
              >
                <Image
                  src={weapon.image}
                  alt={weapon.alt}
                  fill
                  sizes="(min-width: 768px) 33vw, 100vw"
                  className="object-cover motion-safe:transition-transform motion-safe:duration-500 group-hover:scale-105"
                />
                <div
                  aria-hidden="true"
                  className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent"
                />
                <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-6">
                  <h3 className="text-xl font-medium text-white">{weapon.name}</h3>
                  <ChevronDown
                    className={`h-6 w-6 shrink-0 text-white motion-safe:transition-transform ${open ? "rotate-180" : ""}`}
                    aria-hidden="true"
                  />
                </div>
              </button>
              {/* Placeholder text until the new weapon excerpts (H-08) are written. */}
              <div id={panelId} hidden={!open} className="p-6 text-muted-foreground">
                {weapon.description}
              </div>
            </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
