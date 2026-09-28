import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { statusView } from "./orderStatus";

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ submitted?: string; show?: string }>;
}) {
  const sp = await searchParams;
  const supabase = await createClient();

  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) {
    redirect("/auth/login?next=%2Fprotected%2Fshop%2Forders");
  }

  // Which filter is active. Blank means show everything.
  const show = sp.show ?? "";

  // Fetch the orders, their items, and the bulk order each one joined.
  // That last part is what lets us show the real status instead of
  // a fixed label.
  const { data: orders } = await supabase
    .from("orders")
    .select(
      "id, status, notes, created_at, bulk_orders (status, estimated_arrival), order_items (id, quantity, size, handedness, unit_price, products (item_code, name))"
    )
    .eq("user_id", auth.user.id)
    .neq("status", "draft")
    .order("created_at", { ascending: false });

  const all = orders ?? [];

  // Work out each order's status and total once, so the filter and the
  // display both use the same answer.
  const decorated = all.map(function (order) {
    // Supabase types a joined row as an array, so take the first entry.
    const bulk = Array.isArray(order.bulk_orders)
      ? order.bulk_orders[0]
      : order.bulk_orders;

    const view = statusView(order.status, bulk?.status ?? null);

    let total = 0;
    for (const line of order.order_items ?? []) {
      total = total + Number(line.unit_price) * line.quantity;
    }

    return { order, bulk, view, total };
  });

  // Counts for the filter buttons.
  const readyCount = decorated.filter(function (d) {
    return d.view.group === "ready";
  }).length;
  const progressCount = decorated.length - readyCount;

  const list = show
    ? decorated.filter(function (d) {
        return d.view.group === show;
      })
    : decorated;

  // Each filter button is just a link with a different web address.
  const filters = [
    { key: "", label: "All orders", count: decorated.length },
    { key: "progress", label: "In progress", count: progressCount },
    { key: "ready", label: "Ready to collect", count: readyCount },
  ];

  const cards = list.map(function (d) {
    const { order, bulk, view, total } = d;

    const date = new Date(order.created_at).toLocaleDateString("en-ZA", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });

    // Only worth showing the expected date while it's still coming.
    const arrival =
      bulk?.estimated_arrival && view.group === "progress"
        ? new Date(bulk.estimated_arrival).toLocaleDateString("en-ZA", {
            day: "numeric",
            month: "long",
          })
        : null;

    const lines = (order.order_items ?? []).map(function (line) {
      const product = Array.isArray(line.products)
        ? line.products[0]
        : line.products;

      return (
        <div key={line.id} className="flex justify-between py-1 text-sm">
          <span className="text-foreground">
            <span className="font-mono text-xs text-muted-foreground">
              {product?.item_code}
            </span>{" "}
            {product?.name}
            {line.size ? " (" + line.size + ")" : ""}
            {line.handedness
              ? " " + (line.handedness === "right" ? "RH" : "LH")
              : ""}
            {line.quantity > 1 ? " × " + line.quantity : ""}
          </span>
          <span className="text-foreground">
            R{(Number(line.unit_price) * line.quantity).toFixed(2)}
          </span>
        </div>
      );
    });

    return (
      <div
        key={order.id}
        className="mb-3 rounded-2xl border border-border bg-card/80 p-5 backdrop-blur-sm"
      >
        <div className="mb-3 flex items-start justify-between gap-4">
          <div>
            <p className="text-sm text-muted-foreground">{date}</p>

            <span
              className={
                "mt-1.5 inline-block rounded-lg px-2.5 py-1 text-xs font-medium " +
                view.tone
              }
            >
              {view.label}
            </span>

            {arrival ? (
              <p className="mt-2 text-sm text-muted-foreground">
                Expected to arrive {arrival}
              </p>
            ) : view.note ? (
              <p className="mt-2 text-sm text-muted-foreground">{view.note}</p>
            ) : null}
          </div>

          <p className="shrink-0 font-semibold text-foreground">
            R{total.toFixed(2)}
          </p>
        </div>

        <div className="border-t border-border pt-2">{lines}</div>

        {order.notes ? (
          <p className="mt-3 border-t border-border pt-2 text-sm text-muted-foreground">
            Your note: {order.notes}
          </p>
        ) : null}
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
        Your orders
      </h1>

      {/* Shown once, straight after submitting. */}
      {sp.submitted ? (
        <div className="mb-6 rounded-2xl border border-green-600/40 bg-green-600/10 p-4">
          <p className="font-medium text-green-700 dark:text-green-400">
            Order submitted
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Your items will be included in CFA&apos;s next bulk order.
          </p>
        </div>
      ) : null}

      {decorated.length === 0 ? (
        <p className="text-muted-foreground">
          You have not placed any orders yet.
        </p>
      ) : (
        <div>
          {/* Filter buttons. Each is a link, so the filtered view can be
              bookmarked or shared. */}
          <div className="mb-5 flex flex-wrap gap-2">
            {filters.map(function (f) {
              const active = show === f.key;
              return (
                <Link
                  key={f.key || "all"}
                  href={
                    f.key
                      ? "/protected/shop/orders?show=" + f.key
                      : "/protected/shop/orders"
                  }
                  className={
                    "rounded-xl px-4 py-2 text-sm transition " +
                    (active
                      ? "bg-primary font-medium text-primary-foreground"
                      : "border border-border text-foreground hover:bg-accent")
                  }
                >
                  {f.label}{" "}
                  <span className={active ? "opacity-70" : "text-muted-foreground"}>
                    ({f.count})
                  </span>
                </Link>
              );
            })}
          </div>

          {list.length === 0 ? (
            <p className="rounded-2xl border border-border bg-card/80 p-8 text-center text-muted-foreground backdrop-blur-sm">
              Nothing in this group right now.
            </p>
          ) : (
            cards
          )}
        </div>
      )}
    </div>
  );
}