"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, Clock, MapPin, Star } from "lucide-react";
import { PublicNavigation } from "@/components/public-navigation";

const SLIDES = [
  {
    meta: "Est. 1997 - SA's Premier Fencing Club",
    title: "The Art of the Blade.",
    description:
      "Foil, épée and sabre coaching in Cape Town - from your first lunge to the national podium.",
  },
  {
    meta: "Foil - precision & timing",
    title: "Touch First. Think Faster.",
    description:
      "The duelling chess match: master point control, tempo and right-of-way.",
  },
  {
    meta: "Épée & Sabre - power & speed",
    title: "Every Inch Is a Target.",
    description:
      "From patient épée duels to explosive sabre exchanges - find your weapon.",
  },
] as const;

const FOCUS_RING =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-white/70";

export function CinematicHero({ authSlot }: { authSlot: React.ReactNode }) {
  const [slideIndex, setSlideIndex] = useState(0);
  const slide = SLIDES[slideIndex];

  const goToPrevSlide = () =>
    setSlideIndex((current) => (current - 1 + SLIDES.length) % SLIDES.length);
  const goToNextSlide = () =>
    setSlideIndex((current) => (current + 1) % SLIDES.length);

  return (
    <div className="relative flex h-dvh flex-col overflow-hidden bg-black text-white">
      <video
        className="absolute inset-0 z-0 h-full w-full object-cover"
        autoPlay
        loop
        muted
        playsInline
        aria-hidden="true"
        src="/media/video/hero-video.mp4"
      />
      <div
        className="pointer-events-none absolute inset-0 z-[1] backdrop-blur-xl"
        aria-hidden="true"
        style={{
          maskImage: "linear-gradient(to top, black 0%, transparent 45%)",
          WebkitMaskImage: "linear-gradient(to top, black 0%, transparent 45%)",
        }}
      />
      {/* Readability scrim behind the text block — independent of the blur
          mask above (that one blurs, this one darkens). Tune the from-black
          opacity to taste; delete this div entirely to revert to the
          blur-only look. */}
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 z-[2] h-[70%] bg-gradient-to-t from-black/80 via-black/35 to-transparent"
        aria-hidden="true"
      />

      <PublicNavigation authSlot={authSlot} />

      <div className="relative z-10 flex flex-1 flex-col justify-end px-4 pb-8 sm:px-6 md:px-12 md:pb-16">
        <div className="flex flex-col items-start gap-8 md:flex-row md:items-end">
          <div className="flex-1">
            <div key={slideIndex}>
              <div
                className="mb-6 flex flex-wrap items-center gap-3 text-xs animate-blur-fade-up sm:gap-6 sm:text-sm md:mb-8"
                style={{ animationDelay: "300ms" }}
              >
                <div className="flex items-center gap-2">
                  <Star size={16} className="fill-white sm:h-5 sm:w-5" />
                  <span className="font-medium">{slide.meta}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock size={16} />
                  <span>Tue-Thu 18:30 & Sat</span>
                </div>
                <div className="flex items-center gap-2">
                  <MapPin size={16} />
                  <span>Rondebosch, Cape Town</span>
                </div>
              </div>

              <h1
                className="mb-4 text-3xl font-normal tracking-[-0.04em] animate-blur-fade-up sm:text-5xl md:mb-6 md:text-6xl lg:text-7xl"
                style={{ animationDelay: "400ms" }}
              >
                {slide.title}
              </h1>
              <p
                className="mb-6 max-w-2xl text-base text-gray-400 animate-blur-fade-up sm:text-lg md:mb-12 md:text-xl"
                style={{ animationDelay: "500ms" }}
              >
                {slide.description}
              </p>
            </div>
          </div>

          <div className="flex gap-3 sm:gap-4">
            <button
              type="button"
              onClick={goToPrevSlide}
              aria-label="Previous slide"
              className={`inline-flex items-center gap-2 rounded-full px-4 py-2.5 liquid-glass animate-blur-fade-up sm:px-6 sm:py-3 ${FOCUS_RING}`}
              style={{ animationDelay: "800ms" }}
            >
              <ChevronLeft size={18} />
              Previous
            </button>
            <button
              type="button"
              onClick={goToNextSlide}
              aria-label="Next slide"
              className={`inline-flex items-center gap-2 rounded-full px-4 py-2.5 liquid-glass animate-blur-fade-up sm:px-6 sm:py-3 ${FOCUS_RING}`}
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
