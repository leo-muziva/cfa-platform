import { Suspense } from "react";
import { CinematicHero } from "@/components/cinematic-hero";
import { HeroAuth } from "@/components/hero-auth";
import { EnvVarWarning } from "@/components/env-var-warning";
import { hasEnvVars } from "@/lib/utils";
import { AboutSection } from "@/components/landing/about-section";
import { CoachesSection } from "@/components/landing/coaches-section";
import { ClubInfo } from "@/components/landing/club-info";
import { MembershipSection } from "@/components/landing/membership-section";
import { FaqSection } from "@/components/landing/faq-section";
import { SiteFooter } from "@/components/landing/site-footer";

// Full public landing page: cinematic full-viewport hero followed by the
// scrollable landing sections. The primary menu links only to separate pages.
// The page stays a Server Component — all interactivity lives inside
// CinematicHero ("use client") and the individual sections. The hero itself
// (and the persistent nav capsule inside it) stays permanently dark by
// design — a video background with unpredictable brightness needs fixed
// white text regardless of theme, same treatment as any photo/video hero.
// Everything below the hero is theme-aware; the ThemeToggle lives in the
// nav capsule (rendered by CinematicHero -> PublicNavigation).
export default function Home() {
  return (
    <main className="bg-background text-foreground">
      {/* HeroAuth reads the auth cookie (uncached data), so it must render
          inside Suspense to keep the rest of the page statically streamable —
          same pattern the interim landing used for AuthButton. */}
      <CinematicHero
        authSlot={
          hasEnvVars ? (
            <Suspense>
              <HeroAuth />
            </Suspense>
          ) : (
            <EnvVarWarning />
          )
        }
      />
      <AboutSection />
      <CoachesSection />
      {/* Old #schedule and #contact links land on the info block now. */}
      <div id="schedule" />
      <div id="contact" />
      <ClubInfo id="info" />
      <Suspense fallback={<section id="membership" className="bg-background px-4 py-20 text-primary sm:px-6 md:px-12 md:py-28"><div className="mx-auto max-w-6xl"><h2 className="text-3xl md:text-5xl">Choose how you fence.</h2><p className="mt-8 text-muted-foreground">Loading membership options...</p></div></section>}>
        <MembershipSection />
      </Suspense>
      <FaqSection />
      <SiteFooter />
    </main>
  );
}
