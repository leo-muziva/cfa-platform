// Monthly Vercel Cron job (see vercel.json; 22:00 UTC on the 24th, which is
// midnight on the 25th in Cape Town): generates the month's invoices and
// emails them to the payers. Requires the CRON_SECRET bearer token.
import { NextResponse } from "next/server";
import { isAuthorizedCronRequest, runMonthlyInvoicesJob } from "@/lib/services/scheduled-jobs-service";
import { sendScheduledInvoiceEmails } from "@/lib/services/invoice-document-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Runs the job and returns how many invoices were created and emailed. */
export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request.headers.get("authorization"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const result = await runMonthlyInvoicesJob();
  if (!result.ok) {
    console.error("[cron] monthly-invoices failed", { error: result.error });
    return NextResponse.json({ error: "Job failed" }, { status: 500 });
  }
  // Also retries earlier scheduled invoices whose email failed.
  const { emailed, failed } = await sendScheduledInvoiceEmails();
  if (failed) console.error("[cron] some invoice emails failed", { failed });
  return NextResponse.json({ count: result.count, emailed, failed });
}
