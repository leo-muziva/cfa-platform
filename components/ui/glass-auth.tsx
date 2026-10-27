"use client";

/**
 * Shared "liquid glass" auth kit used by both the sign-in and sign-up flows.
 *
 * Adapted from a reference demo component (see the CSS comment block in
 * app/globals.css for provenance). The demo's <style> blob was already
 * ported to globals.css as static classes/keyframes — this file only ever
 * *references* those classes, it never emits its own <style> tag.
 */

import { cn } from "@/lib/utils";
import Image from "next/image";
import React, {
  Children,
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { cva, type VariantProps } from "class-variance-authority";
import {
  AlertCircle,
  ArrowRight,
  Eye,
  EyeOff,
  Loader,
  PartyPopper,
  X,
} from "lucide-react";
import {
  AnimatePresence,
  motion,
  useReducedMotion,
  type Variants,
} from "framer-motion";
import type {
  GlobalOptions as ConfettiGlobalOptions,
  CreateTypes as ConfettiInstance,
  Options as ConfettiOptions,
} from "canvas-confetti";
import confetti from "canvas-confetti";

// ---------------------------------------------------------------------------
// Confetti — thin wrapper around canvas-confetti exposing an imperative
// `fire()` so the sign-up flow can trigger it only on a real success.
// ---------------------------------------------------------------------------
type ConfettiApi = { fire: (options?: ConfettiOptions) => void };
export type ConfettiRef = ConfettiApi | null;

/** A canvas that fires confetti when `ref.fire()` is called (used after sign-up). */
export const Confetti = forwardRef<
  ConfettiRef,
  React.ComponentPropsWithRef<"canvas"> & {
    options?: ConfettiOptions;
    globalOptions?: ConfettiGlobalOptions;
    manualstart?: boolean;
  }
>((props, ref) => {
  const {
    options,
    globalOptions = { resize: true, useWorker: true },
    manualstart = false,
    ...rest
  } = props;
  const instanceRef = useRef<ConfettiInstance | null>(null);

  const canvasRef = useCallback(
    (node: HTMLCanvasElement | null) => {
      if (node !== null) {
        if (instanceRef.current) return;
        instanceRef.current = confetti.create(node, {
          ...globalOptions,
          resize: true,
        });
      } else if (instanceRef.current) {
        instanceRef.current.reset();
        instanceRef.current = null;
      }
    },
    [globalOptions],
  );

  const fire = useCallback(
    (opts: ConfettiOptions = {}) => instanceRef.current?.({ ...options, ...opts }),
    [options],
  );
  const api = useMemo(() => ({ fire }), [fire]);
  useImperativeHandle(ref, () => api, [api]);

  useEffect(() => {
    if (!manualstart) fire();
  }, [manualstart, fire]);

  return <canvas ref={canvasRef} {...rest} />;
});
Confetti.displayName = "Confetti";

// ---------------------------------------------------------------------------
// TextLoop — cycles through a list of children on an interval. Used for the
// "Creating your account... / Setting up your profile..." loading copy.
// ---------------------------------------------------------------------------
export interface TextLoopProps {
  children: React.ReactNode[];
  className?: string;
  interval?: number;
  stopOnEnd?: boolean;
}

/** Cycles through its children one at a time with an animation. */
export function TextLoop({
  children,
  className,
  interval = 2,
  stopOnEnd = false,
}: TextLoopProps) {
  const reduceMotion = useReducedMotion();
  const [currentIndex, setCurrentIndex] = useState(0);
  const items = Children.toArray(children);

  useEffect(() => {
    const intervalMs = interval * 1000;
    const timer = setInterval(() => {
      setCurrentIndex((current) => {
        if (stopOnEnd && current === items.length - 1) {
          clearInterval(timer);
          return current;
        }
        return (current + 1) % items.length;
      });
    }, intervalMs);
    return () => clearInterval(timer);
  }, [items.length, interval, stopOnEnd]);

  // Reduced motion: swap text instantly instead of sliding it in/out.
  const variants: Variants = reduceMotion
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } }
    : {
        initial: { y: 20, opacity: 0 },
        animate: { y: 0, opacity: 1 },
        exit: { y: -20, opacity: 0 },
      };

  return (
    <div className={cn("relative inline-block whitespace-nowrap", className)}>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.div
          key={currentIndex}
          initial="initial"
          animate="animate"
          exit="exit"
          transition={{ duration: reduceMotion ? 0 : 0.3 }}
          variants={variants}
        >
          {items[currentIndex]}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

// ---------------------------------------------------------------------------
// BlurFade — entrance animation for step titles.
// ---------------------------------------------------------------------------
export interface BlurFadeProps {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  yOffset?: number;
  blur?: string;
}

/** Fades and unblurs its children into view. */
export function BlurFade({
  children,
  className,
  delay = 0,
  yOffset = 6,
  blur = "6px",
}: BlurFadeProps) {
  const reduceMotion = useReducedMotion();
  const variants: Variants = reduceMotion
    ? { hidden: { opacity: 0 }, visible: { opacity: 1 } }
    : {
        hidden: { y: yOffset, opacity: 0, filter: `blur(${blur})` },
        visible: { y: -yOffset, opacity: 1, filter: "blur(0px)" },
      };

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      exit="hidden"
      variants={variants}
      transition={
        reduceMotion
          ? { duration: 0 }
          : { delay: 0.04 + delay, duration: 0.4, ease: "easeOut" }
      }
      className={className}
    >
      {children}
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// GlassButton — pill button with the glass shine/shadow layers from
// globals.css. `contentClassName` lets callers tweak the inner label layout
// (e.g. icon + text rows) without fighting the outer wrap's own classes.
// ---------------------------------------------------------------------------
const glassButtonVariants = cva(
  "relative isolate all-unset cursor-pointer rounded-full transition-all disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      size: {
        default: "text-base font-medium",
        sm: "text-sm font-medium",
        lg: "text-lg font-medium",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: { size: "default" },
  },
);
const glassButtonTextVariants = cva(
  "glass-button-text relative block select-none tracking-tighter",
  {
    variants: {
      size: {
        default: "px-6 py-3.5",
        sm: "px-4 py-2",
        lg: "px-8 py-4",
        icon: "flex h-10 w-10 items-center justify-center",
      },
    },
    defaultVariants: { size: "default" },
  },
);

export interface GlassButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof glassButtonVariants> {
  contentClassName?: string;
}

/** The frosted-glass button used on the login and sign-up pages. */
export const GlassButton = React.forwardRef<HTMLButtonElement, GlassButtonProps>(
  ({ className, children, size, contentClassName, onClick, ...props }, ref) => {
    // The glass shell extends the button's hit area (e.g. the shadow layer's
    // own padding). Only forward clicks that land outside the real <button>
    // — the reference demo's `e.target !== button` check double-fires for
    // clicks on the button's own children (span/svg), since those already
    // bubble through the button natively before reaching this handler.
    const handleWrapperClick = (e: React.MouseEvent<HTMLDivElement>) => {
      const button = e.currentTarget.querySelector("button");
      if (button && !button.contains(e.target as Node)) button.click();
    };
    return (
      <div
        className={cn("glass-button-wrap cursor-pointer rounded-full relative", className)}
        onClick={handleWrapperClick}
      >
        <button
          ref={ref}
          className={cn("glass-button relative z-10", glassButtonVariants({ size }))}
          onClick={onClick}
          {...props}
        >
          <span className={cn(glassButtonTextVariants({ size }), contentClassName)}>
            {children}
          </span>
        </button>
        <div className="glass-button-shadow rounded-full pointer-events-none" />
      </div>
    );
  },
);
GlassButton.displayName = "GlassButton";

// ---------------------------------------------------------------------------
// GoogleIcon
// ---------------------------------------------------------------------------
export const GoogleIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg {...props} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" className={cn("w-6 h-6", props.className)}>
    <g fillRule="evenodd" fill="none">
      <g fillRule="nonzero" transform="translate(3, 2)">
        <path
          fill="#4285F4"
          d="M57.8123233,30.1515267 C57.8123233,27.7263183 57.6155321,25.9565533 57.1896408,24.1212666 L29.4960833,24.1212666 L29.4960833,35.0674653 L45.7515771,35.0674653 C45.4239683,37.7877475 43.6542033,41.8844383 39.7213169,44.6372555 L39.6661883,45.0037254 L48.4223791,51.7870338 L49.0290201,51.8475849 C54.6004021,46.7020943 57.8123233,39.1313952 57.8123233,30.1515267"
        />
        <path
          fill="#34A853"
          d="M29.4960833,58.9921667 C37.4599129,58.9921667 44.1456164,56.3701671 49.0290201,51.8475849 L39.7213169,44.6372555 C37.2305867,46.3742596 33.887622,47.5868638 29.4960833,47.5868638 C21.6960582,47.5868638 15.0758763,42.4415991 12.7159637,35.3297782 L12.3700541,35.3591501 L3.26524241,42.4054492 L3.14617358,42.736447 C7.9965904,52.3717589 17.959737,58.9921667 29.4960833,58.9921667"
        />
        <path
          fill="#FBBC05"
          d="M12.7159637,35.3297782 C12.0932812,33.4944915 11.7329116,31.5279353 11.7329116,29.4960833 C11.7329116,27.4640054 12.0932812,25.4976752 12.6832029,23.6623884 L12.6667095,23.2715173 L3.44779955,16.1120237 L3.14617358,16.2554937 C1.14708246,20.2539019 0,24.7439491 0,29.4960833 C0,34.2482175 1.14708246,38.7380388 3.14617358,42.736447 L12.7159637,35.3297782"
        />
        <path
          fill="#EB4335"
          d="M29.4960833,11.4050769 C35.0347044,11.4050769 38.7707997,13.7975244 40.9011602,15.7968415 L49.2255853,7.66898166 C44.1130815,2.91684746 37.4599129,0 29.4960833,0 C17.959737,0 7.9965904,6.62018183 3.14617358,16.2554937 L12.6832029,23.6623884 C15.0758763,16.5505675 21.6960582,11.4050769 29.4960833,11.4050769"
        />
      </g>
    </g>
  </svg>
);

// ---------------------------------------------------------------------------
// GradientBackground — animated blurred blobs in CFA purple/gold. Colours
// are CFA brand tokens (see globals.css) rather than the demo's neutral
// theme vars; float keyframes are the ones already ported to globals.css.
// ---------------------------------------------------------------------------
export const GradientBackground = () => (
  <svg
    width="100%"
    height="100%"
    viewBox="0 0 800 600"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    preserveAspectRatio="xMidYMid slice"
    className="absolute top-0 left-0 w-full h-full"
    aria-hidden="true"
  >
    <defs>
      <linearGradient id="cfa_grad1" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" style={{ stopColor: "hsl(var(--cfa-purple))", stopOpacity: 0.85 }} />
        <stop offset="100%" style={{ stopColor: "hsl(var(--cfa-purple))", stopOpacity: 0.5 }} />
      </linearGradient>
      <linearGradient id="cfa_grad2" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" style={{ stopColor: "hsl(var(--cfa-gold))", stopOpacity: 0.55 }} />
        <stop offset="50%" style={{ stopColor: "hsl(var(--cfa-purple))", stopOpacity: 0.5 }} />
        <stop offset="100%" style={{ stopColor: "hsl(var(--cfa-purple))", stopOpacity: 0.35 }} />
      </linearGradient>
      <radialGradient id="cfa_grad3" cx="50%" cy="50%" r="50%">
        <stop offset="0%" style={{ stopColor: "hsl(var(--cfa-gold))", stopOpacity: 0.6 }} />
        <stop offset="100%" style={{ stopColor: "hsl(var(--cfa-gold))", stopOpacity: 0.15 }} />
      </radialGradient>
      <filter id="cfa_blur1" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="35" />
      </filter>
      <filter id="cfa_blur2" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="25" />
      </filter>
      <filter id="cfa_blur3" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="45" />
      </filter>
    </defs>
    <g style={{ animation: "cfa-float-1 20s ease-in-out infinite" }}>
      <ellipse cx="200" cy="500" rx="250" ry="180" fill="url(#cfa_grad1)" filter="url(#cfa_blur1)" transform="rotate(-30 200 500)" />
      <rect x="500" y="100" width="300" height="250" rx="80" fill="url(#cfa_grad2)" filter="url(#cfa_blur2)" transform="rotate(15 650 225)" />
    </g>
    <g style={{ animation: "cfa-float-2 25s ease-in-out infinite" }}>
      <circle cx="650" cy="450" r="150" fill="url(#cfa_grad3)" filter="url(#cfa_blur3)" opacity="0.7" />
      <ellipse cx="50" cy="150" rx="180" ry="120" fill="hsl(var(--cfa-purple) / 0.55)" filter="url(#cfa_blur2)" opacity="0.8" />
    </g>
  </svg>
);

// ---------------------------------------------------------------------------
// GlassAuthShell — full-viewport layout shared by the sign-in and sign-up
// pages: animated backdrop, fixed brand chip, centered content slot.
// ---------------------------------------------------------------------------
export function GlassAuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-[calc(100svh-var(--site-nav-height))] w-full flex flex-col bg-background relative overflow-hidden">
      <div className="absolute inset-0 z-0">
        <GradientBackground />
      </div>

      {/* The crest sits in the flow above the form. A fixed chip used to hide
          under the sticky main bar. */}
      <div className="relative z-10 flex flex-1 flex-col items-center justify-center gap-6 p-6">
        <Image
          src="/media/brand/cfa-crest.png"
          alt="Cape Fencing Academy"
          width={72}
          height={72}
          priority
          className="h-[72px] w-[72px] rounded-full object-cover"
        />
        {children}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// GlassField — one glass input row: collapsing leading icon (or, for
// password fields, a show/hide toggle once there's something to reveal), a
// floating label, and a trailing arrow button that appears once the field
// is valid.
// ---------------------------------------------------------------------------
export interface GlassFieldProps {
  id: string;
  label: string;
  type?: "text" | "email" | "password";
  value: string;
  onChange: (value: string) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  autoComplete?: string;
  leadingIcon: React.ReactNode;
  isValid: boolean;
  /** Omit when the field's trailing button should submit the form instead. */
  onAdvance?: () => void;
  advanceType?: "button" | "submit";
  advanceAriaLabel: string;
  inputRef?: React.RefObject<HTMLInputElement | null>;
  ariaLabel?: string;
}

/** A labelled frosted-glass input for the login and sign-up forms. */
export function GlassField({
  id,
  label,
  type = "text",
  value,
  onChange,
  onKeyDown,
  autoComplete,
  leadingIcon,
  isValid,
  onAdvance,
  advanceType = "button",
  advanceAriaLabel,
  inputRef,
  ariaLabel,
}: GlassFieldProps) {
  const [showPassword, setShowPassword] = useState(false);
  const isPassword = type === "password";
  const filled = value.length > 0;
  const inputType = isPassword && showPassword ? "text" : type;

  return (
    <div className="w-full">
      {/* Floating label: invisible until there's content, then it takes over
          from the placeholder — a simpler, layout-stable stand-in for the
          reference component's absolutely-positioned floating label. */}
      <span
        aria-hidden="true"
        className={cn(
          "mb-1 block h-4 pl-4 text-xs font-medium text-muted-foreground transition-opacity duration-300",
          filled ? "opacity-100" : "opacity-0",
        )}
      >
        {label}
      </span>

      <div className="glass-input-wrap w-full">
        <div className="glass-input">
          <motion.div
            className="flex h-9 w-9 flex-shrink-0 items-center justify-center overflow-hidden text-muted-foreground"
            initial={false}
            animate={{
              width: filled && !isPassword ? 0 : 36,
              opacity: filled && !isPassword ? 0 : 1,
            }}
            transition={{ duration: 0.3, ease: [0.25, 1, 0.5, 1] }}
          >
            {isPassword && filled ? (
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                className="flex h-9 w-9 items-center justify-center text-muted-foreground hover:text-foreground"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            ) : (
              leadingIcon
            )}
          </motion.div>

          <div className="glass-input-text-area" />

          <input
            id={id}
            name={id}
            ref={inputRef}
            type={inputType}
            value={value}
            placeholder={label}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={onKeyDown}
            autoComplete={autoComplete}
            aria-label={ariaLabel ?? label}
            // No all-unset here: it is unlayered CSS, so it beat flex-1 and the
            // input shrank, leaving the arrow in the middle of the field.
            className="min-w-0 flex-1 appearance-none border-0 bg-transparent p-0 py-2 text-base text-foreground outline-none placeholder:text-muted-foreground/70"
          />

          <AnimatePresence>
            {isValid && (
              <motion.div
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0, opacity: 0 }}
                transition={{ duration: 0.25, ease: [0.25, 1, 0.5, 1] }}
                className="flex-shrink-0"
              >
                <GlassButton
                  type={advanceType}
                  size="icon"
                  onClick={onAdvance}
                  aria-label={advanceAriaLabel}
                >
                  <ArrowRight className="h-4 w-4" />
                </GlassButton>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// AuthModal — the loading / error / success overlay shared by both flows,
// so neither sign-in nor sign-up re-implements dialog semantics.
// ---------------------------------------------------------------------------
export type AuthModalState =
  | { status: "idle" }
  | { status: "loading"; messages: string[] }
  | { status: "error"; message: string }
  | {
      status: "success";
      title: string;
      message: string;
      actionLabel: string;
      onAction: () => void;
    };

/** Loading, error and success popup for the login and sign-up flows. */
export function AuthModal({
  state,
  onClose,
}: {
  state: AuthModalState;
  onClose: () => void;
}) {
  const reduceMotion = useReducedMotion();

  // Loading is not dismissible — there's a real request in flight. Error and
  // success can be closed with Escape or the X button.
  useEffect(() => {
    if (state.status !== "error" && state.status !== "success") return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [state.status, onClose]);

  const dialogLabel =
    state.status === "loading" ? "Please wait" : state.status === "error" ? "Error" : "Success";

  return (
    <AnimatePresence>
      {state.status !== "idle" && (
        <motion.div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-background/70 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label={dialogLabel}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduceMotion ? 0 : 0.2 }}
        >
          <motion.div
            className="glass-input relative w-full max-w-sm flex-col rounded-3xl p-8 text-center"
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: reduceMotion ? 0 : 0.25, ease: [0.25, 1, 0.5, 1] }}
          >
            {(state.status === "error" || state.status === "success") && (
              <button
                type="button"
                onClick={onClose}
                aria-label="Close dialog"
                className="absolute right-4 top-4 text-muted-foreground hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            )}

            {state.status === "loading" && (
              <>
                <Loader
                  className="mx-auto h-10 w-10 animate-spin text-[hsl(var(--cfa-purple))]"
                  aria-hidden="true"
                />
                <TextLoop className="mt-4 block text-lg font-medium text-foreground" interval={1.5} stopOnEnd>
                  {state.messages.map((message) => (
                    <span key={message}>{message}</span>
                  ))}
                </TextLoop>
              </>
            )}

            {state.status === "error" && (
              <>
                <AlertCircle className="mx-auto h-10 w-10 text-destructive" aria-hidden="true" />
                <h2 className="mt-4 text-xl font-semibold text-foreground">Something went wrong</h2>
                <p className="mt-2 text-sm text-muted-foreground">{state.message}</p>
                <GlassButton type="button" className="mt-6" onClick={onClose}>
                  Try Again
                </GlassButton>
              </>
            )}

            {state.status === "success" && (
              <>
                <PartyPopper
                  className="mx-auto h-10 w-10 text-[hsl(var(--cfa-gold))]"
                  aria-hidden="true"
                />
                <h2 className="mt-4 text-xl font-semibold text-foreground">{state.title}</h2>
                <p className="mt-2 text-sm text-muted-foreground">{state.message}</p>
                <GlassButton type="button" className="mt-6" onClick={state.onAction}>
                  {state.actionLabel}
                </GlassButton>
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
