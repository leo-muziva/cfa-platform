import { NextResponse } from "next/server";

// Peach requires a Hosted Checkout V2 adapter. The former sandbox route used
// retired settlement RPCs, so it must not process a payment before that work.
export async function GET() {
  return new NextResponse("Peach sandbox checkout is not configured", { status: 404 });
}
