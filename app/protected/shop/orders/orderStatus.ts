// Turns the words stored in the database into something a customer
// understands, plus a colour and a line explaining what happens next.
//
// The order itself is 'submitted'. What the customer actually cares
// about is the bulk order it joined, so that's what drives this.

export type StatusView = {
  label: string;
  // Tailwind classes for the badge.
  tone: string;
  // Shown under the badge. Empty means nothing to add.
  note: string;
  // Which filter group this order belongs to.
  group: "progress" | "ready";
};

export function statusView(
  orderStatus: string,
  bulkStatus: string | null
): StatusView {
  // A cancelled order never reached a bulk order.
  if (orderStatus === "cancelled") {
    return {
      label: "Cancelled",
      tone: "bg-muted text-muted-foreground",
      note: "",
      group: "progress",
    };
  }

  // Submitted but not yet attached to a bulk order. Shouldn't normally
  // happen, since the database attaches it automatically, but worth
  // handling rather than showing a blank.
  if (!bulkStatus) {
    return {
      label: "Received",
      tone: "bg-muted text-muted-foreground",
      note: "Your order has been received.",
      group: "progress",
    };
  }

  if (bulkStatus === "collecting") {
    return {
      label: "Waiting for next bulk order",
      tone: "bg-muted text-muted-foreground",
      note: "CFA places the order with the supplier once enough orders have come in.",
      group: "progress",
    };
  }

  if (bulkStatus === "placed") {
    return {
      label: "Placed with supplier",
      tone: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
      note: "CFA has sent the order to the supplier.",
      group: "progress",
    };
  }

  if (bulkStatus === "shipping") {
    return {
      label: "In transit",
      tone: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
      note: "Your equipment is on its way from the supplier.",
      group: "progress",
    };
  }

  if (bulkStatus === "arrived") {
    return {
      label: "Arrived in South Africa",
      tone: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
      note: "CFA is sorting the shipment. You will be able to collect shortly.",
      group: "progress",
    };
  }

  if (bulkStatus === "distributed") {
    return {
      label: "Ready for collection",
      tone: "bg-green-600/15 text-green-700 dark:text-green-400",
      note: "Your equipment is ready. Speak to your coach to collect it.",
      group: "ready",
    };
  }

  if (bulkStatus === "cancelled") {
    return {
      label: "Bulk order cancelled",
      tone: "bg-muted text-muted-foreground",
      note: "Contact CFA about this order.",
      group: "progress",
    };
  }

  // Anything unexpected shows the raw value rather than nothing.
  return {
    label: bulkStatus,
    tone: "bg-muted text-muted-foreground",
    note: "",
    group: "progress",
  };
}