import { getBulkProgress } from "@/lib/services/shop-order-service";

const zar = new Intl.NumberFormat("en-ZA", { style: "currency", currency: "ZAR" });

function formatCents(cents: number) {
  return zar.format(cents / 100);
}

// Shown to customers on the catalogue. Shows how close the collecting bulk
// order is to its threshold. Only paid orders count, and the total comes
// from a database function so no customer's order rows are exposed.
export async function BulkOrderProgress() {
  const progress = await getBulkProgress();

  if (!progress) {
    return null;
  }

  const { percent, reached, totalCents, thresholdCents } = progress;
  const leftCents = Math.max(0, thresholdCents - totalCents);

  return (
    <div className="mb-6 rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className="text-sm font-medium text-card-foreground">
          {reached ? "Next order ready to place" : "Next equipment order"}
        </p>
        <p className="text-sm text-muted-foreground">
          {reached
            ? "Threshold reached, order going in soon"
            : formatCents(leftCents) + " left until next order"}
        </p>
      </div>

      <div
        role="progressbar"
        aria-label="Progress to the next bulk order"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        className="mt-3 h-6 overflow-hidden rounded-full bg-muted"
      >
        <div
          className={
            "bulk-progress-fill h-full rounded-full " +
            (reached ? "bg-green-600" : "bg-primary")
          }
          style={{ width: percent + "%" }}
        />
      </div>

      <p className="mt-2 text-sm text-muted-foreground">
        {reached
          ? "The threshold has been reached. CFA will place this order with the supplier shortly."
          : "CFA places a bulk order with the supplier once enough paid orders have come in. Your items join the next one once payment is confirmed."}
      </p>
    </div>
  );
}
