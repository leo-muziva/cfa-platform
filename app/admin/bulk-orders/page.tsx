import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
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

  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) {
    redirect("/auth/login?next=%2Fadmin%2Fbulk-orders");
  }

  // Only admins get in.
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", auth.user.id)
    .single();

  if (profile?.role !== "admin") {
    return (
      <main className="mx-auto max-w-3xl p-8">
        <h1 className="text-2xl font-semibold">Not authorised</h1>
        <p className="mt-2 text-gray-600">
          This page is for CFA administrators.
        </p>
      </main>
    );
  }

  // Every bulk order, newest first, with the customer orders inside each.
  const { data: bulkOrders } = await supabase
    .from("bulk_orders")
    .select(
      "id, reference, status, threshold, placed_at, estimated_arrival, created_at, orders (id, user_id, created_at, profiles (full_name, email), order_items (quantity, unit_price, size, products (item_code, name)))"
    )
    .order("created_at", { ascending: false });

  const list = bulkOrders ?? [];

  const cards = list.map(function (bulk) {
    const orders = bulk.orders ?? [];

    // Add up everything in this bulk order.
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
          <p key={i} className="text-xs text-gray-600">
            {product?.item_code} {product?.name}
            {line.size ? " (" + line.size + ")" : ""} × {line.quantity}
          </p>
        );
      });

      return (
        <div key={order.id} className="border-t py-3">
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
      <div key={bulk.id} className="mb-6 rounded-lg border p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="font-mono text-xs text-gray-500">{bulk.reference}</p>
            <p className="mt-1 text-lg font-medium">
              {STATUS_LABELS[bulk.status] ?? bulk.status}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xl font-semibold">R{total.toFixed(2)}</p>
            <p className="text-sm text-gray-500">
              of R{threshold.toFixed(2)}
            </p>
          </div>
        </div>

        <div className="mt-3 h-2 overflow-hidden rounded-full bg-gray-200">
          <div
            className={
              "h-full rounded-full " +
              (total >= threshold ? "bg-green-600" : "bg-gray-900")
            }
            style={{ width: percent + "%" }}
          />
        </div>

        <p className="mt-2 text-sm text-gray-600">
          {orders.length} order{orders.length === 1 ? "" : "s"} · {itemCount}{" "}
          item{itemCount === 1 ? "" : "s"}
          {total >= threshold ? " · threshold reached" : ""}
        </p>

        {orders.length > 0 ? (
          <div className="mt-4">{customerRows}</div>
        ) : (
          <p className="mt-4 text-sm text-gray-500">No orders yet.</p>
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
    <main className="mx-auto max-w-4xl p-8">
      <h1 className="mb-6 text-2xl font-semibold">Bulk orders</h1>
      {list.length === 0 ? (
        <p className="text-gray-500">No bulk orders yet.</p>
      ) : (
        cards
      )}
    </main>
  );
}