"use client";

import { motion, useReducedMotion } from "framer-motion";
import Image from "next/image";

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

  return (
    <section
      id="about"
      className="relative bg-background text-primary px-4 sm:px-6 md:px-12 py-20 md:py-28"
    >
      <div className="max-w-6xl mx-auto">
        <p className="text-sm font-semibold uppercase tracking-widest text-[#8a6810] dark:text-cfa-gold mb-3">
          The Club
        </p>
        <h2 className="text-3xl md:text-5xl font-normal tracking-[-0.04em] mb-4">
          Cape Town&rsquo;s home of fencing since 1997.
        </h2>
        <p className="text-muted-foreground max-w-2xl mb-12 md:mb-16">
          South Africa&rsquo;s premier fencing club, training at the Belvedere
          Community Centre in Rondebosch — from first-time beginners to
          national champions.
        </p>

        <div className="grid md:grid-cols-3 gap-6">
          {WEAPONS.map((weapon, index) => (
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
              className="group relative aspect-[4/3] overflow-hidden rounded-2xl"
            >
              <Image
                src={weapon.image}
                alt={weapon.alt}
                fill
                sizes="(min-width: 768px) 33vw, 100vw"
                className="object-cover transition-transform duration-500 group-hover:scale-105"
              />
              <div
                aria-hidden="true"
                className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent"
              />
              <div className="absolute inset-x-0 bottom-0 p-6">
                <h3 className="text-xl font-medium text-white mb-1">{weapon.name}</h3>
                <p className="text-white/80">{weapon.description}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
