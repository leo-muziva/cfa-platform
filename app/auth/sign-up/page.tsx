import type { Metadata } from "next";
import { SignUpFlow } from "@/components/ui/sign-up";

export const metadata: Metadata = {
  title: "Join — Cape Fencing Academy",
};

export default function Page() {
  return <SignUpFlow />;
}
