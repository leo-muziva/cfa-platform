import Link from "next/link";
import { Button } from "./ui/button";
import { getCurrentProfile } from "@/lib/services/MemberService";
import { greetingName } from "@/lib/display-name";
import { LogoutButton } from "./logout-button";

export async function AuthButton() {
  const profile = await getCurrentProfile();
  const firstName = greetingName(profile?.full_name);

  return profile ? (
    <div className="flex items-center gap-3 text-sm text-[#140a2e] dark:text-white">
      <span>Hello, {firstName}</span>
      <LogoutButton />
    </div>
  ) : (
    <div className="flex gap-2">
      <Button asChild size="sm" variant={"outline"}>
        <Link href="/auth/login">Sign in</Link>
      </Button>
      <Button asChild size="sm" variant={"default"}>
        <Link href="/auth/sign-up">Sign up</Link>
      </Button>
    </div>
  );
}
