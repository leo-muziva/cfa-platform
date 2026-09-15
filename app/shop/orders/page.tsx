import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

// Friendly labels for the status values stored in the database.
const STATUS_LABELS: Record<string, string> = {
  submitted: "Waiting for next bulk order",
  cancelled: "Cancelled",
};

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ submitted?: string }>;
}) {
  const sp = await searchParams;
  const supabase = await createClient();

  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) {
    redirect("/auth/login?next=%2Fshop%2Forders");
  }

  // Get every order except the draft one, newest first.
  // The draft is their current cart, so it belongs on the cart page instead.
  // RLS means this only ever returns their own orders.
  const { data: orders } = await supabase
    .from("orders")
    .select(
      "id, status, notes, created_at, order_items (id, quantity, size, unit_price, products (item_code, name))"
    )
    .eq("user_id", auth.user.id)
    .neq("status", "draft")
    .order("created_at", { ascending: false });

  const list = orders ?? [];

  const cards = list.map(function (order) {
    const items = order.order_items ?? [];

    let total = 0;
    for (const line of items) {
      total = total + Number(line.unit_price) * line.quantity;
    }

    // Turn the stored date into something readable.
    const date = new Date(order.created_at).toLocaleDateString("en-ZA", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });

    const lines = items.map(function (line) {
      const product = Array.isArray(line.products)
        ? line.products[0]
        : line.products;

      return (
        <div key={line.id} className="flex justify-between py-1 text-sm">
          <span>
            <span className="font-mono text-xs text-gray-500">
              {product?.item_code}
            </span>{" "}
            {product?.name}
            {line.size ? " (" + line.size + ")" : ""}
            {line.quantity > 1 ? " × " + line.quantity : ""}
          </span>
          <span>R{(Number(line.unit_price) * line.quantity).toFixed(2)}</span>
        </div>
      );
    });

    return (
      <div key={order.id} className="mb-4 rounded-lg border p-4">
        <div className="mb-3 flex items-start justify-between">
          <div>
            <p className="text-sm text-gray-500">{date}</p>
            <p className="mt-1 font-medium">
              {STATUS_LABELS[order.status] ?? order.status}
            </p>
          </div>
          <p className="font-semibold">R{total.toFixed(2)}</p>
        </div>

        <div className="border-t pt-2">{lines}</div>

        {order.notes ? (
          <p className="mt-3 border-t pt-2 text-sm text-gray-600">
            Your note: {order.notes}
          </p>
        ) : null}
      </div>
    );
  });

  return (
    <main className="mx-auto max-w-3xl p-8">
      <a href="/shop" className="text-sm text-gray-500 underline">
        Back to catalogue
      </a>

      <h1 className="mb-6 mt-4 text-2xl font-semibold">Your orders</h1>

      {/* Shown once, right after submitting. */}
      {sp.submitted ? (
        <div className="mb-6 rounded-lg border border-green-600 bg-green-50 p-4">
          <p className="font-medium text-green-900">Order submitted</p>
          <p className="mt-1 text-sm text-green-800">
            Your items will be included in CFA&apos;s next bulk order.
          </p>
        </div>
      ) : null}

      {list.length === 0 ? (
        <p className="text-gray-500">You have not placed any orders yet.</p>
      ) : (
        cards
      )}
    </main>
  );
}