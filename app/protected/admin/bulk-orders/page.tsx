import { createClient } from "@/lib/supabase/server";
import { StatusControls } from "./StatusControls";
import { ExportButtons } from "./ExportButtons";

const STATUS_LABELS: Record<string, string> = {
  collecting: "Collecting orders",
  placed: "Placed with supplier",
  shipping: "In transit",
  arrived: "Arrived in SA",
  distributed: "Distributed",
  cancelled: "Cancelled",
};

export default async function BulkOrdersPage() {
  const supabase = await createClient();

  // The admin layout already checks permissions, so no auth check here.
  const { data: bulkOrders } = await supabase
    .from("bulk_orders")
    .select(
      "id, reference, status, threshold, placed_at, estimated_arrival, created_at, orders (id, user_id, created_at, profiles (full_name, email), order_items (quantity, unit_price, size, handedness, products (item_code, name)))"
    
    )
    .order("created_at", { ascending: false });

  const list = bulkOrders ?? [];

  const cards = list.map(function (bulk) {
    const orders = bulk.orders ?? [];

    let total = 0;
    let itemCount = 0;
    for (const order of orders) {
      for (const line of order.order_items ?? []) {
        total = total + Number(line.unit_price) * line.quantity;
        itemCount = itemCount + line.quantity;
      }
    }

    const threshold = Number(bulk.threshold);
    const percent = Math.min(100, Math.round((total / threshold) * 100));

    const customerRows = orders.map(function (order) {
      const profile = Array.isArray(order.profiles)
        ? order.profiles[0]
        : order.profiles;

      let orderTotal = 0;
      for (const line of order.order_items ?? []) {
        orderTotal = orderTotal + Number(line.unit_price) * line.quantity;
      }

      const itemLines = (order.order_items ?? []).map(function (line, i) {
        const product = Array.isArray(line.products)
          ? line.products[0]
          : line.products;
        return (
          <p key={i} className="text-xs text-muted-foreground">
            {product?.item_code} {product?.name}
            {line.size ? " (" + line.size + ")" : ""}
             {line.handedness ? " " + (line.handedness === "right" ? "RH" : "LH") : ""}
              &times; {line.quantity}
          
          </p>
        );
      });

      return (
        <div key={order.id} className="border-t border-border py-3">
          <div className="flex justify-between">
            <p className="text-sm font-medium">
              {profile?.full_name || profile?.email || "Unknown customer"}
            </p>
            <p className="text-sm font-semibold">R{orderTotal.toFixed(2)}</p>
          </div>
          <div className="mt-1">{itemLines}</div>
        </div>
      );
    });

    return (
      <div
        key={bulk.id}
        className="mb-6 rounded-xl border border-border bg-card p-5"
      >
        <div className="flex items-start justify-between">
          <div>
            <p className="font-mono text-xs text-muted-foreground">
              {bulk.reference}
            </p>
            <p className="mt-1 text-lg font-medium">
              {STATUS_LABELS[bulk.status] ?? bulk.status}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xl font-semibold">R{total.toFixed(2)}</p>
            <p className="text-sm text-muted-foreground">
              of R{threshold.toFixed(2)}
            </p>
          </div>
        </div>

        <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
          <div
            className={
              "h-full rounded-full " +
              (total >= threshold ? "bg-green-600" : "bg-primary")
            }
            style={{ width: percent + "%" }}
          />
        </div>

        <p className="mt-2 text-sm text-muted-foreground">
          {orders.length} order{orders.length === 1 ? "" : "s"} &middot;{" "}
          {itemCount} item{itemCount === 1 ? "" : "s"}
          {total >= threshold ? " · threshold reached" : ""}
        </p>

        {orders.length > 0 ? (
          <div className="mt-4">{customerRows}</div>
        ) : (
          <p className="mt-4 text-sm text-muted-foreground">No orders yet.</p>
        )}

        <ExportButtons bulkOrderId={bulk.id} />

        <StatusControls
          bulkOrderId={bulk.id}
          status={bulk.status}
          estimatedArrival={bulk.estimated_arrival}
        />
      </div>
    );
  });

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold">Bulk orders</h1>
      {list.length === 0 ? (
        <p className="text-muted-foreground">No bulk orders yet.</p>
      ) : (
        cards
      )}
    </div>
  );
}