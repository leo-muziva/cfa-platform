"use client";

import { useState } from "react";
import { exportForSupplier, exportForDistribution } from "./actions";

export function ExportButtons({ bulkOrderId }: { bulkOrderId: string }) {
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  // Takes the CSV text the server built and makes the browser download it.
  function download(filename: string, csv: string) {
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function run(which: string) {
    setBusy(which);
    setError("");

    const result =
      which === "supplier"
        ? await exportForSupplier(bulkOrderId)
        : await exportForDistribution(bulkOrderId);

    if (result.error) {
      setError(result.error);
    } else if (result.csv && result.filename) {
      download(result.filename, result.csv);
    }

    setBusy("");
  }

  return (
    <div className="mt-3 flex flex-wrap gap-2">
      <button
        onClick={function () {
          run("supplier");
        }}
        disabled={busy !== ""}
        className="rounded-lg border px-4 py-2 text-sm hover:bg-gray-50 disabled:opacity-40"
      >
        {busy === "supplier" ? "Building..." : "Export for supplier"}
      </button>

      <button
        onClick={function () {
          run("distribution");
        }}
        disabled={busy !== ""}
        className="rounded-lg border px-4 py-2 text-sm hover:bg-gray-50 disabled:opacity-40"
      >
        {busy === "distribution" ? "Building..." : "Export for distribution"}
      </button>

      {error ? <p className="w-full text-sm text-red-600">{error}</p> : null}
    </div>
  );
}