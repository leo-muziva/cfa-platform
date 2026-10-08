/** Formats integer cents without converting financial values into floats. */
export function formatZar(cents: string | number | bigint): string {
  const value = typeof cents === "bigint" ? cents : BigInt(cents);
  const zero = BigInt(0);
  const hundred = BigInt(100);
  const sign = value < zero ? "-" : "";
  const absolute = value < zero ? -value : value;
  const rands = absolute / hundred;
  const remainder = (absolute % hundred).toString().padStart(2, "0");
  return `${sign}R${rands.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ")}.${remainder}`;
}

/**
 * Formats a rand amount from the older numeric(10,2) columns the same way as
 * formatZar, so every page shows money alike ("R1 234.50").
 */
export function formatRands(amount: string | number): string {
  return formatZar(Math.round(Number(amount) * 100));
}
