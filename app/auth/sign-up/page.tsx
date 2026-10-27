import type { Metadata } from "next";
import { SignUpFlow } from "@/components/ui/sign-up";
import { safeInternalNext } from '@/lib/auth-next'

export const metadata: Metadata = {
  title: "Create an account - Cape Fencing Academy",
};

/** /auth/sign-up: create an account, then confirm by email. */
export default async function Page({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  return <SignUpFlow next={safeInternalNext((await searchParams).next, "/")} />;
}
