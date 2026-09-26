import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { CartItemControls } from "../components/CartItemControls";
import { SubmitOrderButton } from "../components/SubmitOrderButton";

export default async function CartPage() {
  const supabase = await createClient();

  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) {
    redirect("/auth/login?next=%2Fprotected%2Fshop%2Fcart");
  }

  // Find this user's draft order — their cart.
  const { data: order } = await supabase
    .from("orders")
    .select("id")
    .eq("user_id", auth.user.id)
    .eq("status", "draft")
    .maybeSingle();

  if (!order) {
    return (
      <div>
        <h1 className="mb-6 text-2xl font-semibold text-foreground">
          Your order
        </h1>
        <p className="text-muted-foreground">Your order is empty.</p>
        <Link
          href="/protected/shop"
          className="mt-4 inline-block underline underline-offset-4"
        >
          Browse the catalogue
        </Link>
      </div>
    );
  }

  // Get the items, pulling each product's name and code along with them.
  const { data: items } = await supabase
    .from("order_items")
    .select(
      "id, quantity, size, handedness, unit_price, products (item_code, name)"
    )
    .eq("order_id", order.id)
    .order("created_at");

  const lines = items ?? [];

  let total = 0;
  for (const line of lines) {
    total = total + Number(line.unit_price) * line.quantity;
  }

  if (lines.length === 0) {
    return (
      <div>
        <h1 className="mb-6 text-2xl font-semibold text-foreground">
          Your order
        </h1>
        <p className="text-muted-foreground">Your order is empty.</p>
        <Link
          href="/protected/shop"
          className="mt-4 inline-block underline underline-offset-4"
        >
          Browse the catalogue
        </Link>
      </div>
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
        className="flex items-center justify-between border-b border-border py-4"
      >
        <div>
          <p className="font-mono text-xs text-muted-foreground">
            {product?.item_code}
          </p>
          <p className="font-medium text-foreground">{product?.name}</p>

          {line.size ? (
            <p className="text-sm text-muted-foreground">Size: {line.size}</p>
          ) : null}

          {line.handedness ? (
            <p className="text-sm text-muted-foreground">
              {line.handedness === "right" ? "Right handed" : "Left handed"}
            </p>
          ) : null}

          <p className="mt-1 text-sm text-muted-foreground">
            R{Number(line.unit_price).toFixed(2)} each
          </p>
        </div>

        <div className="flex items-center gap-6">
          <CartItemControls itemId={line.id} quantity={line.quantity} />
          <p className="w-24 text-right font-semibold text-foreground">
            R{lineTotal.toFixed(2)}
          </p>
        </div>
      </div>
    );
  });

  return (
    <div className="mx-auto max-w-3xl">
      <Link
        href="/protected/shop"
        className="text-sm text-muted-foreground underline underline-offset-4"
      >
        Back to catalogue
      </Link>

      <h1 className="mb-6 mt-4 text-2xl font-semibold text-foreground">
        Your order
      </h1>

      <div className="rounded-2xl border border-border bg-card/80 p-5 backdrop-blur-sm">
        <div className="border-t border-border">{rows}</div>

        <div className="mt-6 flex items-center justify-between">
          <p className="text-lg text-foreground">Total</p>
          <p className="text-xl font-semibold text-foreground">
            R{total.toFixed(2)}
          </p>
        </div>
      </div>

      <SubmitOrderButton />
    </div>
  );
}