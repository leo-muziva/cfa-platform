"use client";

import { useState } from "react";
import { checkoutOrder } from "../actions/cart";

// Pay-now control for a draft cart. CFA holds no stock, so the full amount
// is paid up front; the order joins the next bulk order once PayFast
// confirms the payment. On success the action redirects to PayFast.
export function PayNowButton({
  totalLabel,
  canPay,
  paymentsAvailable,
  initialNotes = "",
}: {
  totalLabel: string;
  canPay: boolean;
  paymentsAvailable: boolean;
  initialNotes?: string;
}) {
  const [notes, setNotes] = useState(initialNotes);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function handlePay() {
    setBusy(true);
    setError("");

    // Only returns when checkout could not start; success navigates away.
    const result = await checkoutOrder(notes);

    if (result?.error) {
      setError(result.error);
    }
    setBusy(false);
  }

  return (
    <div className="mt-8">
      <label
        htmlFor="order-notes"
        className="mb-1 block text-sm text-gray-600 dark:text-white/75"
      >
        Notes for CFA (optional)
      </label>
      <textarea
        id="order-notes"
        value={notes}
        onChange={function (e) {
          setNotes(e.target.value);
        }}
        rows={3}
        maxLength={500}
        placeholder="Anything CFA should know about this order"
        className="w-full rounded-lg border px-3 py-2 text-sm"
      />

      {/* Dependents and minors cannot pay; their guardian does. */}
      {canPay ? (
        <>
          <button
            type="button"
            onClick={handlePay}
            disabled={busy || !paymentsAvailable}
            className="mt-3 w-full rounded-lg bg-black px-4 py-3 text-white disabled:bg-gray-400 dark:bg-violet-600 dark:disabled:bg-white/20"
          >
            {busy ? "Starting payment..." : "Pay now - " + totalLabel}
          </button>
          {!paymentsAvailable ? (
            <p className="mt-2 text-sm text-muted-foreground">
              Online payment is not available right now.
            </p>
          ) : null}
        </>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">
          Your guardian needs to pay for this order.
        </p>
      )}

      {error ? (
        <p role="alert" className="mt-2 text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      ) : null}

      <p className="mt-3 text-xs text-gray-500 dark:text-white/60">
        Payment is taken now through PayFast. Your order joins CFA&apos;s next
        bulk order once payment is confirmed.
      </p>
      <p className="mt-1 text-xs text-gray-500 dark:text-white/60">
        Sandbox demonstration - no real money is charged.
      </p>
    </div>
  );
}
