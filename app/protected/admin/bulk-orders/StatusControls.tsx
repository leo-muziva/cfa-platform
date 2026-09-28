"use client";

import { useState } from "react";
import { advanceStatus, setEstimatedArrival } from "./actions";

// The order statuses move through, in sequence.
const FLOW = ["collecting", "placed", "shipping", "arrived", "distributed"];

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
  const [date, setDate] = useState(estimatedArrival ?? "");

  // Work out what comes next in the sequence.
  const currentIndex = FLOW.indexOf(status);
  const nextStatus =
    currentIndex >= 0 && currentIndex < FLOW.length - 1
      ? FLOW[currentIndex + 1]
      : null;

  async function advance() {
    if (!nextStatus) {
      return;
    }
    setBusy(true);
    setError("");
    const result = await advanceStatus(bulkOrderId, nextStatus);
    if (result.error) {
      setError(result.error);
    }
    setBusy(false);
  }

  async function saveDate() {
    setBusy(true);
    setError("");
    const result = await setEstimatedArrival(bulkOrderId, date);
    if (result.error) {
      setError(result.error);
    }
    setBusy(false);
  }

  return (
    <div className="mt-4 border-t pt-4">
      {nextStatus ? (
        <button
          onClick={advance}
          disabled={busy}
          className="rounded-lg bg-black px-4 py-2 text-sm text-white disabled:bg-gray-400 dark:bg-violet-600 dark:disabled:bg-white/20"
        >
          {busy ? "Saving..." : "Mark as " + nextStatus}
        </button>
      ) : (
        <p className="text-sm text-gray-500 dark:text-white/60">This bulk order is complete.</p>
      )}

      <div className="mt-4 flex items-end gap-2">
        <div>
          <label className="mb-1 block text-xs text-gray-600 dark:text-white/75">
            Estimated arrival
          </label>
          <input
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

      {error ? <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p> : null}
    </div>
  );
}