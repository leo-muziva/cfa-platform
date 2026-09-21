import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { type NextRequest } from "next/server";
import { safeInternalNext } from "@/lib/auth-next";

// Handles the redirect back from Supabase OAuth (Google) sign-in/sign-up.
// Mirrors app/auth/confirm/route.ts's shape but exchanges an OAuth `code`
// for a session instead of verifying an email OTP token.
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const next = safeInternalNext(searchParams.get("next"), "/");
  const providerError =
    searchParams.get("error_description") ?? searchParams.get("error");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      redirect(next);
    }
    redirect(
      `/auth/error?error=${encodeURIComponent(error.message)}&next=${encodeURIComponent(next)}`,
    );
  }

  redirect(
    `/auth/error?error=${encodeURIComponent(providerError ?? "No code provided")}&next=${encodeURIComponent(next)}`,
  );
}
