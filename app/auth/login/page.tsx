import type { Metadata } from "next";
import { SignInFlow } from "@/components/ui/sign-in";

export const metadata: Metadata = {
  title: "Log in — Cape Fencing Academy",
};

export default function Page() {
  return <SignInFlow />;
}
