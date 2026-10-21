import { formatRands } from "@/lib/money";

interface PricedMembershipType {
  code?: string;
  price: number | string;
  term_months?: number | null;
  joining_fee?: number | string | null;
}

/**
 * The apply dropdown shows what approval will actually charge: the term price,
 * the joining fee added on approval, and how much a longer term saves
 * compared with paying month to month for the same number of months.
 */
export function membershipPriceLabel(type: PricedMembershipType, monthlyPrice: number | string | null): string {
  const price = Number(type.price);
  const parts = [formatRands(price)];
  const months = type.term_months ?? 0;
  const monthly = monthlyPrice === null ? 0 : Number(monthlyPrice);
  // Only longer terms of the same membership can be compared with monthly
  // dues; the beginner package is a different product, not a discount.
  if ((type.code === "six_month" || type.code === "twelve_month") && months > 1 && monthly > 0) {
    const percentOff = Math.round((1 - price / (monthly * months)) * 100);
    if (percentOff > 0) parts[0] += ` (${percentOff}% off)`;
  }
  const joiningFee = Number(type.joining_fee ?? 0);
  if (joiningFee > 0) parts.push(`${formatRands(joiningFee)} joining fee`);
  return parts.join(" + ");
}
