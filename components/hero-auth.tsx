import Link from "next/link";
import { getCurrentProfile } from "@/lib/services/MemberService";

/**
 * Auth links for the cinematic hero navbar, rendered into CinematicHero via
 * its `authSlot` prop.
 *
 * Server component so auth state is verified server-side through the profile
 * service. This prevents a deleted local user from appearing signed in after
 * a Supabase reset. The whole cluster is ONE `liquid-glass` capsule (an "island",
 * like grouped iOS glass controls); the links inside are plain text/solid
 * pills, never individually glass. Plain links rather than the shadcn Button:
 * the always-dark cinematic design needs its own treatment. Logout
 * intentionally lives inside /protected, not here.
 *
 * Note: this component renders both in the navbar right cluster and inside
 * the mobile menu, so it must stay self-contained.
 */
export async function HeroAuth() {
  const profile = await getCurrentProfile();

  if (profile) {
    const firstName = profile.full_name?.trim().split(/\s+/)[0] || "member";
    return (
      <div className="liquid-glass rounded-full p-1.5 flex items-center gap-1">
        <span className="hidden md:inline px-2 text-sm text-gray-300">
          Hello, {firstName}
        </span>
        <Link
          href="/protected"
          className="bg-white text-black rounded-full px-4 py-1.5 text-sm font-medium hover:bg-gray-200 transition-colors inline-flex items-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-white/70"
        >
          Member Portal
        </Link>
      </div>
    );
  }

  return (
    <div className="liquid-glass rounded-full p-1.5 flex items-center gap-1">
      <Link
        href="/auth/login"
        className="rounded-full px-4 py-1.5 text-sm font-medium text-white hover:bg-white/10 transition-colors inline-flex items-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-white/70"
      >
        Log in
      </Link>
      <Link
        href="/auth/sign-up"
        className="bg-white text-black rounded-full px-4 py-1.5 text-sm font-medium hover:bg-gray-200 transition-colors inline-flex items-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-white/70"
      >
        Sign up
      </Link>
    </div>
  );
}
