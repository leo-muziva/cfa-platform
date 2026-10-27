import Link from "next/link";
import { redirect } from "next/navigation";
import { listOrders } from "@/lib/services/shop-order-service";
import { listMyRefundablePayments } from "@/lib/services/refund-service";
import { statusView } from "./orderStatus";
import { formatZarWithCents } from "@/lib/money";
import { formatOrderDate } from "@/lib/shop/order-date";



export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ show?: string }>;
}) {
  const sp = await searchParams;
  const [result, refundable] = await Promise.all([listOrders(), listMyRefundablePayments()]);

  if (!result.ok) {
    redirect("/auth/login?next=%2Fprotected%2Fshop%2Forders");
  }

  // Paid orders link to a refund request for the payment that settled them.
  // If the lookup fails the links are simply left out.
  const refundAttemptByOrder = new Map<string, string>();
  if (refundable.ok) {
    for (const payment of refundable.data) {
      if (payment.orderId && payment.refundableCents > 0) {
        refundAttemptByOrder.set(payment.orderId, payment.attemptId);
      }
    }
  }

  // Which filter is active. Blank means show everything.
  const show = sp.show ?? "";

  // Work out each order's status once, so the filter and the display both
  // use the same answer. The bulk order each one joined is what lets us
  // show the real stage instead of a fixed label.
  const decorated = result.orders.map(function (order) {
    const view = statusView(order.status, order.bulkStatus);
    return { order, view };
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
    const { order, view } = d;

    const date = formatOrderDate(order.placedAt);

    const refundAttempt =
      order.status === "paid" ? refundAttemptByOrder.get(order.id) : undefined;

    // Only show a date once the bulk order has actually been placed.
    // Before that there's no real date to promise. Refunded and cancelled
    // orders aren't coming, so they never get one.
    const bulkPlaced =
      order.bulkStatus === "placed" ||
      order.bulkStatus === "shipping" ||
      order.bulkStatus === "arrived";
    const stillComing = order.status === "paid" || order.status === "submitted";
    const arrival =
      order.estimatedArrival && bulkPlaced && stillComing && view.group === "progress"
        ? new Date(order.estimatedArrival).toLocaleDateString("en-ZA", {
            day: "numeric",
            month: "long",
          })
        : null;

    const lines = order.lines.map(function (line) {
      return (
        <div key={line.id} className="flex justify-between py-1 text-sm">
          <span className="text-foreground">
            <span className="font-mono text-xs text-muted-foreground">
              {line.itemCode}
            </span>{" "}
            {line.name}
            {line.size ? " (" + line.size + ")" : ""}
            {line.handedness
              ? " " + (line.handedness === "right" ? "RH" : "LH")
              : ""}
            {line.quantity > 1 ? " × " + line.quantity : ""}
          </span>
          <span className="text-foreground">
            {formatZarWithCents(line.unitPriceCents * line.quantity)}
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

            {view.linkToCart ? (
              <Link
                href="/protected/shop/cart"
                className="mt-1 inline-block text-sm underline underline-offset-4"
              >
                Go to your cart to finish paying
              </Link>
            ) : null}

            {refundAttempt ? (
              <Link
                href={"/protected/refunds/new?attempt=" + encodeURIComponent(refundAttempt)}
                className="mt-1 block text-sm underline underline-offset-4"
              >
                Request refund
                <span className="sr-only"> for the order placed {date}</span>
              </Link>
            ) : null}
          </div>

          <p className="shrink-0 font-semibold text-foreground">
            {formatZarWithCents(order.totalCents)}
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