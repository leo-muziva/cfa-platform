import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isPeachSandboxEnabled, verifyPeachSandboxWebhook } from "@/lib/providers/peach-sandbox";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!isPeachSandboxEnabled()) return new NextResponse("Not found", { status: 404 });
  const body = await request.text();
  const event = verifyPeachSandboxWebhook({ body, url: request.url, headers: request.headers });
  if (!event) return new NextResponse("Invalid signature", { status: 401 });
  const admin = createAdminClient();
  if (!admin) return new NextResponse("Payment service unavailable", { status: 503 });
  const { error } = await admin.rpc("record_peach_sandbox_webhook", {
    target_event_id: event.eventId, target_provider_reference: event.providerReference,
    target_succeeded: event.succeeded, target_payload: Object.fromEntries(new URLSearchParams(body)),
  });
  if (error) return new NextResponse("Unable to process event", { status: 500 });
  return new NextResponse(null, { status: 200 });
}
