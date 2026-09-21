import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { CartItemControls } from "../components/CartItemControls";
import { SubmitOrderButton } from "../components/SubmitOrderButton";

export default async function CartPage() {
  const supabase = await createClient();

  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) {
    redirect("/auth/login?next=%2Fshop%2Fcart");
  }

  // Find this user's draft order — their cart.
  // maybeSingle() gives null instead of erroring when there isn't one.
  const { data: order } = await supabase
    .from("orders")
    .select("id")
    .eq("user_id", auth.user.id)
    .eq("status", "draft")
    .maybeSingle();

  // No cart yet, so nothing to show.
  if (!order) {
    return (
      <main className="mx-auto max-w-3xl p-8">
        <h1 className="mb-6 text-2xl font-semibold">Your order</h1>
        <p className="text-gray-500">Your order is empty.</p>
        <a href="/protected/shop" className="mt-4 inline-block underline">
          Browse the catalogue
        </a>
      </main>
    );
  }

  // Get the items, and pull the product name and code along with each one.
  // The "products (...)" part follows the foreign key to fetch related data.
  const { data: items } = await supabase
    .from("order_items")
    .select("id, quantity, size, unit_price, products (item_code, name)")
    .eq("order_id", order.id)
    .order("created_at");

  const lines = items ?? [];

  // Add up the total.
  let total = 0;
  for (const line of lines) {
    total = total + Number(line.unit_price) * line.quantity;
  }

  if (lines.length === 0) {
    return (
      <main className="mx-auto max-w-3xl p-8">
        <h1 className="mb-6 text-2xl font-semibold">Your order</h1>
        <p className="text-gray-500">Your order is empty.</p>
        <a href="/protected/shop" className="mt-4 inline-block underline">
          Browse the catalogue
        </a>
      </main>
    );
  }

  const rows = lines.map(function (line) {
    // Supabase types related data as an array, so pull out the first entry.
    const product = Array.isArray(line.products)
      ? line.products[0]
      : line.products;
    const lineTotal = Number(line.unit_price) * line.quantity;

    return (
      <div
        key={line.id}
        className="flex items-center justify-between border-b py-4"
      >
        <div>
          <p className="font-mono text-xs text-gray-500">
            {product?.item_code}
          </p>
          <p className="font-medium">{product?.name}</p>
          {line.size ? (
            <p className="text-sm text-gray-600">Size: {line.size}</p>
          ) : null}
          <p className="mt-1 text-sm text-gray-500">
            R{Number(line.unit_price).toFixed(2)} each
          </p>
        </div>

        <div className="flex items-center gap-6">
          <CartItemControls itemId={line.id} quantity={line.quantity} />
          <p className="w-24 text-right font-semibold">
            R{lineTotal.toFixed(2)}
          </p>
        </div>
      </div>
    );
  });

  return (
    <main className="mx-auto max-w-3xl p-8">
      <a href="/protected/shop" className="text-sm text-gray-500 underline">
        Back to catalogue
      </a>

      <h1 className="mb-6 mt-4 text-2xl font-semibold">Your order</h1>

      <div className="border-t">{rows}</div>

      <div className="mt-6 flex items-center justify-between">
        <p className="text-lg">Total</p>
        <p className="text-xl font-semibold">R{total.toFixed(2)}</p>
      </div>

            <SubmitOrderButton />
    </main>
  );
}