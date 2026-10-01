import { NextResponse } from "next/server";
import { isAuthorizedCronRequest, runMonthlyInvoicesJob } from "@/lib/services/scheduled-jobs-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request.headers.get("authorization"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const result = await runMonthlyInvoicesJob();
  if (!result.ok) {
    console.error("[cron] monthly-invoices failed", { error: result.error });
    return NextResponse.json({ error: "Job failed" }, { status: 500 });
  }
  return NextResponse.json({ count: result.count });
}
