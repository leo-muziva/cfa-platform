import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createPeachSandboxCheckout, isPeachSandboxEnabled } from "@/lib/providers/peach-sandbox";

export const runtime = "nodejs";

function escapeHtml(value: string) {
  const replacements: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" };
  return value.replace(/[&<>"']/g, (character) => replacements[character] ?? character);
}

export async function GET(request: Request) {
  if (!isPeachSandboxEnabled()) return new NextResponse("Not found", { status: 404 });
  const attemptId = new URL(request.url).searchParams.get("attempt");
  if (!attemptId) return new NextResponse("Not found", { status: 404 });
  const db = await createClient();
  const { data: user } = await db.auth.getUser();
  if (!user.user) return NextResponse.redirect(new URL("/auth/login?next=%2Fprotected%2Fbook", request.url));
  const { data: attempt } = await db.from("payment_attempts").select("id,provider_reference,amount_cents,status").eq("id", attemptId).eq("payer_id", user.user.id).single();
  if (!attempt || attempt.status !== "pending" || !attempt.provider_reference || !attempt.amount_cents) return new NextResponse("Checkout is unavailable", { status: 409 });
  const origin = new URL(request.url).origin;
  const checkout = createPeachSandboxCheckout({
    amountCents: Number(attempt.amount_cents), merchantTransactionId: attempt.provider_reference,
    returnUrl: `${origin}/protected/billing`, notificationUrl: `${origin}/api/payments/peach/webhook`,
  });
  const fields = Object.entries(checkout.fields).map(([name, value]) => `<input type="hidden" name="${escapeHtml(name)}" value="${escapeHtml(value)}">`).join("");
  return new NextResponse(`<!doctype html><html><body><p>Redirecting to secure payment…</p><form id="checkout" method="post" action="${escapeHtml(checkout.action)}">${fields}</form><script>document.getElementById('checkout').submit()</script></body></html>`, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
}
