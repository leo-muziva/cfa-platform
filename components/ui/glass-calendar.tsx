"use client";

/**
 * Frosted-glass month strip, adapted from a 21st.dev "GlassCalendar".
 * Differences from the source:
 * - Works on Cape Town date keys ("YYYY-MM-DD") instead of browser-local
 *   Dates, so a visitor in another time zone never sees a shifted day.
 * - The source's Weekly/Monthly tabs, settings, note and new-event buttons
 *   are dropped: they did nothing here and dead controls hurt accessibility.
 * - Tinted with the deep smoke purple rather than black so white text keeps
 *   contrast over the light-theme portal as well as the dark one.
 * - An optional `aside` renders beside the strip (the booking time slots).
 */

import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import {
  formatCapeTownDate,
  formatMonthKey,
  monthDateKeys,
  shiftMonthKey,
  weekdayInitial,
} from "@/lib/booking-calendar";
import { cn } from "@/lib/utils";

export interface GlassCalendarProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "onSelect"> {
  /** Selected Cape Town date key, e.g. "2026-10-03". */
  selectedDate: string;
  onDateSelect: (dateKey: string) => void;
  isDateDisabled?: (dateKey: string) => boolean;
  /** Earliest navigable month, "YYYY-MM". */
  minMonth?: string;
  /** Latest navigable month, "YYYY-MM". */
  maxMonth?: string;
  todayKey?: string;
  aside?: React.ReactNode;
  caption?: React.ReactNode;
}

export const GlassCalendar = React.forwardRef<HTMLDivElement, GlassCalendarProps>(
  (
    {
      className,
      selectedDate,
      onDateSelect,
      isDateDisabled,
      minMonth,
      maxMonth,
      todayKey,
      aside,
      caption,
      ...props
    },
    ref,
  ) => {
    const reduceMotion = useReducedMotion();
    const [monthKey, setMonthKey] = React.useState(
      () => (selectedDate || todayKey || minMonth || "").slice(0, 7),
    );
    const selectedRef = React.useRef<HTMLButtonElement>(null);
    const stripRef = React.useRef<HTMLDivElement>(null);

    // Follow the selection when it moves to another month from outside.
    React.useEffect(() => {
      if (selectedDate) setMonthKey(selectedDate.slice(0, 7));
    }, [selectedDate]);

    // Centre the selected day in the strip without scrolling the page.
    React.useEffect(() => {
      const strip = stripRef.current;
      const day = selectedRef.current;
      if (!strip || !day) return;
      strip.scrollTo({
        left: day.offsetLeft - strip.clientWidth / 2 + day.clientWidth / 2,
        behavior: reduceMotion ? "auto" : "smooth",
      });
    }, [monthKey, selectedDate, reduceMotion]);

    const days = React.useMemo(() => (monthKey ? monthDateKeys(monthKey) : []), [monthKey]);
    const { month, year } = monthKey ? formatMonthKey(monthKey) : { month: "", year: "" };
    const canGoBack = !minMonth || monthKey > minMonth;
    const canGoForward = !maxMonth || monthKey < maxMonth;

    const navButton =
      "rounded-full p-1.5 text-white/75 transition-colors hover:bg-white/15 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-cfa-gold disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent";

    return (
      <div
        ref={ref}
        className={cn(
          "flex w-full overflow-hidden rounded-3xl shadow-2xl max-sm:flex-col",
          "border border-white/10 bg-[#140a2e]/55 backdrop-blur-xl",
          "font-sans text-white",
          className,
        )}
        {...props}
      >
        <div className="min-w-0 flex-1 p-5">
          <div className="mb-6 mt-1 flex items-center justify-between gap-3">
            <motion.p
              key={monthKey}
              initial={reduceMotion ? false : { opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="text-4xl font-bold tracking-tight"
              aria-live="polite"
            >
              {month} <span className="text-lg font-medium text-white/60">{year}</span>
            </motion.p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setMonthKey(shiftMonthKey(monthKey, -1))}
                disabled={!canGoBack}
                aria-label="Previous month"
                className={navButton}
              >
                <ChevronLeft className="h-5 w-5" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => setMonthKey(shiftMonthKey(monthKey, 1))}
                disabled={!canGoForward}
                aria-label="Next month"
                className={navButton}
              >
                <ChevronRight className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
          </div>

          <div
            ref={stripRef}
            role="group"
            aria-label={`Days in ${month} ${year}`}
            className="scrollbar-hide relative -mx-5 overflow-x-auto px-5 py-1"
          >
            <div className="flex gap-4">
              {days.map((dateKey) => {
                const isSelected = dateKey === selectedDate;
                const isToday = dateKey === todayKey;
                const disabled = isDateDisabled?.(dateKey) ?? false;
                return (
                  <div key={dateKey} className="flex shrink-0 flex-col items-center gap-2">
                    <span className="text-xs font-bold text-white/60" aria-hidden="true">
                      {weekdayInitial(dateKey)}
                    </span>
                    <button
                      ref={isSelected ? selectedRef : undefined}
                      type="button"
                      onClick={() => onDateSelect(dateKey)}
                      disabled={disabled}
                      aria-pressed={isSelected}
                      aria-label={`${formatCapeTownDate(dateKey)}${isToday ? ", today" : ""}${disabled ? ", unavailable" : ""}`}
                      className={cn(
                        "relative flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold transition-all duration-200",
                        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cfa-gold",
                        isSelected
                          ? "bg-[linear-gradient(135deg,hsl(var(--cfa-purple)),hsl(262_83%_55%))] text-white shadow-lg shadow-[hsl(var(--cfa-purple)/0.5)] ring-1 ring-white/40"
                          : disabled
                            ? "cursor-not-allowed text-white/35 line-through"
                            : "text-white hover:bg-white/20",
                      )}
                    >
                      {isToday && !isSelected && (
                        <span aria-hidden="true" className="absolute bottom-1 h-1 w-1 rounded-full bg-cfa-gold" />
                      )}
                      {Number(dateKey.slice(8))}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-6 h-px bg-white/20" />
          <p className="mt-4 text-xs font-medium text-white/70">
            {caption ?? "All times in Cape Town time"}
          </p>
        </div>

        {aside && (
          <div className="relative w-full border-white/15 max-sm:h-60 max-sm:border-t sm:w-48 sm:border-s">
            {aside}
          </div>
        )}
      </div>
    );
  },
);

GlassCalendar.displayName = "GlassCalendar";
