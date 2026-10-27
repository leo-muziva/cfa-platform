"use client";

import { useRef, useState } from "react";
import { addToCart } from "../actions/cart";

export function AddToCartButton({
  productId,
  sizes,
  needsHandedness,
}: {
  productId: number;
  sizes: string | null;
  needsHandedness: boolean;
}) {
  // The sizes column holds "S, M, L" — split it into a list.
  const sizeOptions = sizes
    ? sizes.split(",").map(function (s) {
        return s.trim();
      })
    : [];

  const [selectedSize, setSelectedSize] = useState("");
  const [hand, setHand] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  // blocks a second click before React has re-rendered the disabled button
  const busyRef = useRef(false);

  async function handleClick() {
    if (busyRef.current) return;
    // Both choices are required where the product needs them —
    // the supplier can't fulfil a jacket without knowing the hand.
    if (sizeOptions.length > 0 && !selectedSize) {
      setStatus("Please choose a size first.");
      return;
    }
    if (needsHandedness && !hand) {
      setStatus("Please choose right or left handed.");
      return;
    }

    busyRef.current = true;
    setBusy(true);
    setStatus("");

    try {
      const result = await addToCart(
        productId,
        selectedSize || null,
        hand || null
      );
      setStatus("error" in result ? result.error : "Added to your cart.");
    } catch {
      setStatus("Could not add that to your cart. Please try again.");
    } finally {
      // always clear "Adding...", even if the request failed
      busyRef.current = false;
      setBusy(false);
    }
  }

  return (
    <div className="mt-8">
      {sizeOptions.length > 0 ? (
        <div className="mb-4">
          <label
            htmlFor="size"
            className="mb-1 block text-sm text-muted-foreground"
          >
            Size
          </label>
          <select
            id="size"
            value={selectedSize}
            onChange={function (e) {
              setSelectedSize(e.target.value);
              setStatus("");
            }}
            className="w-full rounded-xl border border-border bg-card px-3 py-2 text-sm text-foreground"
          >
            <option value="" className="bg-card">
              Choose a size
            </option>
            {sizeOptions.map(function (s) {
              return (
                <option key={s} value={s} className="bg-card">
                  {s}
                </option>
              );
            })}
          </select>
        </div>
      ) : null}

      {/* Radio buttons rather than a dropdown — only two choices,
          and both are visible at once. */}
      {needsHandedness ? (
        <fieldset className="mb-4">
          <legend className="mb-1 text-sm text-muted-foreground">
            Handedness
          </legend>
          <div className="flex gap-5">
            <label className="flex cursor-pointer items-center gap-2 text-sm text-foreground">
              <input
                type="radio"
                name="handedness"
                value="right"
                checked={hand === "right"}
                onChange={function () {
                  setHand("right");
                  setStatus("");
                }}
                className="h-4 w-4"
              />
              Right
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-sm text-foreground">
              <input
                type="radio"
                name="handedness"
                value="left"
                checked={hand === "left"}
                onChange={function () {
                  setHand("left");
                  setStatus("");
                }}
                className="h-4 w-4"
              />
              Left
            </label>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            The hand you hold your weapon in.
          </p>
        </fieldset>
      ) : null}

      <button
        onClick={handleClick}
        disabled={busy}
        className="w-full rounded-xl bg-primary px-4 py-3 text-primary-foreground hover:opacity-90 disabled:opacity-50"
      >
        {busy ? "Adding..." : "Add to cart"}
      </button>

      {status ? (
        <p role="status" className="mt-2 text-sm text-muted-foreground">
          {status}
        </p>
      ) : null}
    </div>
  );
}