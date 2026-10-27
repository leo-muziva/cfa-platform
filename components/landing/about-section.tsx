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
    description: "Hits are scored with the point on the torso. When both fencers hit, right-of-way decides who scores.",
    image: "/media/weapon-examples/foil_ex_card.png",
    alt: "Two fencers in a close foil exchange.",
    video: "https://www.youtube.com/watch?v=g-P_q5gdvRM",
  },
  {
    name: "Épée",
    description: "Hits are scored with the point anywhere on the body. There is no right-of-way: whoever hits first scores, and if both hit together, both score.",
    image: "/media/weapon-examples/epee_ex_card.png",
    alt: "An épée bout mid-lunge, referee looking on.",
    video: "https://www.youtube.com/watch?v=88mBQ2u2Wb0",
  },
  {
    name: "Sabre",
    description: "Hits are scored with the edge or point anywhere above the waist. Right-of-way applies, and bouts are the fastest of the three weapons.",
    image: "/media/weapon-examples/sabre_ex_card.png",
    alt: "Two sabre fencers in a fast exchange.",
    video: "https://www.youtube.com/watch?v=4ipiJFlU_Dg",
  },
] as const;

/** The About section of the home page, with expandable cards for each weapon. */
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
              South Africa&rsquo;s premier fencing club since 1997
            </h2>
            <p className="text-muted-foreground max-w-2xl mb-8">
              We train at the Belvedere Community Centre in Rondebosch and coach
              fencers of every age and level, from first-timers to national
              champions.
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
              <div id={panelId} hidden={!open} className="p-6">
                <p className="text-muted-foreground">{weapon.description}</p>
                {/* Video opens on YouTube in a new tab. Booking goes to the
                    normal booking page (logged out visitors get sent to login). */}
                <div className="mt-5 flex flex-wrap gap-3">
                  <Button asChild variant="outline" className="rounded-full">
                    <a
                      href={weapon.video}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`Watch a video about ${weapon.name} (opens YouTube in a new tab)`}
                    >
                      Watch a video
                    </a>
                  </Button>
                  <Button asChild className="rounded-full">
                    <Link href="/protected/book">Start {weapon.name} Now</Link>
                  </Button>
                </div>
              </div>
            </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
