"use client";

import Link from "next/link";
import { Check, Star } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";
import type { PublicPricingPlan } from "@/lib/services/public-membership-service";

export interface PricingProps {
  plans: PublicPricingPlan[];
  className?: string;
}

const MEMBERSHIP_PERKS = [
  "Club facility access",
  "Group training and sparring",
  "Competition representation and coaching",
];

function formatRand(amount: number): string {
  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency: "ZAR",
    maximumFractionDigits: 2,
  }).format(amount);
}

function PricingCard({ plan, position, reducedMotion }: {
  plan: PublicPricingPlan;
  position: "outer-left" | "inner-left" | "inner-right" | "outer-right";
  reducedMotion: boolean | null;
}) {
  const featured = position === "inner-left" || position === "inner-right";
  const beginner = plan.code === "beginner_package";

  return (
    <motion.div
      initial={reducedMotion ? false : { opacity: 0 }}
      whileInView={{ opacity: 1 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: reducedMotion ? 0 : 0.55 }}
      className={cn(
        "relative h-full min-w-0 [transform-style:preserve-3d]",
        position === "outer-left" && "lg:z-0 lg:origin-right lg:translate-x-5 lg:rotate-[-2deg] lg:scale-[0.93]",
        position === "inner-left" && "lg:z-20 lg:-translate-y-5 lg:translate-x-2 lg:scale-[1.04]",
        position === "inner-right" && "lg:z-20 lg:-translate-y-5 lg:-translate-x-2 lg:scale-[1.04]",
        position === "outer-right" && "lg:z-0 lg:origin-left lg:-translate-x-5 lg:rotate-[2deg] lg:scale-[0.93]",
      )}
    >
      <div className={cn(
        "pointer-events-none absolute inset-3 rounded-3xl bg-cfa-purple/15 blur-xl",
        featured && "bg-cfa-gold/25 blur-2xl",
      )} aria-hidden="true" />
      <article className={cn(
        "cfa-light-card relative flex h-full min-h-[440px] flex-col rounded-3xl p-6 text-primary shadow-[0_25px_65px_rgba(45,23,107,0.14)] sm:p-7",
        featured && "border-2 border-cfa-gold shadow-[0_35px_80px_rgba(45,23,107,0.24)]",
      )}>
        {featured && (
          <span className="absolute right-0 top-0 inline-flex items-center gap-1 rounded-bl-xl rounded-tr-2xl bg-cfa-purple px-3 py-1.5 text-xs font-semibold text-white">
            <Star size={14} aria-hidden="true" /> {plan.name} option
          </span>
        )}
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#8a6810] dark:text-cfa-gold">{beginner ? "Start fencing" : "CFA membership"}</p>
        <h3 className="mt-3 text-xl font-semibold">{plan.name}</h3>
        <div className="mt-7 flex items-baseline gap-2 border-b border-border/70 pb-5">
          <span className="text-3xl font-semibold tracking-tight tabular-nums xl:text-4xl">
            {plan.price === null ? "Ask CFA" : formatRand(plan.price)}
          </span>
          <span className="text-xs text-muted-foreground">{plan.code === "month_to_month" ? "/ month" : beginner ? "/ package" : "/ term"}</span>
        </div>
        <p className="mt-4 min-h-5 text-sm font-medium text-[#8a6810] dark:text-cfa-gold">
          {plan.discountNote ?? (beginner ? "Four introductory lessons" : plan.code === "six_month" ? "Six months paid upfront" : plan.code === "twelve_month" ? "Twelve months paid upfront" : "Train month to month")}
        </p>
        <p className="mt-4 text-sm text-muted-foreground">{plan.description ?? (beginner ? "Start your fencing journey with CFA." : "Train and grow with CFA.")}</p>
        <ul className="mt-6 flex flex-1 flex-col gap-3">
          {(beginner ? ["Four individual beginner lessons", "An introduction to CFA fencing"] : MEMBERSHIP_PERKS).map((feature) => (
            <li key={feature} className="flex items-start gap-2 text-sm text-muted-foreground">
              <Check size={16} className="mt-0.5 shrink-0 text-[#8a6810] dark:text-cfa-gold" aria-hidden="true" />
              <span>{feature}</span>
            </li>
          ))}
        </ul>
        <Link
          href="/auth/sign-up"
          className={cn(
            "mt-8 inline-flex min-h-11 items-center justify-center rounded-full border px-5 py-2 font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cfa-gold",
            featured ? "border-cfa-purple bg-cfa-purple text-white hover:bg-cfa-purple/90" : "border-cfa-purple/25 bg-background text-cfa-purple hover:border-cfa-purple hover:bg-cfa-purple/10",
          )}
        >
          {beginner ? "Get started" : "Join the Academy"}
        </Link>
      </article>
    </motion.div>
  );
}

export function Pricing({ plans, className }: PricingProps) {
  const shouldReduceMotion = useReducedMotion();
  const displayPlans = ["month_to_month", "six_month", "twelve_month", "beginner_package"]
    .map((code) => plans.find((plan) => plan.code === code))
    .filter((plan): plan is PublicPricingPlan => Boolean(plan));

  return (
    <div className={cn("grid gap-6 overflow-visible pb-2 md:grid-cols-2 lg:grid-cols-4 lg:gap-0 lg:pt-5 lg:pb-0 [perspective:1200px]", className)}>
      {displayPlans.map((plan, index) => (
        <PricingCard
          key={plan.code}
          plan={plan}
          position={(["outer-left", "inner-left", "inner-right", "outer-right"] as const)[index]}
          reducedMotion={shouldReduceMotion}
        />
      ))}
    </div>
  );
}
