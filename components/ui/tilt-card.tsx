"use client";

import { useCallback, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

// tiltLimit is in degrees. "evade" tilts away from the pointer, "gravitate" towards it.
export interface TiltCardProps {
  tiltLimit?: number;
  scale?: number;
  perspective?: number;
  effect?: "gravitate" | "evade";
  spotlight?: boolean;
  spotlightColor?: string;
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}

const RESTING_SPOTLIGHT = { x: 50, y: 50 };

/** A card that tilts in 3D as the pointer moves over it, with an optional spotlight. */
export function TiltCard({
  tiltLimit = 15,
  scale = 1.05,
  perspective = 1200,
  effect = "evade",
  spotlight = true,
  spotlightColor = "rgba(255,255,255,0.15)",
  className,
  style,
  children,
}: TiltCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const shouldReduceMotion = useReducedMotion();
  const restingTransform = `perspective(${perspective}px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)`;
  const [transform, setTransform] = useState(restingTransform);
  const [spotlightPos, setSpotlightPos] = useState(RESTING_SPOTLIGHT);
  const [isHovered, setIsHovered] = useState(false);
  const dir = effect === "evade" ? -1 : 1;

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      // Touch drags are scrolls, so tilting on them would warp cards mid-scroll.
      if (e.pointerType === "touch") return;
      const el = cardRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const px = (e.clientX - rect.left) / rect.width;
      const py = (e.clientY - rect.top) / rect.height;
      if (spotlight) setSpotlightPos({ x: px * 100, y: py * 100 });
      // Reduced motion keeps the static spotlight cue but never rotates or scales.
      if (shouldReduceMotion) return;
      const xRot = (py - 0.5) * (tiltLimit * 2) * dir;
      const yRot = (px - 0.5) * -(tiltLimit * 2) * dir;
      setTransform(
        `perspective(${perspective}px) rotateX(${xRot}deg) rotateY(${yRot}deg) scale3d(${scale}, ${scale}, ${scale})`,
      );
    },
    [tiltLimit, scale, perspective, dir, spotlight, shouldReduceMotion],
  );

  const handlePointerEnter = useCallback((e: React.PointerEvent) => {
    if (e.pointerType === "touch") return;
    setIsHovered(true);
  }, []);

  const handlePointerLeave = useCallback(() => {
    setTransform(restingTransform);
    setIsHovered(false);
  }, [restingTransform]);

  return (
    <div
      ref={cardRef}
      onPointerEnter={handlePointerEnter}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      className={cn("will-change-transform relative overflow-hidden", className)}
      style={{
        transform: shouldReduceMotion ? restingTransform : transform,
        // Keep the card's own border and shadow easing, which an inline
        // transition would otherwise replace.
        transition: "transform 0.2s ease-out, border-color 0.3s ease, box-shadow 0.3s ease",
        ...style,
      }}
    >
      {children}
      {spotlight && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-10 overflow-hidden"
          style={{ opacity: isHovered ? 1 : 0, transition: "opacity 0.3s" }}
        >
          <div
            className="absolute h-[200%] w-[200%] rounded-full opacity-100 dark:opacity-50"
            style={{
              left: `${spotlightPos.x}%`,
              top: `${spotlightPos.y}%`,
              transform: "translate(-50%, -50%)",
              background: `radial-gradient(circle, ${spotlightColor} 0%, transparent 40%)`,
            }}
          />
        </div>
      )}
    </div>
  );
}
