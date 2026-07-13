"use client";

import { Clock } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";

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

export function ScheduleSection() {
  const shouldReduceMotion = useReducedMotion();

  return (
    <section
      id="schedule"
      className="relative bg-black text-white px-4 sm:px-6 md:px-12 py-20 md:py-28"
    >
      <div className="max-w-6xl mx-auto">
        <p className="text-sm uppercase tracking-widest text-gray-400 mb-3">
          Train With Us
        </p>
        <h2 className="text-3xl md:text-5xl font-normal tracking-[-0.04em] mb-4">
          Weekly schedule.
        </h2>

        <div className="grid sm:grid-cols-2 gap-6 mt-12 md:mt-16">
          {SESSIONS.map((session, index) => (
            <motion.div
              key={session.days}
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
              <Clock size={24} className="mb-4" aria-hidden="true" />
              <h3 className="text-xl font-medium mb-1">{session.days}</h3>
              <p className="text-gray-400 mb-3">{session.time}</p>
              <p className="text-gray-400">{session.description}</p>
            </motion.div>
          ))}
        </div>

        {/* TODO: schedule + drop-in fee conflict across old-site pages — confirm with sponsor (SPONSOR-QUESTIONS #11) */}
        <p className="text-gray-400 text-sm mt-8">
          Visiting fencers welcome — R120 drop-in.
        </p>
      </div>
    </section>
  );
}
