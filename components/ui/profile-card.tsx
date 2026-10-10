"use client";

import Image from "next/image";
import Link from "next/link";
import { motion, useReducedMotion, type Variants } from "framer-motion";
import type { ReactNode } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ProfileCardStat {
  /** A rendered icon, so server pages can pass it to this client card. */
  icon: ReactNode;
  label: string;
  value?: string;
}

export interface ProfileCardProps {
  name: string;
  description?: string;
  image: string;
  imagePosition?: string;
  imageSizes?: string;
  /** Small check beside the name, used for "taking bookings". */
  isVerified?: boolean;
  verifiedLabel?: string;
  stats?: ProfileCardStat[];
  actionHref: string;
  actionLabel: string;
  actionAriaLabel?: string;
  /** Mutes the action when there is nothing to book right now. */
  isMuted?: boolean;
  enableAnimations?: boolean;
  className?: string;
}

const spring = { type: "spring", stiffness: 400, damping: 28, mass: 0.6 } as const;

const containerVariants: Variants = {
  rest: { scale: 1, y: 0 },
  hover: { scale: 1.02, y: -4, transition: spring },
};

const imageVariants: Variants = {
  rest: { scale: 1 },
  hover: { scale: 1.05 },
};

const contentVariants: Variants = {
  hidden: { opacity: 0, y: 20, filter: "blur(4px)" },
  visible: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { ...spring, staggerChildren: 0.08, delayChildren: 0.1 },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 15, scale: 0.95, filter: "blur(2px)" },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    filter: "blur(0px)",
    transition: { type: "spring", stiffness: 400, damping: 25, mass: 0.5 },
  },
};

const letterVariants: Variants = {
  hidden: { opacity: 0, scale: 0.8 },
  visible: { opacity: 1, scale: 1, transition: { type: "spring", damping: 8, stiffness: 200, mass: 0.8 } },
};

/**
 * Full-bleed portrait card. The photo fades into the theme background so the
 * details read in both light and dark mode, and the action uses the primary colour.
 */
export function ProfileCard({
  name,
  description,
  image,
  imagePosition = "center",
  imageSizes = "(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 33vw",
  isVerified = false,
  verifiedLabel = "Verified",
  stats = [],
  actionHref,
  actionLabel,
  actionAriaLabel,
  isMuted = false,
  enableAnimations = true,
  className,
}: ProfileCardProps) {
  const shouldReduceMotion = useReducedMotion();
  const shouldAnimate = enableAnimations && !shouldReduceMotion;

  return (
    <motion.article
      data-slot="profile-card"
      initial="rest"
      whileHover={shouldAnimate ? "hover" : undefined}
      variants={containerVariants}
      // "dark" scopes the dark theme tokens to the card, so it stays black with
      // white text in both site themes and the text stays readable on photos.
      className={cn(
        "dark group relative isolate aspect-[4/5] w-full overflow-hidden rounded-3xl border border-border/40 bg-card text-card-foreground",
        "shadow-xl shadow-black/5 dark:shadow-black/30",
        className
      )}
    >
      <motion.div
        className="absolute inset-0 -z-10"
        variants={shouldAnimate ? imageVariants : undefined}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
      >
        <Image src={image} alt="" fill sizes={imageSizes} className="object-cover" style={{ objectPosition: imagePosition }} />
      </motion.div>

      {/* Layered fades into the theme background so the text stays readable. */}
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-[linear-gradient(to_top,hsl(var(--background)/0.9)_0%,hsl(var(--background)/0.35)_20%,transparent_42%)]"
      />
      <div
        aria-hidden="true"
        className="absolute inset-x-0 bottom-0 -z-10 h-1/3 bg-[linear-gradient(to_top,hsl(var(--background)/0.8)_0%,hsl(var(--background)/0.3)_50%,transparent_100%)]"
      />
      <div
        aria-hidden="true"
        className="absolute inset-x-0 bottom-0 -z-10 h-1/5 bg-[linear-gradient(to_top,hsl(var(--background)/0.6)_0%,transparent_100%)] backdrop-blur-[2px] [mask-image:linear-gradient(to_top,black_40%,transparent)]"
      />

      <motion.div
        variants={contentVariants}
        initial={shouldAnimate ? "hidden" : false}
        animate="visible"
        className="absolute inset-x-0 bottom-0 space-y-3 p-6"
      >
        <motion.div variants={itemVariants} className="flex items-center gap-2">
          <motion.h2
            aria-label={name}
            className="text-2xl font-semibold leading-tight tracking-tight text-cfa-purple dark:text-white"
            variants={{ visible: { transition: { staggerChildren: 0.02 } } }}
          >
            {/* Letters animate inside whole words so long names wrap between words. */}
            {name.split(" ").map((word, wordIndex) => (
              <span key={wordIndex} aria-hidden="true" className="inline-block whitespace-nowrap">
                {word.split("").map((letter, index) => (
                  <motion.span key={index} variants={letterVariants} className="inline-block">
                    {letter}
                  </motion.span>
                ))}
                {wordIndex < name.split(" ").length - 1 && " "}
              </span>
            ))}
          </motion.h2>
          {isVerified && (
            <motion.span
              variants={itemVariants}
              title={verifiedLabel}
              className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground"
            >
              <Check className="h-2.5 w-2.5" aria-hidden="true" />
              <span className="sr-only">{verifiedLabel}</span>
            </motion.span>
          )}
        </motion.div>

        {description && (
          <motion.p variants={itemVariants} className="text-sm leading-relaxed text-muted-foreground">
            {description}
          </motion.p>
        )}

        {stats.length > 0 && (
          <motion.ul variants={itemVariants} className="flex flex-wrap items-center gap-x-5 gap-y-2 pt-1">
            {stats.map(({ icon, label, value }) => (
              <li key={label} className="flex items-center gap-2 text-muted-foreground [&_svg]:h-4 [&_svg]:w-4 [&_svg]:shrink-0">
                {icon}
                {value && <span className="font-semibold text-foreground">{value}</span>}
                <span className="text-sm">{label}</span>
              </li>
            ))}
          </motion.ul>
        )}

        <motion.div
          variants={itemVariants}
          whileHover={shouldAnimate ? { scale: 1.02, transition: { type: "spring", stiffness: 400, damping: 25 } } : undefined}
          whileTap={shouldAnimate ? { scale: 0.98 } : undefined}
          className="pt-1"
        >
          <Link
            href={actionHref}
            aria-label={actionAriaLabel}
            className={cn(
              "block w-full transform-gpu rounded-2xl border border-border/20 px-4 py-3 text-center text-sm font-semibold shadow-sm transition-colors duration-200",
              "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
              isMuted
                ? "bg-muted text-muted-foreground hover:bg-muted/80"
                : "bg-primary text-primary-foreground hover:bg-primary/90"
            )}
          >
            {actionLabel}
          </Link>
        </motion.div>
      </motion.div>
    </motion.article>
  );
}
