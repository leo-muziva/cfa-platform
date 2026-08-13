"use client";

import Link from "next/link";
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
      className="relative bg-[#fffaf0] text-[#25145c] px-4 sm:px-6 md:px-12 py-20 md:py-28"
    >
      <div className="max-w-6xl mx-auto">
        <p className="text-sm font-semibold uppercase tracking-widest text-[#8a6810] mb-3">
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
              className="cfa-light-card rounded-2xl p-6"
            >
              <Clock size={24} className="mb-4 text-[#2d176b]" aria-hidden="true" />
              <h3 className="text-xl font-medium mb-1">{session.days}</h3>
              <p className="text-[#8a6810] mb-3">{session.time}</p>
              <p className="text-[#625b73]">{session.description}</p>
            </motion.div>
          ))}
        </div>

        {/* TODO: schedule + drop-in fee conflict across old-site pages — confirm with sponsor (SPONSOR-QUESTIONS #11) */}
        <p className="text-[#625b73] text-sm mt-8">
          Visiting fencers welcome — R120 drop-in.
        </p>

        <div className="mt-12 rounded-3xl bg-[#25145c] p-7 text-white shadow-[0_20px_60px_rgba(37,20,92,0.18)] sm:p-9">
          <h3 className="text-2xl font-medium tracking-[-0.03em] sm:text-3xl">Create an account to book</h3>
          <p className="mt-3 max-w-2xl leading-7 text-white/75">
            Every booking, including drop-in lessons, requires a CFA guest or member account.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/auth/sign-up?next=%2Fprotected%2Fbook" className="rounded-full bg-white px-6 py-3 font-medium text-[#25145c] hover:bg-gray-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#ffd21c]">
              Create account
            </Link>
            <Link href="/auth/login?next=%2Fprotected%2Fbook" className="rounded-full border border-white/30 px-6 py-3 font-medium text-white hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#ffd21c]">
              Log in to book
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
