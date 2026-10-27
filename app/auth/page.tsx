import { redirect } from "next/navigation";
import { safeInternalNext } from "@/lib/auth-next";

/** /auth: sends people to the login page, keeping a safe ?next= destination. */
export default async function AuthenticationEntryPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const next = safeInternalNext((await searchParams).next);
  redirect(`/auth/login?next=${encodeURIComponent(next)}`);
}


