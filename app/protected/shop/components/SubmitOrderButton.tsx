"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { submitOrder } from "../actions/cart";

export function SubmitOrderButton() {
  const router = useRouter();
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit() {
    setBusy(true);
    setError("");

    const result = await submitOrder(notes);

    if (result.error) {
      setError(result.error);
      setBusy(false);
      return;
    }

    // Worked — send them to their order history.
    router.push("/protected/shop/orders?submitted=1");
  }

  return (
    <div className="mt-8">
      <label className="mb-1 block text-sm text-gray-600">
        Notes for CFA (optional)
      </label>
      <textarea
        value={notes}
        onChange={function (e) {
          setNotes(e.target.value);
        }}
        rows={3}
        placeholder="Anything CFA should know about this order"
        className="w-full rounded-lg border px-3 py-2 text-sm"
      />

      <button
        onClick={handleSubmit}
        disabled={busy}
        className="mt-3 w-full rounded-lg bg-black px-4 py-3 text-white disabled:bg-gray-400"
      >
        {busy ? "Submitting..." : "Submit order"}
      </button>

      {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}

      <p className="mt-3 text-xs text-gray-500">
        Your items join CFA&apos;s next bulk order. You will be notified when it
        is placed.
      </p>
    </div>
  );
}