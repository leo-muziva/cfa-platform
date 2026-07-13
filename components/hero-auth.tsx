import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

/**
 * Auth links for the cinematic hero navbar, rendered into CinematicHero via
 * its `authSlot` prop.
 *
 * Server component so auth state is read server-side — the same
 * `supabase.auth.getClaims()` pattern as components/auth-button.tsx (claims
 * are decoded from the session cookie, avoiding the slower getUser() network
 * round-trip). The whole cluster is ONE `liquid-glass` capsule (an "island",
 * like grouped iOS glass controls); the links inside are plain text/solid
 * pills, never individually glass. Plain links rather than the shadcn Button:
 * the always-dark cinematic design needs its own treatment. Logout
 * intentionally lives inside /protected, not here.
 *
 * Note: this component renders both in the navbar right cluster and inside
 * the mobile menu, so it must stay self-contained.
 */
export async function HeroAuth() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const user = data?.claims;

  if (user) {
    return (
      <div className="liquid-glass rounded-full p-1.5 flex items-center gap-1">
        <span className="hidden md:inline px-2 text-sm text-gray-300">
          Hey, {user.email}!
        </span>
        <Link
          href="/protected"
          className="bg-white text-black rounded-full px-4 py-1.5 text-sm font-medium hover:bg-gray-200 transition-colors inline-flex items-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-white/70"
        >
          Dashboard
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
