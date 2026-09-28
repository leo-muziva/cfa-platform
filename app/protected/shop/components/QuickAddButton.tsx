"use client";

import { useState } from "react";
import { ShoppingCart, Check } from "lucide-react";
import { addToCart } from "../actions/cart";

// The small cart button on a product card.
// Only used for products with no sizes — anything sized has to go
// to the detail page so the customer can choose one.
export function QuickAddButton({ productId }: { productId: number }) {
  const [state, setState] = useState<"idle" | "busy" | "done">("idle");

  async function handleClick() {
    setState("busy");
    const result = await addToCart(productId, null);
    setState(result.error ? "idle" : "done");
    // Return to the normal icon after a moment.
    if (!result.error) {
      setTimeout(function () {
        setState("idle");
      }, 1500);
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={state === "busy"}
      aria-label="Add to order"
      className={
        "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border transition " +
        (state === "done"
          ? "border-green-600 bg-green-50 text-green-700 dark:border-green-400 dark:bg-green-950/40 dark:text-green-300"
          : "border-slate-300 hover:border-slate-900 hover:bg-slate-900 hover:text-white dark:border-white/40 dark:hover:border-violet-300 dark:hover:bg-violet-600 dark:hover:text-white")
      }
    >
      {state === "done" ? (
        <Check className="h-5 w-5" />
      ) : (
        <ShoppingCart className="h-5 w-5" />
      )}
    </button>
  );
}