import { NextResponse } from "next/server";
import { receivePaymentNotification } from "@/lib/services/payment-service";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/x-www-form-urlencoded")) {
    return new NextResponse("Unsupported notification", { status: 415 });
  }
  const reader = request.body?.getReader();
  if (!reader) return new NextResponse("Empty notification", { status: 400 });
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 16_384) {
      await reader.cancel();
      return new NextResponse("Notification too large", { status: 413 });
    }
    chunks.push(value);
  }
  const body = Buffer.concat(chunks).toString("utf8");
  const status = await receivePaymentNotification("payfast_sandbox", { body, headers: request.headers, url: request.url });
  return new NextResponse(status === 200 ? null : "Notification not accepted", { status, headers: { "cache-control": "no-store" } });
}
