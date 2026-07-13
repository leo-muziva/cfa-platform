"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Clock,
  Menu,
  MapPin,
  Star,
  X,
} from "lucide-react";

// In-page anchors to the landing sections rendered below the hero
// (app/page.tsx). Hash-only hrefs use plain <a> — no router needed.
const NAV_LINKS = [
  { label: "Membership", href: "#membership" },
  { label: "Lessons", href: "#about" },
  { label: "Schedule", href: "#schedule" },
  { label: "FAQ", href: "#faq" },
  { label: "Contact", href: "#contact" },
] as const;

// Scrollspy mapping: which landing-section id (rendered below the hero in
// app/page.tsx) lights up which nav link. Sections without a dedicated link
// (e.g. "coaches") fall back to the closest related link ("Lessons").
const SECTION_TO_NAV = [
  { section: "about", nav: "#about" },
  { section: "coaches", nav: "#about" }, // no Coaches link — "Lessons" stays lit
  { section: "schedule", nav: "#schedule" },
  { section: "membership", nav: "#membership" },
  { section: "faq", nav: "#faq" },
  { section: "contact", nav: "#contact" },
] as const;

// Rotating hero copy — one weapon/theme per slide. Kept as plain data so the
// slide content and its staggered entrance animation stay in sync via `key`.
const SLIDES = [
  {
    meta: "Est. 1997 — SA's Premier Fencing Club",
    title: "The Art of the Blade.",
    description:
      "Foil, épée and sabre coaching in Cape Town — from your first lunge to the national podium.",
  },
  {
    meta: "Foil — precision & timing",
    title: "Touch First. Think Faster.",
    description:
      "The duelling chess match: master point control, tempo and right-of-way.",
  },
  {
    meta: "Épée & Sabre — power & speed",
    title: "Every Inch Is a Target.",
    description:
      "From patient épée duels to explosive sabre exchanges — find your weapon.",
  },
] as const;

// Shared focus ring so every interactive element stays keyboard-visible
// against the dark, video-heavy background (WCAG 2.1 AA).
const FOCUS_RING =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-white/70";

export function CinematicHero({ authSlot }: { authSlot: React.ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [slideIndex, setSlideIndex] = useState(0);
  // hoveredHref wins over activeHref so the capsule follows the cursor;
  // once the pointer leaves, it snaps back to whatever section is in view.
  const [hoveredHref, setHoveredHref] = useState<string | null>(null);
  const [activeHref, setActiveHref] = useState<string | null>(null);
  const prefersReducedMotion = useReducedMotion();
  const indicated = hoveredHref ?? activeHref;

  const goToPrevSlide = () =>
    setSlideIndex((current) => (current - 1 + SLIDES.length) % SLIDES.length);
  const goToNextSlide = () =>
    setSlideIndex((current) => (current + 1) % SLIDES.length);

  const slide = SLIDES[slideIndex];

  // Scrollspy: lights up the nav link for whichever landing section is
  // currently occupying the "reading zone" of the viewport. rAF-throttled
  // so rapid scroll/resize events don't spam setState.
  useEffect(() => {
    let rafId: number | null = null;

    const computeActiveSection = () => {
      rafId = null;
      // A section "counts" once its top has scrolled past 40% of the
      // viewport height — that's roughly where a reader's eye lands, so
      // the nav reflects the section actually being read, not merely
      // peeking in at the bottom edge. Last matching entry wins (deepest
      // section that has passed the threshold).
      const threshold = window.innerHeight * 0.4;
      let current: string | null = null;
      for (const { section, nav } of SECTION_TO_NAV) {
        const el = document.getElementById(section);
        if (el && el.getBoundingClientRect().top <= threshold) {
          current = nav;
        }
      }
      setActiveHref(current);
    };

    const onScrollOrResize = () => {
      if (rafId === null) {
        rafId = requestAnimationFrame(computeActiveSection);
      }
    };

    computeActiveSection();
    window.addEventListener("scroll", onScrollOrResize, { passive: true });
    window.addEventListener("resize", onScrollOrResize, { passive: true });

    return () => {
      window.removeEventListener("scroll", onScrollOrResize);
      window.removeEventListener("resize", onScrollOrResize);
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, []);

  return (
    <div className="relative h-dvh bg-black text-white flex flex-col overflow-hidden">
      {/* Background video (z-0) — absolute so it stays scoped to the hero;
          the landing sections below scroll over it (overflow-hidden clips). */}
      <video
        className="absolute inset-0 w-full h-full object-cover z-0"
        autoPlay
        loop
        muted
        playsInline
        aria-hidden="true"
        src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260406_094145_4a271a6c-3869-4f1c-8aa7-aeb0cb227994.mp4"
      >
        {/* TODO: replace with CFA fencing footage */}
      </video>

      {/* Bottom blur overlay (z-1) — softens the video into the text-heavy
          lower half without darkening it (no gradient tint, blur only). */}
      <div
        className="absolute inset-0 backdrop-blur-xl pointer-events-none z-[1]"
        aria-hidden="true"
        style={{
          maskImage: "linear-gradient(to top, black 0%, transparent 45%)",
          WebkitMaskImage:
            "linear-gradient(to top, black 0%, transparent 45%)",
        }}
      />

      {/* Floating navbar — fixed so it stays pinned while the landing
          sections scroll underneath. Only two clusters carry the glass
          treatment (nav-links island, auth island); the logo sits bare over
          the video and the mobile menu lives OUTSIDE both islands as a
          sibling inside this fixed wrapper (glass has overflow:hidden). */}
      <nav className="fixed top-3 inset-x-3 md:inset-x-8 z-50">
        <div className="flex items-center justify-between gap-4">
          <Link
            href="/"
            className={`h-8 flex items-center gap-3 font-semibold tracking-widest uppercase text-sm md:text-base animate-blur-fade-up ${FOCUS_RING}`}
            style={{ animationDelay: "0ms" }}
          >
            {/* Circle-crop badge: the source crest has a baked-in dark square,
                so a rounded-full crop reads as a deliberate club badge over the
                video. alt="" — the adjacent wordmark already names this link.
                Fixed h-8 keeps it slim; no glass — reads bare over the video. */}
            <Image
              src="/cfa-crest.png"
              alt=""
              width={40}
              height={40}
              priority
              className="h-8 w-8 rounded-full object-cover"
            />
            Cape Fencing
          </Link>

          {/* Desktop nav links island — hidden below lg, replaced by hamburger
              menu. Animates in as a single unit (no per-link stagger) so the
              glass pill and its capsule feel like one Apple-style control. */}
          <div
            className="hidden lg:flex items-center liquid-glass rounded-full px-2 py-1.5 animate-blur-fade-up"
            style={{ animationDelay: "100ms" }}
            onMouseLeave={() => setHoveredHref(null)}
          >
            {NAV_LINKS.map((link) => {
              const isIndicated = indicated === link.href;
              return (
                <a
                  key={link.href}
                  href={link.href}
                  aria-current={
                    activeHref === link.href ? "location" : undefined
                  }
                  onMouseEnter={() => setHoveredHref(link.href)}
                  onFocus={() => setHoveredHref(link.href)}
                  onBlur={() => setHoveredHref(null)}
                  onClick={() => setActiveHref(link.href)}
                  className={`relative rounded-full px-4 py-2 text-sm transition-colors ${FOCUS_RING} ${
                    isIndicated
                      ? "text-white"
                      : "text-gray-300 hover:text-white"
                  }`}
                >
                  {isIndicated && (
                    <motion.span
                      layoutId="nav-capsule"
                      aria-hidden="true"
                      className="absolute inset-0 rounded-full bg-white/15 shadow-[inset_0_1px_1px_rgba(255,255,255,0.25),0_2px_12px_rgba(255,255,255,0.08)]"
                      transition={
                        prefersReducedMotion
                          ? { duration: 0 }
                          : { type: "spring", bounce: 0.3, duration: 0.6 }
                      }
                    />
                  )}
                  <span className="relative z-10">{link.label}</span>
                </a>
              );
            })}
          </div>

          {/* Right cluster: auth island (sibling-owned glass) + hamburger */}
          <div className="flex items-center gap-3">
            <div
              className="hidden sm:flex animate-blur-fade-up"
              style={{ animationDelay: "350ms" }}
            >
              {authSlot}
            </div>

            {/* Hamburger — only rendered below lg; toggles the mobile menu below */}
            <button
              type="button"
              onClick={() => setMenuOpen((open) => !open)}
              aria-label="Toggle menu"
              aria-expanded={menuOpen}
              aria-controls="mobile-menu"
              className={`lg:hidden relative w-10 h-10 rounded-full liquid-glass flex items-center justify-center animate-blur-fade-up ${FOCUS_RING}`}
              style={{ animationDelay: "350ms" }}
            >
              <Menu
                size={20}
                className={`absolute transition-all duration-500 ease-out ${
                  menuOpen
                    ? "opacity-0 rotate-180 scale-50"
                    : "opacity-100 rotate-0 scale-100"
                }`}
              />
              <X
                size={20}
                className={`absolute transition-all duration-500 ease-out ${
                  menuOpen
                    ? "opacity-100 rotate-0 scale-100"
                    : "opacity-0 rotate-180 scale-50"
                }`}
              />
            </button>
          </div>
        </div>

        {/* Mobile menu dropdown — sibling of the glass islands (their
            overflow:hidden would clip a child). Always mounted so the close
            transition can play; pointer-events disabled while closed keeps it
            unreachable, and `inert` removes the hidden links from tab order
            (WCAG focus order — otherwise keyboard users tab through
            invisible items). */}
        <div
          id="mobile-menu"
          inert={!menuOpen}
          className={`absolute top-full left-0 right-0 mt-2 lg:hidden bg-gray-900/95 backdrop-blur-lg rounded-2xl border border-gray-800 shadow-2xl transition-all duration-500 ease-out ${
            menuOpen
              ? "translate-y-0 opacity-100"
              : "-translate-y-4 opacity-0 pointer-events-none"
          }`}
        >
          <div className="flex flex-col px-4 py-4">
            {NAV_LINKS.map((link, index) => {
              const isActive = activeHref === link.href;
              return (
                <a
                  key={link.href}
                  href={link.href}
                  aria-current={isActive ? "location" : undefined}
                  onClick={() => {
                    setActiveHref(link.href);
                    setMenuOpen(false);
                  }}
                  className={`py-3 px-3 rounded-lg transition-all duration-500 ease-out ${FOCUS_RING} ${
                    isActive
                      ? "bg-white/10 text-white"
                      : "text-gray-300 hover:bg-gray-800/50"
                  } ${
                    menuOpen
                      ? "translate-x-0 opacity-100"
                      : "-translate-x-4 opacity-0"
                  }`}
                  style={{
                    transitionDelay: menuOpen ? `${index * 50}ms` : "0ms",
                  }}
                >
                  {link.label}
                </a>
              );
            })}

            {/* Phone-only auth links — sm:flex auth slot in the navbar is
                hidden on the smallest screens, so repeat it here. */}
            <div className="sm:hidden border-t border-gray-800 mt-2 pt-4">
              {authSlot}
            </div>
          </div>
        </div>
      </nav>

      {/* Hero content — pinned to the bottom of the viewport */}
      <div className="relative z-10 flex-1 flex flex-col justify-end px-4 sm:px-6 md:px-12 pb-8 md:pb-16">
        <div className="flex flex-col md:flex-row items-start md:items-end gap-8">
          <div className="flex-1">
            {/* Keyed on slideIndex so the blur-fade-up animations replay
                whenever the visitor moves between slides. */}
            <div key={slideIndex}>
              <div
                className="flex flex-wrap items-center gap-3 sm:gap-6 mb-6 md:mb-8 text-xs sm:text-sm animate-blur-fade-up"
                style={{ animationDelay: "300ms" }}
              >
                <div className="flex items-center gap-2">
                  <Star size={16} className="fill-white sm:w-5 sm:h-5" />
                  <span className="font-medium">{slide.meta}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock size={16} />
                  <span>Tue–Thu 18:30 & Sat</span>
                </div>
                <div className="flex items-center gap-2">
                  <MapPin size={16} />
                  <span>Rondebosch, Cape Town</span>
                </div>
              </div>

              <h1
                className="text-3xl sm:text-5xl md:text-6xl lg:text-7xl font-normal mb-4 md:mb-6 tracking-[-0.04em] animate-blur-fade-up"
                style={{ animationDelay: "400ms" }}
              >
                {slide.title}
              </h1>

              <p
                className="text-base sm:text-lg md:text-xl text-gray-400 mb-6 md:mb-12 max-w-2xl animate-blur-fade-up"
                style={{ animationDelay: "500ms" }}
              >
                {slide.description}
              </p>
            </div>

            {/* CTAs live outside the keyed slide block so they don't
                re-animate every time the slide changes. */}
            <div className="flex flex-wrap gap-3 sm:gap-4">
              <Link
                href="/auth/sign-up"
                className={`bg-white text-black rounded-full font-medium px-6 sm:px-8 py-2.5 sm:py-3 hover:bg-gray-200 transition-colors inline-flex items-center gap-2 animate-blur-fade-up ${FOCUS_RING}`}
                style={{ animationDelay: "600ms" }}
              >
                Join the Academy
                <ArrowRight size={18} />
              </Link>
              <Link
                href="/auth/login"
                className={`liquid-glass rounded-full font-medium px-6 sm:px-8 py-2.5 sm:py-3 inline-flex items-center animate-blur-fade-up ${FOCUS_RING}`}
                style={{ animationDelay: "700ms" }}
              >
                Member Login
              </Link>
            </div>
          </div>

          {/* Slide navigation arrows */}
          <div className="flex gap-3 sm:gap-4">
            <button
              type="button"
              onClick={goToPrevSlide}
              aria-label="Previous slide"
              className={`liquid-glass rounded-full px-4 sm:px-6 py-2.5 sm:py-3 inline-flex items-center gap-2 animate-blur-fade-up ${FOCUS_RING}`}
              style={{ animationDelay: "800ms" }}
            >
              <ChevronLeft size={18} />
              Previous
            </button>
            <button
              type="button"
              onClick={goToNextSlide}
              aria-label="Next slide"
              className={`liquid-glass rounded-full px-4 sm:px-6 py-2.5 sm:py-3 inline-flex items-center gap-2 animate-blur-fade-up ${FOCUS_RING}`}
              style={{ animationDelay: "900ms" }}
            >
              Next
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
