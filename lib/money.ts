/**
 * Formats integer cents without converting financial values into floats.
 * Whole rand amounts leave off the cents ("R1 000"), which suits prices
 * people are shopping for. Records of money owed or paid use
 * formatZarWithCents instead.
 */
export function formatZar(cents: string | number | bigint): string {
  return format(cents, false);
}

/**
 * Always shows the cents ("R1 000.00"), for financial records: receipts,
 * invoices, refunds, payment emails and supplier sheets, where amounts
 * should line up and read like accounts.
 */
export function formatZarWithCents(cents: string | number | bigint): string {
  return format(cents, true);
}

function format(cents: string | number | bigint, alwaysCents: boolean): string {
  const value = typeof cents === "bigint" ? cents : BigInt(cents);
  const zero = BigInt(0);
  const hundred = BigInt(100);
  const sign = value < zero ? "-" : "";
  const absolute = value < zero ? -value : value;
  const rands = absolute / hundred;
  const remainder = absolute % hundred;
  const whole = `${sign}R${rands.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ")}`;
  if (remainder === zero && !alwaysCents) return whole;
  return `${whole}.${remainder.toString().padStart(2, "0")}`;
}

/**
 * Formats a rand amount from the older numeric(10,2) columns the same way as
 * formatZar, so every page shows money alike ("R1 234.50").
 */
export function formatRands(amount: string | number): string {
  return formatZar(Math.round(Number(amount) * 100));
}

/** formatRands for financial records; always shows the cents. */
export function formatRandsWithCents(amount: string | number): string {
  return formatZarWithCents(Math.round(Number(amount) * 100));
}
