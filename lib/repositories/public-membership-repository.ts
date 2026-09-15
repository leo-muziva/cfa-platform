import "server-only";
import { createClient } from "@/lib/supabase/server";

export interface PublicMembershipProductRow {
  code: string | null;
  name: string;
  price: number | string;
  joining_fee: number | string;
  term_months: number | null;
  description: string | null;
}

export async function listPublicMembershipProducts(): Promise<
  { products: PublicMembershipProductRow[] } | { error: string }
> {
  const db = await createClient();
  const { data, error } = await db.from("membership_types")
    .select("code,name,price,joining_fee,term_months,description")
    .eq("is_active", true);
  if (error) return { error: "Membership pricing is unavailable" };
  return { products: (data ?? []) as PublicMembershipProductRow[] };
}
