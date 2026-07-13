"use client";

import { User } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";

// Public roster — no personal emails here (POPIA-lean); club contact lives
// in the contact section instead.
const COACHES = [
  { name: "Dr. Misha Galukhin", role: "Founder & Head Coach" },
  { name: "Jacques Viljoen", role: "Senior Foil Coach" },
  { name: "Jeremy Saner", role: "Sabre · Épée · Foil" },
  { name: "Caden Sampson", role: "Foil Coach" },
] as const;

export function CoachesSection() {
  const shouldReduceMotion = useReducedMotion();

  return (
    <section
      id="coaches"
      className="relative bg-black text-white px-4 sm:px-6 md:px-12 py-20 md:py-28"
    >
      <div className="max-w-6xl mx-auto">
        <p className="text-sm uppercase tracking-widest text-gray-400 mb-3">
          The Coaches
        </p>
        <h2 className="text-3xl md:text-5xl font-normal tracking-[-0.04em] mb-4">
          Learn from the best blades in the country.
        </h2>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 mt-12 md:mt-16">
          {COACHES.map((coach, index) => (
            <motion.div
              key={coach.name}
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
              className="liquid-glass rounded-2xl p-6 flex flex-col items-center text-center"
            >
              <div className="liquid-glass rounded-full w-16 h-16 flex items-center justify-center mb-4">
                <User size={28} aria-hidden="true" />
              </div>
              <h3 className="text-lg font-medium">{coach.name}</h3>
              <p className="text-gray-400 text-sm">{coach.role}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
