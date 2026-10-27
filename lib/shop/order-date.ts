// An order row is the customer's cart until it is paid, so created_at is
// when the cart was started, which can be weeks before checkout. Once the
// order is paid, its date is when the payment went through.
export function orderPlacedAt(
  createdAt: string,
  attempts: { status: string; completed_at: string | null }[] | null | undefined
): string {
  const paidTimes = (attempts ?? [])
    .filter((attempt) => attempt.status === "succeeded" && attempt.completed_at)
    .map((attempt) => attempt.completed_at as string)
    .sort();
  // the latest payment, in case an earlier attempt was refunded or reversed
  return paidTimes[paidTimes.length - 1] ?? createdAt;
}

const orderDateFormat = new Intl.DateTimeFormat("en-ZA", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "Africa/Johannesburg",
});

// "21 October 2026", in Cape Town time
export function formatOrderDate(iso: string): string {
  return orderDateFormat.format(new Date(iso));
}
