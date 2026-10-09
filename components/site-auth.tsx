import Link from "next/link";
import { getCurrentProfile } from "@/lib/services/MemberService";
import { MemberPortalLink } from "@/components/site-navigation";
import { greetingName } from "@/lib/display-name";

const FOCUS =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#140a2e] dark:focus-visible:outline-white";

// Right side of the main bar. Logged in: "Hello, name" and the Member Portal
// button. Logged out: Log in and Sign up. Checked on the server so a deleted
// account never looks logged in. Logout lives in the member portal bar.
export async function SiteAuth() {
  const profile = await getCurrentProfile();

  if (profile) {
    const firstName = greetingName(profile.full_name);
    return (
      <div className="flex items-center gap-3">
        <span className="whitespace-nowrap text-sm text-[#140a2e]/75 dark:text-white/75">
          Hello, {firstName}
        </span>
        <MemberPortalLink />
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <Link
        href="/auth/login"
        className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium hover:bg-[#140a2e]/10 dark:hover:bg-white/15 ${FOCUS}`}
      >
        Log in
      </Link>
      <Link
        href="/auth/sign-up"
        className={`whitespace-nowrap rounded-full bg-[#140a2e] px-4 py-2 text-sm font-medium text-white hover:bg-[#140a2e]/90 dark:bg-white dark:text-[#140a2e] dark:hover:bg-white/90 ${FOCUS}`}
      >
        Sign up
      </Link>
    </div>
  );
}
