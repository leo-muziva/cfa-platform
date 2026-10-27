// Daily Vercel Cron job (see vercel.json): releases lesson slots whose
// pay-now hold expired. Requires the CRON_SECRET bearer token.
import { NextResponse } from "next/server";
import { isAuthorizedCronRequest, runExpireHoldsJob } from "@/lib/services/scheduled-jobs-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Runs the job and returns how many holds were released. */
export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request.headers.get("authorization"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const result = await runExpireHoldsJob();
  if (!result.ok) {
    console.error("[cron] expire-holds failed", { error: result.error });
    return NextResponse.json({ error: "Job failed" }, { status: 500 });
  }
  return NextResponse.json({ count: result.count });
}
