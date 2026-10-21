import Link from "next/link";

// The booking RPC refuses incomplete accounts, so say so before the member
// spends time choosing a coach and time.
export function ProfileIncompleteNotice() {
  return (
    <div role="status" className="rounded-2xl border border-amber-300 bg-amber-50 p-5 text-sm text-amber-950 dark:border-amber-400/30 dark:bg-amber-950/40 dark:text-amber-50">
      <p className="font-semibold">Finish your profile before booking</p>
      <p className="mt-1">We need your contact details, date of birth and emergency contact before you can book a lesson.</p>
      <Link
        href="/protected/complete-profile"
        className="mt-3 inline-flex min-h-11 items-center rounded-full bg-cfa-purple px-5 font-medium text-white hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cfa-purple"
      >
        Complete your profile
      </Link>
    </div>
  );
}
