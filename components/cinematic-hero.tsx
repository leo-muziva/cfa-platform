import Image from "next/image";
import { ChevronDown } from "lucide-react";
import { PublicNavigation } from "@/components/public-navigation";

export function CinematicHero({ authSlot }: { authSlot: React.ReactNode }) {
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
      {/* Dark overlay over the whole video so the crest and name stay
          readable on bright frames. */}
      <div
        className="pointer-events-none absolute inset-0 z-[2] bg-black/45"
        aria-hidden="true"
      />

      <PublicNavigation authSlot={authSlot} />

      <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-4 pt-16 text-center sm:px-6">
        <Image
          src="/media/brand/cfa-crest.png"
          alt="Cape Fencing Academy crest"
          width={499}
          height={500}
          priority
          className="h-auto w-40 animate-blur-fade-up drop-shadow-[0_8px_24px_rgba(0,0,0,0.6)] sm:w-52 md:w-64"
          style={{ animationDelay: "300ms" }}
        />
        <h1
          className="mt-6 text-4xl font-normal tracking-[-0.03em] animate-blur-fade-up drop-shadow-[0_2px_12px_rgba(0,0,0,0.7)] sm:text-6xl md:mt-8 md:text-7xl"
          style={{ animationDelay: "450ms" }}
        >
          Cape Fencing Academy
        </h1>
      </div>

      {/* Wrapper does the centring, since liquid-glass sets its own
          transform on hover. */}
      <div className="absolute inset-x-0 bottom-6 z-10 flex justify-center md:bottom-10">
        <a
          href="#about"
          aria-label="Scroll down to about the club"
          className="flex h-12 w-12 items-center justify-center rounded-full liquid-glass focus-visible:outline focus-visible:outline-2 focus-visible:outline-white/70"
        >
          <ChevronDown className="hero-scroll-bounce h-6 w-6" aria-hidden="true" />
        </a>
      </div>
    </div>
  );
}
