import { createClient } from "@/lib/supabase/server";

// Shown to customers on the catalogue. Reads the bulk order that is
// currently collecting and shows how close it is to the threshold.
export async function BulkOrderProgress() {
  const supabase = await createClient();

  // There is only ever one collecting bulk order, so this is a single query.
  const { data: bulk } = await supabase
    .from("bulk_orders")
    .select("id, reference, threshold, orders (order_items (quantity, unit_price))")
    .eq("status", "collecting")
    .maybeSingle();

  if (!bulk) {
    return null;
  }

  // Add up everything customers have submitted into it so far.
  let total = 0;
  for (const order of bulk.orders ?? []) {
    for (const line of order.order_items ?? []) {
      total = total + Number(line.unit_price) * line.quantity;
    }
  }

  const threshold = Number(bulk.threshold);
  const percent = Math.min(100, Math.round((total / threshold) * 100));
  const reached = total >= threshold;
  //const remaining = threshold - total; 

    return (
    <div className="mb-6 rounded-xl border bg-gray-50 p-4">
      <div className="flex items-baseline justify-between">
        <p className="text-sm font-medium">
          {reached ? "Next order ready to place" : "Next equipment order"}
        </p>
        <p className="text-sm text-gray-600">{percent}% to next order</p>
      </div>

      <div className="mt-3 h-2 overflow-hidden rounded-full bg-gray-200">
        <div
          className={
            "h-full rounded-full transition-all " +
            (reached ? "bg-green-600" : "bg-gray-900")
          }
          style={{ width: percent + "%" }}
        />
      </div>

      <p className="mt-2 text-sm text-gray-600">
        {reached
          ? "The threshold has been reached. CFA will place this order with the supplier shortly."
          : "CFA places a bulk order with the supplier once enough orders have come in. Your items join the next one."}
      </p>
    </div>
  );
}