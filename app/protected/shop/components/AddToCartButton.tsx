"use client"; 

import { useState } from "react"; 
import { addToCart } from "../actions/cart";

export function AddToCartButton({
  productId,
  sizes,
}: {
  productId: number;
  sizes: string | null;
}) {
  // The sizes column holds "S, M, L" — split it into a list.
  const sizeOptions = sizes
    ? sizes.split(",").map(function (s) {
        return s.trim();
      })
    : [];

  const [selectedSize, setSelectedSize] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleClick() {
    // If this product has sizes, one must be chosen.
    if (sizeOptions.length > 0 && !selectedSize) {
      setStatus("Please choose a size first.");
      return;
    }

    setBusy(true);
    setStatus("");

    const result = await addToCart(productId, selectedSize || null);

    setBusy(false);
    setStatus(result.error ? result.error : "Added to your order.");
  }

  return (
    <div className="mt-8">
      {sizeOptions.length > 0 ? (
        <div className="mb-3">
          <label className="mb-1 block text-sm text-gray-600">Size</label>
          <select
            value={selectedSize}
            onChange={function (e) {
              setSelectedSize(e.target.value);
              setStatus("");
            }}
            className="w-full rounded-lg border px-3 py-2"
          >
            <option value="">Choose a size</option>
            {sizeOptions.map(function (s) {
              return (
                <option key={s} value={s}>
                  {s}
                </option>
              );
            })}
          </select>
        </div>
      ) : null}

      <button
        onClick={handleClick}
        disabled={busy}
        className="w-full rounded-lg bg-black px-4 py-3 text-white disabled:bg-gray-400"
      >
        {busy ? "Adding..." : "Add to order"}
      </button>

      {status ? <p className="mt-2 text-sm text-gray-600">{status}</p> : null}
    </div>
  );
}