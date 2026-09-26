"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

export interface CoachProfile {
  description: string;
  name: string;
  designation: string;
  src: string;
}

interface Colors {
  name?: string;
  designation?: string;
  description?: string;
  arrowBackground?: string;
  arrowForeground?: string;
  arrowHoverBackground?: string;
}

interface FontSizes {
  name?: string;
  designation?: string;
  description?: string;
}

interface CircularCoachProfilesProps {
  profiles: CoachProfile[];
  autoplay?: boolean;
  colors?: Colors;
  fontSizes?: FontSizes;
}

function calculateGap(width: number) {
  const minWidth = 1024;
  const maxWidth = 1456;
  const minGap = 60;
  const maxGap = 86;
  if (width <= minWidth) return minGap;
  if (width >= maxWidth) {
    return Math.max(minGap, maxGap + 0.06018 * (width - maxWidth));
  }
  return (
    minGap +
    (maxGap - minGap) * ((width - minWidth) / (maxWidth - minWidth))
  );
}

export function CircularCoachProfiles({
  profiles,
  autoplay = true,
  colors = {},
  fontSizes = {},
}: CircularCoachProfilesProps) {
  const shouldReduceMotion = useReducedMotion();
  const [activeIndex, setActiveIndex] = useState(0);
  const [hoveredArrow, setHoveredArrow] = useState<"prev" | "next" | null>(
    null,
  );
  const [containerWidth, setContainerWidth] = useState(1200);
  const imageContainerRef = useRef<HTMLDivElement>(null);
  const autoplayIntervalRef = useRef<ReturnType<typeof setInterval> | null>(
    null,
  );

  const profileCount = profiles.length;
  const activeProfile = useMemo(
    () => profiles[activeIndex],
    [activeIndex, profiles],
  );

  const stopAutoplay = useCallback(() => {
    if (autoplayIntervalRef.current) {
      clearInterval(autoplayIntervalRef.current);
      autoplayIntervalRef.current = null;
    }
  }, []);

  const handleNext = useCallback(() => {
    setActiveIndex((previous) => (previous + 1) % profileCount);
    stopAutoplay();
  }, [profileCount, stopAutoplay]);

  const handlePrevious = useCallback(() => {
    setActiveIndex(
      (previous) => (previous - 1 + profileCount) % profileCount,
    );
    stopAutoplay();
  }, [profileCount, stopAutoplay]);

  useEffect(() => {
    const element = imageContainerRef.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      setContainerWidth(entry.contentRect.width);
    });
    observer.observe(element);
    setContainerWidth(element.offsetWidth);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!autoplay || shouldReduceMotion || profileCount < 2) return;
    autoplayIntervalRef.current = setInterval(() => {
      setActiveIndex((previous) => (previous + 1) % profileCount);
    }, 5000);
    return stopAutoplay;
  }, [autoplay, profileCount, shouldReduceMotion, stopAutoplay]);

  function getImageStyle(index: number): React.CSSProperties {
    const gap = calculateGap(containerWidth);
    const raisedOffset = gap * 0.8;
    const isActive = index === activeIndex;
    const isLeft =
      (activeIndex - 1 + profileCount) % profileCount === index;
    const isRight = (activeIndex + 1) % profileCount === index;
    const transition = shouldReduceMotion
      ? "none"
      : "all 0.8s cubic-bezier(.4,2,.3,1)";

    if (isActive) {
      return {
        zIndex: 3,
        opacity: 1,
        pointerEvents: "auto",
        transform: "translateX(0) translateY(0) scale(1) rotateY(0)",
        transition,
      };
    }
    if (isLeft) {
      return {
        zIndex: 2,
        opacity: 1,
        pointerEvents: "auto",
        transform: `translateX(-${gap}px) translateY(-${raisedOffset}px) scale(.85) rotateY(15deg)`,
        transition,
      };
    }
    if (isRight) {
      return {
        zIndex: 2,
        opacity: 1,
        pointerEvents: "auto",
        transform: `translateX(${gap}px) translateY(-${raisedOffset}px) scale(.85) rotateY(-15deg)`,
        transition,
      };
    }
    return {
      zIndex: 1,
      opacity: 0,
      pointerEvents: "none",
      transition,
    };
  }

  if (!activeProfile) return null;

  const arrowBackground = colors.arrowBackground ?? "#2d176b";
  const arrowForeground = colors.arrowForeground ?? "#ffffff";
  const arrowHoverBackground = colors.arrowHoverBackground ?? "#ffd21c";

  return (
    <div
      className="w-full max-w-5xl px-2 py-8 sm:px-8"
      role="region"
      aria-roledescription="carousel"
      aria-label="CFA coaching team"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === "ArrowLeft") handlePrevious();
        if (event.key === "ArrowRight") handleNext();
      }}
    >
      <div className="grid items-center gap-16 md:grid-cols-2 md:gap-20">
        <div
          ref={imageContainerRef}
          className="relative mx-auto aspect-[3/4] h-80 perspective-[1000px] sm:h-96"
        >
          {profiles.map((profile, index) => (
            // Stock images are intentionally rendered directly because these
            // external URLs are content data, not build-time image assets.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={profile.name}
              src={profile.src}
              alt=""
              aria-hidden={index !== activeIndex}
              className="absolute inset-0 h-full w-full rounded-3xl object-cover shadow-[0_24px_60px_rgba(45,23,107,.18)]"
              style={getImageStyle(index)}
            />
          ))}
          <div className="pointer-events-none absolute inset-x-8 -bottom-6 h-16 rounded-full bg-[#ffd21c]/25 blur-3xl" />
        </div>

        <div className="flex min-h-80 flex-col justify-between">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeIndex}
              initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: shouldReduceMotion ? 0 : -20 }}
              transition={{ duration: shouldReduceMotion ? 0 : 0.3 }}
              aria-live="polite"
            >
              <p className="mb-5 text-xs font-semibold uppercase tracking-[0.22em] text-[#8a6810]">
                Coach {activeIndex + 1} of {profileCount}
              </p>
              <h3
                className="mb-1 font-semibold tracking-[-0.03em]"
                style={{
                  color: colors.name ?? "#25145c",
                  fontSize: fontSizes.name ?? "1.75rem",
                }}
              >
                {activeProfile.name}
              </h3>
              <p
                className="mb-8 font-medium"
                style={{
                  color: colors.designation ?? "#755b12",
                  fontSize: fontSizes.designation ?? "1rem",
                }}
              >
                {activeProfile.designation}
              </p>
              <p
                className="leading-8"
                style={{
                  color: colors.description ?? "#4b4560",
                  fontSize: fontSizes.description ?? "1.125rem",
                }}
              >
                {activeProfile.description.split(" ").map((word, index) => (
                  <motion.span
                    key={`${word}-${index}`}
                    initial={{
                      filter: shouldReduceMotion ? "none" : "blur(8px)",
                      opacity: 0,
                      y: shouldReduceMotion ? 0 : 5,
                    }}
                    animate={{ filter: "blur(0)", opacity: 1, y: 0 }}
                    transition={{
                      duration: shouldReduceMotion ? 0 : 0.22,
                      delay: shouldReduceMotion ? 0 : 0.02 * index,
                    }}
                    className="inline-block"
                  >
                    {word}&nbsp;
                  </motion.span>
                ))}
              </p>
            </motion.div>
          </AnimatePresence>

          <div className="flex gap-4 pt-10">
            {[
              {
                direction: "prev" as const,
                label: "Previous coach",
                handler: handlePrevious,
                icon: ArrowLeft,
              },
              {
                direction: "next" as const,
                label: "Next coach",
                handler: handleNext,
                icon: ArrowRight,
              },
            ].map(({ direction, label, handler, icon: Icon }) => (
              <button
                key={direction}
                type="button"
                onClick={handler}
                onMouseEnter={() => setHoveredArrow(direction)}
                onMouseLeave={() => setHoveredArrow(null)}
                onFocus={() => setHoveredArrow(direction)}
                onBlur={() => setHoveredArrow(null)}
                aria-label={label}
                className="flex h-11 w-11 items-center justify-center rounded-full border border-[#2d176b]/10 transition-transform hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2d176b]"
                style={{
                  backgroundColor:
                    hoveredArrow === direction
                      ? arrowHoverBackground
                      : arrowBackground,
                  color:
                    hoveredArrow === direction
                      ? "#2d176b"
                      : arrowForeground,
                }}
              >
                <Icon size={20} aria-hidden="true" />
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default CircularCoachProfiles;
