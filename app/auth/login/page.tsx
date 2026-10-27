import type { Metadata } from "next";
import { SignInFlow } from "@/components/ui/sign-in";
import { safeInternalNext } from '@/lib/auth-next'

export const metadata: Metadata = {
  title: "Log in — Cape Fencing Academy",
};

/**
 * /auth/login. `next` is where to go after signing in (checked to be a
 * path on this site); `confirmed=1` shows that the email was confirmed.
 */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; confirmed?: string }>;
}) {
  const params = await searchParams;
  return (
    <SignInFlow
      next={safeInternalNext(params.next, "/")}
      accountConfirmed={params.confirmed === "1"}
    />
  );
}
