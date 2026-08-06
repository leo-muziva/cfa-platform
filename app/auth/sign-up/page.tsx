import type { Metadata } from "next";
import { SignUpFlow } from "@/components/ui/sign-up";
import { safeInternalNext } from '@/lib/auth-next'

export const metadata: Metadata = {
  title: "Create a guest account - Cape Fencing Academy",
};

export default async function Page({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  return <SignUpFlow next={safeInternalNext((await searchParams).next)} />;
}
