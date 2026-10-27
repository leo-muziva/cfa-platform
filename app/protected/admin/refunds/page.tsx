import Link from "next/link";
import { ActionForm } from "@/components/portal/action-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  completeManualRefundAction,
  decideRefundAction,
  resolveProcessingRefundAction,
  sendProviderRefundAction,
} from "@/app/actions/refunds";
import { listRefundQueue, providerRefundsEnabled } from "@/lib/services/refund-service";
import type { PaymentKind, RefundRequest, RefundStatus } from "@/types/domain";
import { formatZarWithCents } from "@/lib/money";
import { refundableBeforeDecision } from "@/lib/refund-amounts";

export const dynamic = "force-dynamic";



function formatDateTime(value: string | null) {
  if (!value) return "";
  return new Date(value).toLocaleString("en-ZA", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Africa/Johannesburg",
  });
}

const KIND_LABELS: Record<PaymentKind, string> = {
  booking: "Lesson booking",
  order: "Shop order",
  membership: "Membership",
  invoice: "Invoice",
};

const STATUS_LABELS: Record<RefundStatus, string> = {
  requested: "Requested",
  approved: "Approved",
  processing: "Processing",
  processed: "Processed",
  rejected: "Rejected",
  failed: "Failed",
};

const STATUS_TONES: Record<RefundStatus, string> = {
  requested: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  approved: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
  processing: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
  processed: "bg-green-600/15 text-green-700 dark:text-green-400",
  rejected: "bg-muted text-muted-foreground",
  failed: "bg-red-500/15 text-red-700 dark:text-red-400",
};

const STATUS_ORDER: RefundStatus[] = ["requested", "approved", "processing", "processed", "rejected", "failed"];

const selectClasses = "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm";
const textareaClasses = "flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm";

function isRefundStatus(value: string): value is RefundStatus {
  return (STATUS_ORDER as string[]).includes(value);
}

function DecisionForms({ refund, providerAvailable }: { refund: RefundRequest; providerAvailable: boolean }) {
  const id = refund.id;
  const providerReason = !providerRefundsEnabled()
    ? "PayFast refunds are switched off for this environment."
    : !refund.hasProviderPayment
      ? "This payment was not made through PayFast, so it can only be refunded by bank transfer."
      : "";
  const requestedRands = (refund.amountCents / 100).toFixed(2);

  return (
    <div className="grid gap-4 border-t pt-4 md:grid-cols-2">
      <section aria-labelledby={`approve-${id}-heading`} className="space-y-2">
        <h3 id={`approve-${id}-heading`} className="font-semibold">Approve</h3>
        <ActionForm action={decideRefundAction} submitLabel="Approve refund" className="space-y-3">
          <input type="hidden" name="refundId" value={id} />
          <input type="hidden" name="decision" value="approve" />
          <div className="grid gap-2">
            <Label htmlFor={`approve-${id}-method`}>Refund method</Label>
            <select
              id={`approve-${id}-method`}
              name="method"
              defaultValue="manual_bank"
              className={selectClasses}
              aria-describedby={providerAvailable ? undefined : `approve-${id}-method-hint`}
            >
              <option value="manual_bank">Manual bank transfer</option>
              <option value="provider" disabled={!providerAvailable}>
                PayFast refund to the original card{providerAvailable ? "" : " (unavailable)"}
              </option>
            </select>
            {!providerAvailable ? (
              <p id={`approve-${id}-method-hint`} className="text-xs text-muted-foreground">{providerReason}</p>
            ) : null}
          </div>
          <div className="grid gap-2">
            <Label htmlFor={`approve-${id}-amount`}>Amount to approve (R, optional)</Label>
            <Input
              id={`approve-${id}-amount`}
              name="amount"
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0.01"
              max={requestedRands}
              aria-describedby={`approve-${id}-amount-hint`}
            />
            <p id={`approve-${id}-amount-hint`} className="text-xs text-muted-foreground">
              Leave blank to approve the requested {formatZarWithCents(refund.amountCents)}. You can only lower it.
            </p>
          </div>
          <div className="grid gap-2">
            <Label htmlFor={`approve-${id}-note`}>Note to the payer (optional)</Label>
            <textarea id={`approve-${id}-note`} name="note" rows={2} maxLength={500} className={textareaClasses} />
          </div>
        </ActionForm>
      </section>

      <section aria-labelledby={`reject-${id}-heading`} className="space-y-2">
        <h3 id={`reject-${id}-heading`} className="font-semibold">Reject</h3>
        <ActionForm action={decideRefundAction} submitLabel="Reject refund" className="space-y-3">
          <input type="hidden" name="refundId" value={id} />
          <input type="hidden" name="decision" value="reject" />
          <div className="grid gap-2">
            <Label htmlFor={`reject-${id}-note`}>Reason for rejecting (shown to the payer)</Label>
            <textarea id={`reject-${id}-note`} name="note" rows={3} maxLength={500} required className={textareaClasses} />
          </div>
        </ActionForm>
      </section>
    </div>
  );
}

function StatusActions({ refund }: { refund: RefundRequest }) {
  const id = refund.id;

  if (refund.status === "requested") {
    const providerAvailable = providerRefundsEnabled() && refund.hasProviderPayment;
    return <DecisionForms refund={refund} providerAvailable={providerAvailable} />;
  }

  if (refund.status === "approved" && refund.method === "manual_bank") {
    return (
      <div className="border-t pt-4">
        <ActionForm action={completeManualRefundAction} submitLabel="Mark processed" className="flex flex-wrap items-end gap-3">
          <input type="hidden" name="refundId" value={id} />
          <div className="grid min-w-64 flex-1 gap-2">
            <Label htmlFor={`complete-${id}-reference`}>Bank transfer reference</Label>
            <Input id={`complete-${id}-reference`} name="reference" required maxLength={200} aria-describedby={`complete-${id}-hint`} />
            <p id={`complete-${id}-hint`} className="text-xs text-muted-foreground">
              Pay {formatZarWithCents(refund.amountCents)} to the payer by EFT first, then record the reference here.
            </p>
          </div>
        </ActionForm>
      </div>
    );
  }

  if (refund.status === "approved" && refund.method === "provider") {
    const enabled = providerRefundsEnabled();
    return (
      <div className="space-y-2 border-t pt-4">
        {enabled ? (
          <ActionForm action={sendProviderRefundAction} submitLabel="Send to PayFast" className="space-y-2">
            <input type="hidden" name="refundId" value={id} />
            <p className="text-sm text-muted-foreground">
              Sends a refund of {formatZarWithCents(refund.amountCents)} to PayFast for the original payment.
            </p>
          </ActionForm>
        ) : (
          <>
            <button
              type="button"
              disabled
              aria-describedby={`provider-${id}-off`}
              className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground opacity-50"
            >
              Send to PayFast
            </button>
            <p id={`provider-${id}-off`} className="text-sm text-muted-foreground">
              PayFast refunds are switched off for this environment.
            </p>
          </>
        )}
      </div>
    );
  }

  if (refund.status === "processing") {
    return (
      <div className="space-y-3 border-t pt-4">
        <p className="text-sm text-muted-foreground">
          PayFast did not confirm this refund. Check the PayFast dashboard before doing anything else, so the money is
          never sent twice, then record what it shows.
        </p>
        <ActionForm action={resolveProcessingRefundAction} submitLabel="Record outcome" className="space-y-3">
          <input type="hidden" name="refundId" value={id} />
          <fieldset className="space-y-1">
            <legend className="text-sm font-medium">What does PayFast show?</legend>
            <label className="flex items-center gap-2 text-sm">
              <input type="radio" name="outcome" value="processed" required /> The refund was paid
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="radio" name="outcome" value="failed" /> No refund was made
            </label>
          </fieldset>
          <div className="grid gap-2">
            <Label htmlFor={`resolve-${id}-reference`}>PayFast refund reference (if paid)</Label>
            <Input id={`resolve-${id}-reference`} name="reference" maxLength={200} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor={`resolve-${id}-note`}>What you checked</Label>
            <textarea id={`resolve-${id}-note`} name="note" rows={2} maxLength={500} required className={textareaClasses} />
          </div>
        </ActionForm>
      </div>
    );
  }

  if (refund.status === "failed") {
    return (
      <p role="note" className="border-t pt-4 text-sm text-red-700 dark:text-red-400">
        Failed{refund.failureReason ? ": " + refund.failureReason : "."} The amount is refundable again, so the payer or staff can raise a new request.
      </p>
    );
  }

  return null;
}

function RefundCard({ refund }: { refund: RefundRequest }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center justify-between gap-2 text-lg">
          <span>{refund.refundNumber} - {refund.payerName}</span>
          <span className={"rounded-lg px-2.5 py-1 text-xs font-medium " + STATUS_TONES[refund.status]}>
            {STATUS_LABELS[refund.status]}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <dl className="grid gap-x-6 gap-y-1 sm:grid-cols-2 lg:grid-cols-3">
          <div><dt className="inline text-muted-foreground">Payment for: </dt><dd className="inline">{KIND_LABELS[refund.kind]}</dd></div>
          <div><dt className="inline text-muted-foreground">Payment amount: </dt><dd className="inline">{formatZarWithCents(refund.paymentAmountCents)}</dd></div>
          <div><dt className="inline text-muted-foreground">Requested amount: </dt><dd className="inline font-semibold">{formatZarWithCents(refund.amountCents)}</dd></div>
          <div><dt className="inline text-muted-foreground">Still refundable: </dt><dd className="inline">{formatZarWithCents(refundableBeforeDecision(refund))}</dd></div>
          <div><dt className="inline text-muted-foreground">Raised: </dt><dd className="inline">{formatDateTime(refund.createdAt)}</dd></div>
          {refund.method ? (
            <div>
              <dt className="inline text-muted-foreground">Method: </dt>
              <dd className="inline">{refund.method === "provider" ? "PayFast" : "Manual bank transfer"}</dd>
            </div>
          ) : null}
          {refund.decidedAt ? (
            <div><dt className="inline text-muted-foreground">Decided: </dt><dd className="inline">{formatDateTime(refund.decidedAt)}</dd></div>
          ) : null}
          {refund.processedAt ? (
            <div><dt className="inline text-muted-foreground">Processed: </dt><dd className="inline">{formatDateTime(refund.processedAt)}</dd></div>
          ) : null}
          {refund.externalReference ? (
            <div><dt className="inline text-muted-foreground">Reference: </dt><dd className="inline">{refund.externalReference}</dd></div>
          ) : null}
        </dl>
        <p><span className="text-muted-foreground">Reason: </span>{refund.reason}</p>
        {refund.decisionNote ? (
          <p><span className="text-muted-foreground">Decision note: </span>{refund.decisionNote}</p>
        ) : null}
        <StatusActions refund={refund} />
      </CardContent>
    </Card>
  );
}

export default async function AdminRefundsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const sp = await searchParams;
  const requested = sp.status ?? "requested";
  // Unknown values fall back to the queue that needs a decision.
  const filter: RefundStatus | "all" =
    requested === "all" ? "all" : isRefundStatus(requested) ? requested : "requested";

  const result = await listRefundQueue();
  if (!result.ok) {
    return (
      <div className="space-y-4">
        <h1 className="text-3xl font-bold">Refunds</h1>
        <p role="alert" className="text-destructive">The refund queue could not be loaded: {result.error}</p>
      </div>
    );
  }

  const all = result.data;
  const counts = new Map<RefundStatus, number>();
  for (const refund of all) counts.set(refund.status, (counts.get(refund.status) ?? 0) + 1);
  const shown = filter === "all" ? all : all.filter((refund) => refund.status === filter);

  const tabs: { key: RefundStatus | "all"; label: string; count: number }[] = [
    ...STATUS_ORDER.map((status) => ({ key: status, label: STATUS_LABELS[status], count: counts.get(status) ?? 0 })),
    { key: "all", label: "All", count: all.length },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Refunds</h1>
        <p className="text-muted-foreground">
          Review refund requests, pay them out by bank transfer or through PayFast, and record the outcome. Refunds never become account credit.
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          To raise a refund yourself, use the settled payments list on the{" "}
          <Link href="/protected/admin/payments" className="underline underline-offset-4">Payments</Link> page.
        </p>
      </div>

      <nav aria-label="Filter refunds by status" className="flex flex-wrap gap-2">
        {tabs.map((tab) => {
          const active = filter === tab.key;
          return (
            <Link
              key={tab.key}
              href={"/protected/admin/refunds?status=" + tab.key}
              aria-current={active ? "page" : undefined}
              className={
                "rounded-xl px-4 py-2 text-sm transition " +
                (active
                  ? "bg-primary font-medium text-primary-foreground"
                  : "border border-border text-foreground hover:bg-accent")
              }
            >
              {tab.label} <span className={active ? "opacity-70" : "text-muted-foreground"}>({tab.count})</span>
            </Link>
          );
        })}
      </nav>

      <section aria-label={filter === "all" ? "All refunds" : STATUS_LABELS[filter] + " refunds"} className="space-y-4">
        {shown.length === 0 ? (
          <p className="rounded-2xl border border-border p-8 text-center text-muted-foreground">
            No refunds in this group.
          </p>
        ) : (
          shown.map((refund) => <RefundCard key={refund.id} refund={refund} />)
        )}
      </section>
    </div>
  );
}
