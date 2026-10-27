// Membership pricing for the public website. Prices come from the
// membership_types table so the site never shows hardcoded amounts.
import "server-only";
import { listPublicMembershipProducts } from "@/lib/repositories/public-membership-repository";

export type PublicMembershipCode = "month_to_month" | "six_month" | "twelve_month" | "beginner_package";

export interface PublicPricingPlan {
  code: PublicMembershipCode;
  name: string;
  price: number | null;
  termMonths: number | null;
  joiningFee: number | null;
  description: string | null;
  discountNote: string | null;
}

// Display order on the pricing page, and fallback names for plans that are
// missing from the database (they then show without a price).
const PRODUCT_CODES: PublicMembershipCode[] = ["month_to_month", "six_month", "twelve_month", "beginner_package"];
const PRODUCT_NAMES: Record<PublicMembershipCode, string> = {
  month_to_month: "Month-to-month",
  six_month: "Six-month",
  twelve_month: "Twelve-month",
  beginner_package: "Beginner package",
};

// Database numerics can arrive as strings; anything invalid becomes null.
function randValue(value: number | string): number | null {
  const amount = Number(value);
  return Number.isFinite(amount) && amount >= 0 ? amount : null;
}

/**
 * Turns membership_types rows into the four pricing cards. The six-month
 * "10% off" note only appears when the stored price really is six monthly
 * dues less 10%, so the label cannot drift from the data.
 */
export function mapPublicPricingPlans(rows: Awaited<ReturnType<typeof listPublicMembershipProducts>>): PublicPricingPlan[] {
  const available = "products" in rows ? rows.products : [];
  const monthly = available.find((row) => row.code === "month_to_month");
  const monthlyPrice = monthly ? randValue(monthly.price) : null;
  return PRODUCT_CODES.map((code) => {
    const row = available.find((product) => product.code === code);
    const price = row ? randValue(row.price) : null;
    const discountNote = code === "six_month" && monthlyPrice !== null && price !== null
      && Math.abs(price - monthlyPrice * 6 * 0.9) < 0.01 ? "10% off six monthly dues" : null;
    return {
      code,
      name: row?.name ?? PRODUCT_NAMES[code],
      price,
      termMonths: row?.term_months ?? null,
      joiningFee: row ? randValue(row.joining_fee) : null,
      description: row?.description ?? null,
      discountNote,
    };
  });
}

/** Loads and maps the active membership products for the pricing page. */
export async function getPublicPricingPlans(): Promise<PublicPricingPlan[]> {
  return mapPublicPricingPlans(await listPublicMembershipProducts());
}
