"use client";

import { useState } from "react";
import {
  approveAndCreateDraftAction,
  approveUpdatedSheetAction,
  generateOrdersSpreadsheet,
  getSpreadsheetDownloadAction,
  markSpreadsheetSentAction,
  runAiProofAction,
  type SheetActionResult,
} from "./sheet-actions";
import type { SheetFindingRowView, SheetView } from "@/lib/services/supplier-sheet-view";

const dateTime = new Intl.DateTimeFormat("en-ZA", { dateStyle: "medium", timeStyle: "short" });

const SEVERITY_STYLES: Record<SheetFindingRowView["severity"], { label: string; className: string }> = {
  high: { label: "Check first", className: "bg-red-100 text-red-800 dark:bg-red-500/20 dark:text-red-300" },
  medium: { label: "Worth a look", className: "bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300" },
  low: { label: "FYI", className: "bg-muted text-muted-foreground" },
};

const primaryButton =
  "rounded-lg bg-black px-4 py-2 text-sm text-white disabled:bg-gray-400 dark:bg-violet-600 dark:disabled:bg-white/20";
const secondaryButton = "rounded-lg border px-4 py-2 text-sm hover:bg-gray-50 disabled:opacity-40 dark:hover:bg-white/10";

function Step({ number, title, done, children }: { number: number; title: string; done: boolean; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span
        aria-hidden="true"
        className={
          "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold " +
          (done ? "bg-green-600 text-white" : "bg-muted text-muted-foreground")
        }
      >
        {done ? "✓" : number}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">
          {title}
          {done ? <span className="sr-only"> (done)</span> : null}
        </p>
        <div className="mt-2">{children}</div>
      </div>
    </li>
  );
}

export function SupplierSheetPanel({
  bulkOrderId,
  bulkStatus,
  thresholdReached,
  sheet,
}: {
  bulkOrderId: string;
  bulkStatus: string;
  thresholdReached: boolean;
  sheet: SheetView | null;
}) {
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState(sheet?.emailDraft ?? "");
  const [shownDraft, setShownDraft] = useState(sheet?.emailDraft ?? null);

  // A fresh AI proof brings a new draft; show it unless staff are mid-edit.
  if ((sheet?.emailDraft ?? null) !== shownDraft) {
    setShownDraft(sheet?.emailDraft ?? null);
    setEmail(sheet?.emailDraft ?? "");
  }

  if (bulkStatus === "cancelled") return null;

  async function run(which: string, action: () => Promise<SheetActionResult>) {
    setBusy(which);
    setError("");
    setMessage("");
    const result = await action();
    if (result.success) {
      setMessage(result.message);
      if (result.url) window.location.href = result.url;
    } else {
      setError(result.error);
    }
    setBusy("");
  }

  const status = sheet?.status ?? null;
  const sent = status === "sent";
  const canProof = status === "generated" || status === "proofed" || status === "approved";
  const proofed = status === "proofed" || status === "approved" || sent;

  return (
    <section aria-labelledby={"sheet-" + bulkOrderId} className="mt-4 rounded-lg border border-border p-4">
      <h3 id={"sheet-" + bulkOrderId} className="text-base font-semibold">
        Supplier spreadsheet
      </h3>
      {!sheet && thresholdReached ? (
        <p className="mt-1 text-sm text-green-700 dark:text-green-400">The threshold is reached. Generate the spreadsheet when you are ready.</p>
      ) : null}

      <ol className="mt-4 grid gap-5">
        <Step number={1} title="Generate orders spreadsheet" done={sheet !== null}>
          {sheet ? (
            <p className="text-sm text-muted-foreground">
              Saved {dateTime.format(new Date(sheet.generatedAt))} &middot; {sheet.rowCount} row{sheet.rowCount === 1 ? "" : "s"} &middot;{" "}
              {sheet.itemCount} item{sheet.itemCount === 1 ? "" : "s"} from {sheet.paidOrderCount} paid order
              {sheet.paidOrderCount === 1 ? "" : "s"}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">Builds the Excel file from every paid order in this bulk order.</p>
          )}
          <div className="mt-2 flex flex-wrap gap-2">
            {!sent ? (
              <button
                onClick={() => run("generate", () => generateOrdersSpreadsheet(bulkOrderId))}
                disabled={busy !== ""}
                className={sheet ? secondaryButton : primaryButton}
              >
                {busy === "generate" ? "Building..." : sheet ? "Regenerate spreadsheet" : "Generate orders spreadsheet"}
              </button>
            ) : null}
            {sheet ? (
              <button
                onClick={() => run("download", () => getSpreadsheetDownloadAction(bulkOrderId))}
                disabled={busy !== ""}
                className={secondaryButton}
              >
                {busy === "download" ? "Preparing..." : "Download spreadsheet"}
              </button>
            ) : null}
          </div>
        </Step>

        <Step number={2} title="AI proof" done={proofed}>
          <p className="text-sm text-muted-foreground">
            Checks the spreadsheet against the database, then the AI reviews it and drafts the supplier email.
          </p>

          {status === "needs_approval" ? (
            <div role="status" className="mt-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm dark:border-amber-500/40 dark:bg-amber-500/10">
              <p className="font-medium">The spreadsheet was out of date and has been updated.</p>
              <p className="mt-1">{sheet?.checkDescription}</p>
              {sheet && sheet.diffRows.length > 0 ? (
                <ul className="mt-2 grid gap-1">
                  {sheet.diffRows.map((row, i) => (
                    <li key={i}>
                      <span className="font-mono text-xs">{row.label}</span> &middot; {row.change}
                    </li>
                  ))}
                </ul>
              ) : null}
              <p className="mt-2">Download it to check if you like, then approve it. The AI review starts after you approve.</p>
              <button
                onClick={() => run("approve-sheet", () => approveUpdatedSheetAction(bulkOrderId))}
                disabled={busy !== ""}
                className={primaryButton + " mt-3"}
              >
                {busy === "approve-sheet" ? "Approving and reviewing..." : "Approve updated sheet"}
              </button>
            </div>
          ) : (
            <button
              onClick={() => run("proof", () => runAiProofAction(bulkOrderId))}
              disabled={busy !== "" || !canProof}
              className={(proofed ? secondaryButton : primaryButton) + " mt-2"}
              title={!sheet ? "Generate the spreadsheet first" : undefined}
            >
              {busy === "proof" ? "Checking and reviewing..." : proofed ? "Run AI proof again" : "AI proof"}
            </button>
          )}
          {!sheet ? <p className="mt-1 text-xs text-muted-foreground">Available once the spreadsheet is generated.</p> : null}

          {sheet && sheet.checkMatches && proofed ? (
            <p className="mt-2 text-sm text-green-700 dark:text-green-400">{sheet.checkDescription}</p>
          ) : null}

          {sheet?.aiSummary && proofed ? (
            <div className="mt-3 rounded-lg bg-muted/50 p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Briefing {sheet.modelUsed === "basic checks only" ? "(basic checks only)" : "(written by AI, check before sending)"}
              </p>
              <p className="mt-1 whitespace-pre-line text-sm">{sheet.aiSummary}</p>
              {sheet.findings.length > 0 ? (
                <ul className="mt-3 grid gap-2">
                  {sheet.findings.map((finding) => (
                    <li key={finding.id} className="text-sm">
                      <span className={"mr-2 rounded-full px-2 py-0.5 text-xs font-medium " + SEVERITY_STYLES[finding.severity].className}>
                        {SEVERITY_STYLES[finding.severity].label}
                      </span>
                      {finding.message}
                      {finding.suggestion ? <span className="block pl-1 text-muted-foreground">Suggestion: {finding.suggestion}</span> : null}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-sm text-muted-foreground">No warnings.</p>
              )}
            </div>
          ) : null}
        </Step>

        <Step number={3} title="Approve and create Gmail draft" done={status === "approved" || sent}>
          {proofed ? (
            <>
              <label htmlFor={"email-" + bulkOrderId} className="mb-1 block text-xs text-muted-foreground">
                Email to the supplier (you can edit it)
              </label>
              <textarea
                id={"email-" + bulkOrderId}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                rows={8}
                maxLength={3000}
                disabled={status !== "proofed"}
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
              />
              {status === "proofed" ? (
                <button
                  onClick={() => run("draft", () => approveAndCreateDraftAction(bulkOrderId, email))}
                  disabled={busy !== "" || email.trim() === ""}
                  className={primaryButton + " mt-2"}
                >
                  {busy === "draft" ? "Creating draft..." : "Approve and create Gmail draft"}
                </button>
              ) : null}
              {sheet?.approvedAt ? (
                <p className="mt-2 text-sm text-muted-foreground">
                  Draft created {dateTime.format(new Date(sheet.approvedAt))}. Open Gmail, check it and press Send.
                </p>
              ) : null}
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Available after the AI proof.</p>
          )}
        </Step>

        <Step number={4} title="Mark as sent" done={sent}>
          {sent && sheet?.sentAt ? (
            <p className="text-sm text-muted-foreground">Sent {dateTime.format(new Date(sheet.sentAt))}.</p>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">After you press Send in Gmail. This moves the bulk order to &quot;placed&quot;.</p>
              <button
                onClick={() => run("sent", () => markSpreadsheetSentAction(bulkOrderId))}
                disabled={busy !== "" || status !== "approved"}
                className={secondaryButton + " mt-2"}
              >
                {busy === "sent" ? "Saving..." : "Mark as sent"}
              </button>
            </>
          )}
        </Step>
      </ol>

      {error ? (
        <p role="alert" className="mt-3 text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      ) : null}
      {message ? (
        <p role="status" className="mt-3 text-sm text-green-700 dark:text-green-400">
          {message}
        </p>
      ) : null}
    </section>
  );
}
