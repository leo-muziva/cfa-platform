"use client";

import { useRef, useState } from "react";
import { updateQuantity, removeItem } from "../actions/cart";

// Same cap the server uses (the shop schema and addToCart).
const MAX_QUANTITY = 99;

export function CartItemControls({
  itemId,
  quantity,
}: {
  itemId: string;
  quantity: number;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  // blocks a second click before React has re-rendered the disabled buttons
  const busyRef = useRef(false);

  // Runs one cart change at a time. Next refreshes the page with the
  // server's quantity when it finishes.
  async function run(action: () => ReturnType<typeof updateQuantity>) {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError("");
    try {
      const result = await action();
      if ("error" in result) setError(result.error);
    } catch {
      setError("Could not update your cart. Please try again.");
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  const atMax = quantity >= MAX_QUANTITY;

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-3">
        <div className="flex items-center rounded border">
          <button
            onClick={function () {
              run(() => updateQuantity(itemId, quantity - 1));
            }}
            // use Remove to take the last one out, so "−" never removes silently
            disabled={busy || quantity <= 1}
            className="px-3 py-1 hover:bg-gray-100 disabled:opacity-40 dark:hover:bg-white/10"
            aria-label="Decrease quantity"
          >
            −
          </button>
          <span className="w-10 text-center text-sm" aria-live="polite">
            {quantity}
          </span>
          <button
            onClick={function () {
              run(() => updateQuantity(itemId, quantity + 1));
            }}
            disabled={busy || atMax}
            className="px-3 py-1 hover:bg-gray-100 disabled:opacity-40 dark:hover:bg-white/10"
            aria-label="Increase quantity"
            aria-describedby={atMax ? "max-" + itemId : undefined}
          >
            +
          </button>
        </div>

        <button
          onClick={function () {
            run(() => removeItem(itemId));
          }}
          disabled={busy}
          className="text-sm text-gray-500 underline disabled:opacity-40 dark:text-white/60"
        >
          Remove
        </button>
      </div>
      {atMax ? (
        <p id={"max-" + itemId} className="text-xs text-muted-foreground">
          Maximum {MAX_QUANTITY} per item.
        </p>
      ) : null}
      {error ? (
        <p
          role="alert"
          className="max-w-56 text-right text-xs text-red-600 dark:text-red-400"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
