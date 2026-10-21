import { createClient } from "@/lib/supabase/server";
import { type EmailOtpType } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { type NextRequest } from "next/server";
import { safeInternalNext } from '@/lib/auth-next'

// CFA's email templates link here with a token hash. Supabase's default
// templates instead verify on Supabase and send back a PKCE `code`, which only
// the browser that signed up can exchange; accept both so a project still on
// the default template does not strand new accounts on an error page.
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const code = searchParams.get("code");
  const next = safeInternalNext(searchParams.get("next"), "/auth/login?confirmed=1");

  if (token_hash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash });
    if (!error) redirect(next);
    redirect(`/auth/error?error=${encodeURIComponent(error.message)}`);
  }

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) redirect(next);
    redirect(`/auth/error?error=${encodeURIComponent("This confirmation link was opened in a different browser or has expired. Open it in the browser you signed up with, or log in to request a new one.")}`);
  }

  redirect(`/auth/error?error=${encodeURIComponent(searchParams.get("error_description") ?? "This confirmation link is incomplete or has expired.")}`);
}
