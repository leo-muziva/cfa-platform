import { Suspense } from "react";
import { CinematicHero } from "@/components/cinematic-hero";
import { HeroAuth } from "@/components/hero-auth";
import { EnvVarWarning } from "@/components/env-var-warning";
import { hasEnvVars } from "@/lib/utils";
import { AboutSection } from "@/components/landing/about-section";
import { CoachesSection } from "@/components/landing/coaches-section";
import { ScheduleSection } from "@/components/landing/schedule-section";
import { MembershipSection } from "@/components/landing/membership-section";
import { FaqSection } from "@/components/landing/faq-section";
import { ContactFooter } from "@/components/landing/contact-footer";

// Full public landing page: cinematic full-viewport hero followed by the
// scrollable landing sections (hero nav links anchor to their ids).
// The page stays a Server Component — all interactivity lives inside
// CinematicHero ("use client") and the individual sections. This page is
// deliberately always-dark (cinematic), so the ThemeSwitcher is not shown
// here; theming still works everywhere else in the app.
export default function Home() {
  return (
    <main className="bg-black text-white">
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
      <ScheduleSection />
      <MembershipSection />
      <FaqSection />
      <ContactFooter />
    </main>
  );
}
