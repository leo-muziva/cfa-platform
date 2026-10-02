// Turns the words stored in the database into something a customer
// understands, plus a colour and a line explaining what happens next.
//
// Orders are paid up front. Before payment is confirmed the order status
// drives the label; once paid, what the customer cares about is the bulk
// order it joined, so that drives it instead.

export type StatusView = {
  label: string;
  // Tailwind classes for the badge.
  tone: string;
  // Shown under the badge. Empty means nothing to add.
  note: string;
  // Which filter group this order belongs to.
  group: "progress" | "ready";
  // The page adds a link to the cart so the customer can finish paying.
  linkToCart?: boolean;
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

  // The whole payment went back to the customer, whatever the bulk order did.
  if (orderStatus === "refunded") {
    return {
      label: "Refunded",
      tone: "bg-muted text-muted-foreground",
      note: "Your payment has been refunded.",
      group: "progress",
    };
  }

  // Checkout started but PayFast has not confirmed payment yet.
  if (orderStatus === "pending_payment") {
    return {
      label: "Awaiting payment",
      tone: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
      note: "This order joins the next bulk order once payment is confirmed.",
      group: "progress",
      linkToCart: true,
    };
  }

  // Placed before online payment existed, so never paid online. Say so
  // rather than implying it was. Those that already joined a bulk order
  // keep showing its stage, with the same caveat.
  if (orderStatus === "submitted") {
    if (!bulkStatus) {
      return {
        label: "Received (unpaid)",
        tone: "bg-muted text-muted-foreground",
        note: "Placed before online payment was available. Contact CFA about payment.",
        group: "progress",
      };
    }
    const stage = bulkStageView(bulkStatus);
    const legacyNote = "Placed before online payment was available.";
    return { ...stage, note: stage.note ? stage.note + " " + legacyNote : legacyNote };
  }

  // Paid but not yet attached to a bulk order. Shouldn't normally
  // happen, since the database attaches it on payment, but worth
  // handling rather than showing a blank.
  if (!bulkStatus) {
    return {
      label: "Paid",
      tone: "bg-muted text-muted-foreground",
      note: "Your payment has been received. Waiting for threshold, ships once the next bulk order is placed.",
      group: "progress",
    };
  }

  return bulkStageView(bulkStatus);
}

// The stage of the bulk order a paid order joined.
function bulkStageView(bulkStatus: string): StatusView {
  if (bulkStatus === "collecting") {
    return {
      label: "Waiting for next bulk order",
      tone: "bg-muted text-muted-foreground",
      note: "Waiting for threshold, ships once the next bulk order is placed.",
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