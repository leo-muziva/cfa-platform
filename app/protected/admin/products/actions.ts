"use server";

import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/services/MemberService";
import { productIdSchema, productInputSchema } from "@/lib/validations/product.schema";
import { revalidatePath } from "next/cache";
import type { ZodError } from "zod";
import { validationFailure } from "@/lib/validations/form-errors";

// Everything a product form sends us.
export type ProductInput = {
  item_code: string;
  name: string;
  description: string;
  price: string;
  category: string;
  sizes: string;
  section?: string;
  weapon?: string;
  kind?: string;
  level?: string;
  is_active: boolean;
};

type ActionResult = { success: true; error?: undefined } | { error: string; success?: undefined };

// Staff capability comes from is_staff/staff_type, not the legacy role column.
async function requireAdminClient() {
  const admin = await requireAdmin();
  if ("error" in admin) return null;
  return createClient();
}

// The validation message to show for a failed product form.
function firstIssue(error: ZodError) {
  return validationFailure(error).error;
}

// Product changes show in both the admin list and the customer shop.
function refreshShop() {
  revalidatePath("/protected/admin/products");
  revalidatePath("/protected/shop");
}

/** Adds a product. Admins only. */
export async function createProduct(input: ProductInput): Promise<ActionResult> {
  const supabase = await requireAdminClient();
  if (!supabase) return { error: "Only admins can do that." };

  const parsed = productInputSchema.safeParse(input);
  if (!parsed.success) return { error: firstIssue(parsed.error) };

  const { error } = await supabase.from("products").insert(parsed.data);

  if (error) {
    // 23505 is Postgres's unique-violation code.
    if (error.code === "23505") {
      return { error: "That item code is already in use." };
    }
    return { error: "Could not add the product: " + error.message };
  }

  refreshShop();
  return { success: true };
}

/** Saves changes to a product. Admins only. */
export async function updateProduct(id: number, input: ProductInput): Promise<ActionResult> {
  const supabase = await requireAdminClient();
  if (!supabase) return { error: "Only admins can do that." };

  if (!productIdSchema.safeParse(id).success) return { error: "Invalid product." };
  const parsed = productInputSchema.safeParse(input);
  if (!parsed.success) return { error: firstIssue(parsed.error) };

  const { data, error } = await supabase
    .from("products")
    .update(parsed.data)
    .eq("id", id)
    .select("id");

  if (error) {
    if (error.code === "23505") {
      return { error: "That item code is already in use." };
    }
    return { error: "Could not save: " + error.message };
  }
  // RLS or a missing row makes the update match nothing without an error.
  if (!data || data.length === 0) {
    return { error: "Could not save: the product was not found or you cannot edit it." };
  }

  refreshShop();
  return { success: true };
}

// Hides a product from the shop without touching order history.
export async function setProductActive(id: number, active: boolean): Promise<ActionResult> {
  const supabase = await requireAdminClient();
  if (!supabase) return { error: "Only admins can do that." };

  if (!productIdSchema.safeParse(id).success || typeof active !== "boolean") {
    return { error: "Invalid product." };
  }

  const { data, error } = await supabase
    .from("products")
    .update({ is_active: active })
    .eq("id", id)
    .select("id");

  if (error) return { error: "Could not update: " + error.message };
  if (!data || data.length === 0) {
    return { error: "Could not update: the product was not found or you cannot edit it." };
  }

  refreshShop();
  return { success: true };
}

// Permanent removal. Only works for products nobody has ordered -
// the database refuses to break an existing order line.
export async function deleteProduct(id: number): Promise<ActionResult> {
  const supabase = await requireAdminClient();
  if (!supabase) return { error: "Only admins can do that." };

  if (!productIdSchema.safeParse(id).success) return { error: "Invalid product." };

  const { data: used } = await supabase
    .from("order_items")
    .select("id")
    .eq("product_id", id)
    .limit(1);

  if (used && used.length > 0) {
    return {
      error:
        "This product appears on existing orders, so it can't be deleted. Deactivate it instead.",
    };
  }

  const { data, error } = await supabase
    .from("products")
    .delete()
    .eq("id", id)
    .select("id");

  if (error) return { error: "Could not delete: " + error.message };
  if (!data || data.length === 0) {
    return { error: "Could not delete: the product was not found or you cannot delete it." };
  }

  refreshShop();
  return { success: true };
}
