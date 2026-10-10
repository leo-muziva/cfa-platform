import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { requireAdmin } from "@/lib/services/MemberService";
import { getAiRunLog } from "@/lib/services/supplier-sheet-service";
import { bulkOrderIdSchema } from "@/lib/validations/bulk-order.schema";
import type { AiRunRow } from "@/lib/repositories/supplier-sheet-repository";

export const dynamic = "force-dynamic";

const when = new Intl.DateTimeFormat("en-ZA", { dateStyle: "medium", timeStyle: "medium", timeZone: "Africa/Johannesburg" });

const STATUS: Record<AiRunRow["status"], { label: string; className: string }> = {
  succeeded: { label: "AI reviewed", className: "bg-emerald-100 text-emerald-900 dark:bg-emerald-500/20 dark:text-emerald-200" },
  fell_back: { label: "AI reviewed (backup model)", className: "bg-emerald-100 text-emerald-900 dark:bg-emerald-500/20 dark:text-emerald-200" },
  rules_only: { label: "AI unavailable - basic checks only", className: "bg-amber-100 text-amber-900 dark:bg-amber-500/20 dark:text-amber-200" },
  running: { label: "Running", className: "bg-muted text-muted-foreground" },
  failed: { label: "Failed", className: "bg-red-100 text-red-900 dark:bg-red-500/20 dark:text-red-200" },
};

const EVENT_LABELS: Record<string, string> = {
  "supplier_sheet.generated": "Spreadsheet generated",
  "supplier_sheet.regenerated": "Spreadsheet regenerated",
  "supplier_sheet.rebuilt_after_check": "Spreadsheet rebuilt after a data change",
  "supplier_sheet.proofed": "AI proof finished",
  "supplier_sheet.update_approved": "Changed data approved",
  "supplier_sheet.draft_created": "Gmail draft created",
  "supplier_sheet.draft_failed": "Gmail draft failed",
  "supplier_sheet.sent": "Sent to supplier",
  "supplier_sheet.send_failed": "Sending failed",
};

// Shows staff that the AI proof actually ran, and with what. Every value
// comes from the ai_runs, ai_run_steps and audit_events rows, which only
// admins can read.
export default async function AiRunLogPage({ params }: { params: Promise<{ bulkOrderId: string }> }) {
  const admin = await requireAdmin();
  if ("error" in admin) redirect(admin.error === "Not authenticated" ? "/auth/login?next=/protected/admin/bulk-orders" : "/protected");
  const { bulkOrderId } = await params;
  if (!bulkOrderIdSchema.safeParse(bulkOrderId).success) notFound();
  const log = await getAiRunLog(bulkOrderId);

  return (
    <div className="space-y-6">
      <Link href="/protected/admin/bulk-orders" className="inline-flex min-h-11 items-center gap-2 text-sm font-medium hover:underline">
        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        Bulk orders
      </Link>
      {!log.ok ? (
        <p role="alert" className="rounded-xl border p-4 text-sm">
          {log.code === "no_sheet" ? "No spreadsheet has been generated for this bulk order yet." : "The AI run log could not be loaded."}
        </p>
      ) : (
        <>
          <header>
            <h1 className="text-3xl font-bold">AI run log</h1>
            <p className="text-sm text-muted-foreground">
              Bulk order {log.data.reference}. Each AI proof is recorded here: which model ran, how long it took, the tokens it used, every tool it called and any error.
            </p>
          </header>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold">AI proofs</h2>
            {log.data.runs.length === 0 ? <p className="text-muted-foreground">The AI proof has not been run yet.</p> : log.data.runs.map((run) => (
              <article key={run.id} className="space-y-3 rounded-xl border p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className={"rounded-full px-3 py-1 text-xs font-semibold " + STATUS[run.status].className}>{STATUS[run.status].label}</span>
                  <span className="text-sm text-muted-foreground">{when.format(new Date(run.created_at))}{run.triggered_by_profile?.full_name ? " - " + run.triggered_by_profile.full_name : ""}</span>
                </div>
                <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-4">
                  <div><dt className="text-muted-foreground">Provider</dt><dd className="font-medium">{run.provider ?? "none"}</dd></div>
                  <div><dt className="text-muted-foreground">Model</dt><dd className="font-medium break-all">{run.model ?? "none"}</dd></div>
                  <div><dt className="text-muted-foreground">Tokens in / out</dt><dd className="font-medium">{run.input_tokens ?? 0} / {run.output_tokens ?? 0}</dd></div>
                  <div><dt className="text-muted-foreground">Time</dt><dd className="font-medium">{run.latency_ms === null ? "-" : (run.latency_ms / 1000).toFixed(1) + " s"}</dd></div>
                </dl>
                {run.ai_run_steps.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold">Tool calls</h3>
                    <ol className="mt-1 list-decimal space-y-0.5 pl-5 text-sm">
                      {run.ai_run_steps.filter((step) => step.tool_name).map((step) => (
                        <li key={step.step_number}>
                          <code>{step.tool_name}</code>
                          {step.provider ? " (" + step.provider + ")" : ""}
                          {step.row_count !== null ? " - " + step.row_count + " rows" : ""}
                        </li>
                      ))}
                    </ol>
                  </div>
                )}
                {run.flagged && <p className="text-sm text-amber-700 dark:text-amber-300">Flagged: {run.flag_reason}</p>}
                {run.error && (
                  <div>
                    <h3 className="text-sm font-semibold">Errors</h3>
                    <ul className="mt-1 space-y-0.5 text-sm text-muted-foreground">
                      {run.error.split("; ").map((line, index) => <li key={index}><code className="break-words">{line}</code></li>)}
                    </ul>
                  </div>
                )}
              </article>
            ))}
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold">Sheet history</h2>
            {log.data.events.length === 0 ? <p className="text-muted-foreground">Nothing recorded yet.</p> : (
              <ul className="space-y-1 text-sm">
                {log.data.events.map((event, index) => (
                  <li key={index} className="flex flex-wrap gap-x-3">
                    <span className="text-muted-foreground">{when.format(new Date(event.created_at))}</span>
                    <span className="font-medium">{EVENT_LABELS[event.event_type] ?? event.event_type}</span>
                    {typeof event.metadata?.error === "string" && <code className="text-muted-foreground">{event.metadata.error}</code>}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}
