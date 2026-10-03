import { CinematicHero } from "@/components/cinematic-hero";
import { AboutSection } from "@/components/landing/about-section";
import { CoachesSection } from "@/components/landing/coaches-section";
import { ClubInfo } from "@/components/landing/club-info";
import { FaqSection } from "@/components/landing/faq-section";
import { SiteFooter } from "@/components/landing/site-footer";

// Public home page: video hero, then the landing sections. The main bar
// comes from the root layout. The hero stays dark in both themes since it
// sits on a video; everything below it follows the theme.
export default function Home() {
  return (
    <main className="bg-background text-foreground">
      <CinematicHero />
      <AboutSection />
      {/* Old #schedule and #contact links land on the info block now. */}
      <div id="schedule" />
      <div id="contact" />
      <ClubInfo id="info" />
      <CoachesSection />
      <FaqSection />
      <SiteFooter />
    </main>
  );
}
