import { createClient } from "@/lib/supabase/server";
import { StatusControls } from "./StatusControls";
import { ExportButtons } from "./ExportButtons";
import { SupplierSheetPanel } from "./SupplierSheetPanel";
import { getSheetsForBulkOrders } from "@/lib/repositories/supplier-sheet-repository";
import { toSheetView } from "@/lib/services/supplier-sheet-view";
import { formatRandsWithCents } from "@/lib/money";

const STATUS_LABELS: Record<string, string> = {
  collecting: "Collecting orders",
  placed: "Placed with supplier",
  shipping: "In transit",
  arrived: "Arrived in SA",
  distributed: "Distributed",
  cancelled: "Cancelled",
};


// Only paid orders count towards the threshold and go to the supplier.
// 'submitted' orders joined bulk orders before checkout existed and were
// never paid.
function orderBadge(status: string) {
  if (status === "paid") {
    return {
      label: "Paid",
      className: "bg-green-100 text-green-800 dark:bg-green-500/20 dark:text-green-300",
    };
  }
  if (status === "submitted") {
    return {
      label: "Unpaid (legacy)",
      className: "bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300",
    };
  }
  return {
    label: status === "cancelled" ? "Cancelled" : "Unpaid",
    className: "bg-muted text-muted-foreground",
  };
}

/**
 * /protected/admin/bulk-orders: each bulk order with its paid customer
 * orders, status controls, CSV exports and the supplier sheet workflow.
 */
export default async function BulkOrdersPage() {
  const supabase = await createClient();

  // The admin layout already checks permissions, so no auth check here.
  const { data: bulkOrders } = await supabase
    .from("bulk_orders")
    .select(
      "id, reference, status, threshold, placed_at, estimated_arrival, created_at, orders (id, user_id, status, created_at, profiles (full_name, email), order_items (quantity, unit_price, size, handedness, products (item_code, name)))"
    )
    .order("created_at", { ascending: false });

  const list = bulkOrders ?? [];
  const sheets = await getSheetsForBulkOrders(list.map((bulk) => bulk.id));

  const cards = list.map(function (bulk) {
    const orders = bulk.orders ?? [];
    const paidOrders = orders.filter(function (order) {
      return order.status === "paid";
    });
    const legacyUnpaidCount = orders.filter(function (order) {
      return order.status === "submitted";
    }).length;

    let total = 0;
    let itemCount = 0;
    for (const order of paidOrders) {
      for (const line of order.order_items ?? []) {
        total = total + Number(line.unit_price) * line.quantity;
        itemCount = itemCount + line.quantity;
      }
    }

    const threshold = Number(bulk.threshold);
    const percent =
      threshold > 0 ? Math.min(100, Math.round((total / threshold) * 100)) : 100;

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
            {" "}&times; {line.quantity}
          </p>
        );
      });

      const badge = orderBadge(order.status);

      return (
        <div key={order.id} className="border-t border-border py-3">
          <div className="flex justify-between gap-2">
            <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
              {profile?.full_name || profile?.email || "Unknown customer"}
              <span
                className={
                  "rounded-full px-2 py-0.5 text-xs font-medium " + badge.className
                }
              >
                {badge.label}
              </span>
            </p>
            <p className="text-sm font-semibold">{formatRandsWithCents(orderTotal)}</p>
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
            <p className="text-xl font-semibold">{formatRandsWithCents(total)}</p>
            <p className="text-sm text-muted-foreground">
              of {formatRandsWithCents(threshold)} paid
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
          {paidOrders.length} paid order{paidOrders.length === 1 ? "" : "s"} &middot;{" "}
          {itemCount} item{itemCount === 1 ? "" : "s"}
          {total >= threshold ? " · threshold reached" : ""}
        </p>

        {legacyUnpaidCount > 0 ? (
          <p className="mt-1 text-sm text-amber-700 dark:text-amber-300">
            {legacyUnpaidCount} legacy unpaid order
            {legacyUnpaidCount === 1 ? " is" : "s are"} not counted and not exported.
          </p>
        ) : null}

        {orders.length > 0 ? (
          <div className="mt-4">{customerRows}</div>
        ) : (
          <p className="mt-4 text-sm text-muted-foreground">No orders yet.</p>
        )}

        <ExportButtons bulkOrderId={bulk.id} />

        <SupplierSheetPanel
          bulkOrderId={bulk.id}
          bulkStatus={bulk.status}
          thresholdReached={total >= threshold}
          sheet={sheets.has(bulk.id) ? toSheetView(sheets.get(bulk.id)!) : null}
        />

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