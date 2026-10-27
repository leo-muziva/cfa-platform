"use client";

import { useState } from "react";
import { updateQuantity, removeItem } from "../actions/cart";

/** Quantity buttons and remove for one cart line. */
export function CartItemControls({
  itemId,
  quantity,
}: {
  itemId: string;
  quantity: number;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // Sends the new quantity to the server, then Next refreshes the page.
  async function change(newQuantity: number) {
    setBusy(true);
    setError("");
    const result = await updateQuantity(itemId, newQuantity);
    if ("error" in result) setError(result.error);
    setBusy(false);
  }

  async function remove() {
    setBusy(true);
    setError("");
    const result = await removeItem(itemId);
    if ("error" in result) setError(result.error);
    setBusy(false);
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-3">
        <div className="flex items-center rounded border">
          <button
            onClick={function () {
              change(quantity - 1);
            }}
            disabled={busy}
            className="px-3 py-1 hover:bg-gray-100 disabled:opacity-40 dark:hover:bg-white/10"
            aria-label="Decrease quantity"
          >
            −
          </button>
          <span className="w-10 text-center text-sm">{quantity}</span>
          <button
            onClick={function () {
              change(quantity + 1);
            }}
            disabled={busy || quantity >= 99}
            className="px-3 py-1 hover:bg-gray-100 disabled:opacity-40 dark:hover:bg-white/10"
            aria-label="Increase quantity"
          >
            +
          </button>
        </div>

        <button
          onClick={remove}
          disabled={busy}
          className="text-sm text-gray-500 underline disabled:opacity-40 dark:text-white/60"
        >
          Remove
        </button>
      </div>
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
