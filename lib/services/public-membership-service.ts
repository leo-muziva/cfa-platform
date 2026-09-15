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

const PRODUCT_CODES: PublicMembershipCode[] = ["month_to_month", "six_month", "twelve_month", "beginner_package"];
const PRODUCT_NAMES: Record<PublicMembershipCode, string> = {
  month_to_month: "Month-to-month",
  six_month: "Six-month",
  twelve_month: "Twelve-month",
  beginner_package: "Beginner package",
};

function randValue(value: number | string): number | null {
  const amount = Number(value);
  return Number.isFinite(amount) && amount >= 0 ? amount : null;
}

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

export async function getPublicPricingPlans(): Promise<PublicPricingPlan[]> {
  return mapPublicPricingPlans(await listPublicMembershipProducts());
}
