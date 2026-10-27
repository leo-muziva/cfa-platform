"use client";

import Link from "next/link";
import { useState } from "react";
import { advanceStatus, cancelBulkOrder, setEstimatedArrival } from "./actions";
import {
  NEXT_BULK_ORDER_STATUS,
  bulkOrderStatusSchema,
} from "@/lib/validations/bulk-order.schema";

/** Moves a bulk order to its next status, cancels it, or sets the estimated arrival date. */
export function StatusControls({
  bulkOrderId,
  status,
  estimatedArrival,
}: {
  bulkOrderId: string;
  status: string;
  estimatedArrival: string | null;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [date, setDate] = useState(estimatedArrival ?? "");

  // Work out what comes next. The server checks the same rules.
  const parsedStatus = bulkOrderStatusSchema.safeParse(status);
  const nextStatus = parsedStatus.success
    ? NEXT_BULK_ORDER_STATUS[parsedStatus.data]
    : null;
  const cancelled = parsedStatus.success && parsedStatus.data === "cancelled";

  async function move(target: string) {
    setBusy(true);
    setError("");
    setMessage("");
    const result = await advanceStatus(bulkOrderId, target);
    if (result.error) {
      setError(result.error);
    }
    setBusy(false);
  }

  function advance() {
    if (nextStatus) {
      move(nextStatus);
    }
  }

  async function cancel() {
    if (
      !window.confirm(
        "Cancel this bulk order? Every paid order in it gets a full refund request in the Refunds queue."
      )
    ) {
      return;
    }
    setBusy(true);
    setError("");
    setMessage("");
    const result = await cancelBulkOrder(bulkOrderId);
    if (result.error) {
      setError(result.error);
    } else {
      const count = result.refundsRequested ?? 0;
      setMessage(
        "Bulk order cancelled. " +
          (count === 1
            ? "1 refund request was added to the Refunds queue."
            : count + " refund requests were added to the Refunds queue.")
      );
    }
    setBusy(false);
  }

  async function saveDate() {
    setBusy(true);
    setError("");
    setMessage("");
    const result = await setEstimatedArrival(bulkOrderId, date);
    if (result.error) {
      setError(result.error);
    }
    setBusy(false);
  }

  return (
    <div className="mt-4 border-t pt-4">
      {nextStatus ? (
        <div className="flex flex-wrap gap-2">
          <button
            onClick={advance}
            disabled={busy}
            className="rounded-lg bg-black px-4 py-2 text-sm text-white disabled:bg-gray-400 dark:bg-violet-600 dark:disabled:bg-white/20"
          >
            {busy ? "Saving..." : "Mark as " + nextStatus}
          </button>
          <button
            onClick={cancel}
            disabled={busy}
            className="rounded-lg border px-4 py-2 text-sm text-red-600 disabled:opacity-40 dark:text-red-400"
          >
            Cancel bulk order
          </button>
        </div>
      ) : (
        <p className="text-sm text-gray-500 dark:text-white/60">
          {cancelled ? "This bulk order was cancelled." : "This bulk order is complete."}
        </p>
      )}

      <div className="mt-4 flex items-end gap-2">
        <div>
          <label
            htmlFor={"arrival-" + bulkOrderId}
            className="mb-1 block text-xs text-gray-600 dark:text-white/75"
          >
            Estimated arrival
          </label>
          <input
            id={"arrival-" + bulkOrderId}
            type="date"
            value={date}
            onChange={function (e) {
              setDate(e.target.value);
            }}
            className="rounded-lg border px-3 py-2 text-sm"
          />
        </div>
        <button
          onClick={saveDate}
          disabled={busy}
          className="rounded-lg border px-4 py-2 text-sm disabled:opacity-40"
        >
          Save
        </button>
      </div>

      {error ? <p role="alert" className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p> : null}
      {message ? (
        <p role="status" className="mt-2 text-sm text-green-700 dark:text-green-400">
          {message}{" "}
          <Link href="/protected/admin/refunds?status=requested" className="underline underline-offset-4">
            Open the Refunds queue
          </Link>
        </p>
      ) : null}
    </div>
  );
}