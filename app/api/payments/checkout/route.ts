import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { buildCheckout } from "@/lib/services/payment-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!);
}

export async function GET(request: Request) {
  const result = await buildCheckout(new URL(request.url).searchParams.get("attempt"));
  if (!result.ok) return new NextResponse(result.error, { status: 409, headers: { "cache-control": "no-store" } });
  const checkout = result.checkout;
  if (checkout.kind === "redirect") return NextResponse.redirect(checkout.url, { headers: { "cache-control": "no-store" } });
  const nonce = randomBytes(18).toString("base64");
  const fields = Object.entries(checkout.fields).map(([name, value]) => `<input type="hidden" name="${escapeHtml(name)}" value="${escapeHtml(value)}">`).join("");
  return new NextResponse(`<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Secure sandbox checkout</title></head><body><p>Opening secure sandbox checkout. No real money is charged.</p><form id="checkout" method="post" action="${escapeHtml(checkout.action)}">${fields}<button type="submit">Continue to checkout</button></form><script nonce="${nonce}">document.getElementById("checkout").submit()</script></body></html>`, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
      "referrer-policy": "no-referrer",
      "content-security-policy": `default-src 'none'; script-src 'nonce-${nonce}'; form-action ${new URL(checkout.action).origin}; base-uri 'none'; frame-ancestors 'none'`,
    },
  });
}
