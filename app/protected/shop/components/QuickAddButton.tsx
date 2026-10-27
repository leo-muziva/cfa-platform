"use client";

import { useRef, useState } from "react";
import { ShoppingCart, Check } from "lucide-react";
import { addToCart } from "../actions/cart";

// The small cart button on a product card.
// Only used for products with no sizes and no handedness. Anything that
// needs a choice goes to the detail page so the customer can make it.
export function QuickAddButton({ productId }: { productId: number }) {
  const [state, setState] = useState<"idle" | "busy" | "done">("idle");
  const [error, setError] = useState("");
  // blocks a second click before React has re-rendered the disabled button
  const busyRef = useRef(false);

  async function handleClick() {
    if (busyRef.current) return;
    busyRef.current = true;
    setState("busy");
    setError("");
    try {
      const result = await addToCart(productId, null, null);
      if ("error" in result) {
        setError(result.error);
        setState("idle");
        return;
      }
      setState("done");
      // Return to the normal icon after a moment.
      setTimeout(function () {
        setState("idle");
      }, 1500);
    } catch {
      setError("Could not add that to your cart. Please try again.");
      setState("idle");
    } finally {
      busyRef.current = false;
    }
  }

  return (
    <div className="relative flex shrink-0 flex-col items-end">
      <button
        onClick={handleClick}
        disabled={state === "busy"}
        aria-label="Add to cart"
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
      {error ? (
        <p
          role="alert"
          className="absolute right-0 top-full z-10 mt-1 w-48 rounded-lg border border-border bg-card p-2 text-right text-xs text-red-600 shadow-sm dark:text-red-400"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
