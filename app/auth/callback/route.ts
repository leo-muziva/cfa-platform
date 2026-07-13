import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { type NextRequest } from "next/server";

// Handles the redirect back from Supabase OAuth (Google) sign-in/sign-up.
// Mirrors app/auth/confirm/route.ts's shape but exchanges an OAuth `code`
// for a session instead of verifying an email OTP token.
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const nextParam = searchParams.get("next") ?? "/protected";
  // Only allow same-origin relative redirects — an attacker could otherwise
  // pass next=https://evil.example and ride the auth redirect off-site.
  const next = nextParam.startsWith("/") ? nextParam : "/protected";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      redirect(next);
    }
    redirect(`/auth/error?error=${encodeURIComponent(error.message)}`);
  }

  redirect(`/auth/error?error=${encodeURIComponent("No code provided")}`);
}
