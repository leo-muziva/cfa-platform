import type { Metadata } from "next";
import { SignInFlow } from "@/components/ui/sign-in";
import { safeInternalNext } from '@/lib/auth-next'

export const metadata: Metadata = {
  title: "Log in — Cape Fencing Academy",
};

export default async function Page({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  return <SignInFlow next={safeInternalNext((await searchParams).next)} />;
}
