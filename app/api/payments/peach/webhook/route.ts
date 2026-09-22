import { NextResponse } from "next/server";

// Peach requires a Hosted Checkout V2 adapter. This route is intentionally
// unavailable until that adapter can verify and normalize Peach notifications.
export async function POST() {
  return new NextResponse("Peach sandbox webhook is not configured", { status: 404 });
}
