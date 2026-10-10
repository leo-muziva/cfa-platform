"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { Check } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { useMediaQuery } from "@/hooks/use-media-query";
import { cn } from "@/lib/utils";

// Pricing cards adapted from the shadcn pricing block. The prices are
// already formatted by the caller, and there is no billing switch, because
// CFA sells fixed terms at database prices rather than monthly vs annual.

export interface PricingCardPlan {
  key: string;
  name: string;
  priceLabel: string;
  period?: string;
  note?: string;
  saving?: string;
  features: string[];
  buttonText: string;
  // Left out when there is nowhere to send the visitor, which hides the button.
  href?: string;
}

const FOCUS =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cfa-purple dark:focus-visible:outline-white";

export function PricingCard({ plan, className }: { plan: PricingCardPlan; className?: string }) {
  return (
    <div
      className={cn(
        "relative flex h-full flex-col rounded-2xl border border-[#140a2e]/10 bg-[#ffffff] p-6 text-center shadow-[0_10px_30px_rgba(45,23,107,0.05)] dark:border-white/10 dark:bg-white/5",
        className,
      )}
    >
      <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#8a6810] dark:text-cfa-gold">
        {plan.name}
      </p>
      <div className="mt-6 flex flex-wrap items-baseline justify-center gap-x-2">
        <span className="text-5xl font-bold tracking-tight tabular-nums text-cfa-purple dark:text-white">
          {plan.priceLabel}
        </span>
        {plan.period && (
          <span className="text-sm font-semibold leading-6 tracking-wide text-muted-foreground">
            / {plan.period}
          </span>
        )}
      </div>
      {plan.note && <p className="mt-2 text-xs leading-5 text-muted-foreground">{plan.note}</p>}
      <p
        className={cn(
          "mt-1 min-h-5 text-xs font-semibold text-green-700 dark:text-green-400",
          !plan.saving && "invisible",
        )}
      >
        {plan.saving ?? "No saving"}
      </p>

      <ul className="mt-5 flex flex-1 flex-col gap-2 text-sm">
        {plan.features.map((feature) => (
          <li key={feature} className="flex items-start gap-2">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-cfa-purple dark:text-cfa-gold" aria-hidden="true" />
            <span className="text-left">{feature}</span>
          </li>
        ))}
      </ul>

      {plan.href && (
        <>
          <hr className="my-5 w-full border-[#140a2e]/10 dark:border-white/10" />
          <Link
            href={plan.href}
            className={cn(
              buttonVariants({ variant: "outline" }),
              "min-h-11 w-full rounded-full border-[#140a2e]/20 bg-transparent text-base font-semibold text-cfa-purple shadow-none",
              "transition-all duration-300 ease-out hover:bg-cfa-purple hover:text-white hover:ring-2 hover:ring-cfa-purple hover:ring-offset-1",
              "dark:border-white/25 dark:text-white dark:hover:bg-white dark:hover:text-cfa-purple dark:hover:ring-white",
              FOCUS,
            )}
          >
            {plan.buttonText}
          </Link>
        </>
      )}
    </div>
  );
}

export function Pricing({ plans }: { plans: PricingCardPlan[] }) {
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const reduceMotion = useReducedMotion();
  const last = plans.length - 1;

  return (
    <ul className="grid gap-4 md:grid-cols-3">
      {plans.map((plan, index) => {
        // On desktop the outer cards sit slightly smaller and lean in towards
        // the middle one, as in the template.
        const outer = plans.length === 3 && (index === 0 || index === last);
        return (
          <motion.li
            key={plan.key}
            initial={reduceMotion ? false : { y: 50, opacity: 1 }}
            whileInView={
              isDesktop && outer
                ? { y: 0, opacity: 1, x: index === 0 ? 30 : -30, scale: 0.94 }
                : { y: 0, opacity: 1, x: 0, scale: 1 }
            }
            viewport={{ once: true }}
            transition={
              reduceMotion
                ? { duration: 0 }
                : { duration: 1.6, type: "spring", stiffness: 100, damping: 30, delay: 0.4, opacity: { duration: 0.5 } }
            }
            className={cn(outer ? "z-0" : "z-10", index === 0 && "origin-right", index === last && "origin-left")}
          >
            <PricingCard plan={plan} />
          </motion.li>
        );
      })}
    </ul>
  );
}
