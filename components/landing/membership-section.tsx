"use client";

import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";

const PERKS = [
  "Club facility access",
  "Group training & sparring",
  "Competition representation & coaching",
] as const;

const PLANS = [
  { name: "Month-to-month", price: "R550", period: "/month", note: null },
  { name: "6-month", price: "R3,050", period: "", note: "Save 7.5%" },
  { name: "12-month", price: "R6,000", period: "", note: "Save 10%" },
] as const;

export function MembershipSection() {
  const shouldReduceMotion = useReducedMotion();

  return (
    <section
      id="membership"
      className="relative bg-white text-[#25145c] px-4 sm:px-6 md:px-12 py-20 md:py-28"
    >
      <div className="max-w-6xl mx-auto">
        <p className="text-sm font-semibold uppercase tracking-widest text-[#8a6810] mb-3">
          Membership
        </p>
        <h2 className="text-3xl md:text-5xl font-normal tracking-[-0.04em] mb-4">
          Choose how you fence.
        </h2>

        {/* TODO: pricing pending sponsor confirmation (SPONSOR-QUESTIONS #7) */}
        <div className="grid md:grid-cols-3 gap-6 mt-12 md:mt-16">
          {PLANS.map((plan, index) => (
            <motion.div
              key={plan.name}
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
              className="cfa-light-card rounded-2xl p-6 flex flex-col"
            >
              <h3 className="text-lg font-medium mb-1">{plan.name}</h3>
              <div className="flex items-baseline gap-1 mb-1">
                <span className="text-3xl font-normal tracking-[-0.03em]">
                  {plan.price}
                </span>
                {plan.period && (
                  <span className="text-[#625b73]">{plan.period}</span>
                )}
              </div>
              {plan.note && (
                <p className="text-[#8a6810] text-sm mb-4">{plan.note}</p>
              )}
              <ul className="mt-4 space-y-2">
                {PERKS.map((perk) => (
                  <li key={perk} className="flex items-start gap-2 text-[#625b73]">
                    <Check size={16} className="mt-1 shrink-0 text-[#8a6810]" aria-hidden="true" />
                    <span>{perk}</span>
                  </li>
                ))}
              </ul>
            </motion.div>
          ))}
        </div>

        <p className="text-[#625b73] text-sm mt-8">
          + R350 once-off joining fee · Individual lessons from R300 ·
          Beginner package (4 lessons) R1,000.
        </p>

        <div className="mt-10">
          <Link
            href="/auth/sign-up"
            className="bg-[#2d176b] text-white rounded-full font-medium px-6 sm:px-8 py-2.5 sm:py-3 hover:bg-[#3c2186] transition-colors inline-flex items-center gap-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#ffd21c] focus-visible:outline-offset-2"
          >
            Join the Academy
            <ArrowRight size={18} aria-hidden="true" />
          </Link>
        </div>
      </div>
    </section>
  );
}
