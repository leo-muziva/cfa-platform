"use client";

/**
 * Generic themed popup, built on the same mechanics as AuthModal in
 * glass-auth.tsx (framer-motion overlay, .glass-input panel, manual
 * Escape-to-close) but with arbitrary children instead of a fixed
 * loading/error/success state — used for the lesson-operations "preview
 * affected lessons" popups and the booking "slot no longer available"
 * popup. AuthModal itself is untouched; this is a separate component.
 *
 * .glass-input (app/globals.css) is already theme-aware — every color is
 * hsl(var(--background)/…) / hsl(var(--foreground)/…) — unlike the
 * hardcoded-white .liquid-glass class used only by the cinematic hero.
 */

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { motion, useReducedMotion } from "framer-motion";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface GlassDialogProps {
  open: boolean;
  onClose: () => void;
  /** id of an internal heading to label the dialog with. Preferred over `label`. */
  labelledBy?: string;
  /** Fallback accessible name when the dialog has no internal heading id. */
  label?: string;
  /** Extra classes for the glass panel, e.g. a wider max-width for a list. */
  className?: string;
  children: React.ReactNode;
}

export function GlassDialog({ open, onClose, labelledBy, label, className, children }: GlassDialogProps) {
  const reduceMotion = useReducedMotion();
  const panelRef = useRef<HTMLDivElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  // Escape closes the dialog. Deliberately no backdrop-click-to-close — this
  // matches the one existing modal in the app (AuthModal), so a stray click
  // outside the panel never loses a bookings preview or an unavailable-slot
  // message the user is in the middle of reading.
  useEffect(() => {
    if (!open) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  // No Radix Dialog in this project, so focus management is manual: move
  // focus into the panel on open, and hand it back to whatever triggered the
  // dialog once it closes.
  useEffect(() => {
    if (open) {
      previouslyFocusedRef.current = document.activeElement as HTMLElement | null;
      panelRef.current?.focus();
    } else {
      previouslyFocusedRef.current?.focus();
    }
  }, [open]);

  // Rendered into <body>: the portal's glass card uses backdrop-filter, which
  // makes "fixed" relative to the card instead of the screen.
  if (!open || typeof document === "undefined") return null;
  return createPortal(
    <motion.div
      className="fixed inset-0 z-[100] flex overflow-y-auto bg-background/70 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={labelledBy ? undefined : label}
      aria-labelledby={labelledBy}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: reduceMotion ? 0 : 0.2 }}
    >
      <motion.div
        ref={panelRef}
        tabIndex={-1}
        className={cn(
          // m-auto centres it, and lets a tall dialog scroll instead of being cut off
          "glass-input glass-dialog-panel relative m-auto w-full max-w-sm flex-col rounded-3xl p-8 outline-none",
          className,
        )}
        initial={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: reduceMotion ? 0 : 0.25, ease: [0.25, 1, 0.5, 1] }}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close dialog"
          className="absolute right-4 top-4 text-muted-foreground hover:text-foreground"
        >
          <X className="h-5 w-5" aria-hidden="true" />
        </button>
        {children}
      </motion.div>
    </motion.div>,
    document.body,
  );
}
