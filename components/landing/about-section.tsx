"use client";

import { Swords, Target, Zap } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";

// Weapon cards — kept as data so the entrance stagger and markup stay in sync.
const WEAPONS = [
  {
    icon: Target,
    name: "Foil",
    description: "The duel of precision — point control, tempo and right-of-way.",
  },
  {
    icon: Zap,
    name: "Épée",
    description: "The whole body is a target. Patience, timing, nerve.",
  },
  {
    icon: Swords,
    name: "Sabre",
    description: "Slashing speed — the cavalry weapon of explosive attacks.",
  },
] as const;

export function AboutSection() {
  const shouldReduceMotion = useReducedMotion();

  return (
    <section
      id="about"
      className="relative bg-black text-white px-4 sm:px-6 md:px-12 py-20 md:py-28"
    >
      <div className="max-w-6xl mx-auto">
        <p className="text-sm uppercase tracking-widest text-gray-400 mb-3">
          The Club
        </p>
        <h2 className="text-3xl md:text-5xl font-normal tracking-[-0.04em] mb-4">
          Cape Town&rsquo;s home of fencing since 1997.
        </h2>
        <p className="text-gray-400 max-w-2xl mb-12 md:mb-16">
          South Africa&rsquo;s premier fencing club, training at the Belvedere
          Community Centre in Rondebosch — from first-time beginners to
          national champions.
        </p>

        <div className="grid md:grid-cols-3 gap-6">
          {WEAPONS.map((weapon, index) => {
            const Icon = weapon.icon;
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
                className="liquid-glass rounded-2xl p-6"
              >
                <Icon size={28} className="mb-4" aria-hidden="true" />
                <h3 className="text-xl font-medium mb-2">{weapon.name}</h3>
                <p className="text-gray-400">{weapon.description}</p>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
