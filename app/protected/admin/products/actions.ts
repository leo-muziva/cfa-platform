"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

// Everything a product form sends us.
export type ProductInput = {
  item_code: string;
  name: string;
  description: string;
  price: string;
  category: string;
  sizes: string;
  is_active: boolean;
};

async function requireAdminClient() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", auth.user.id)
    .single();

  return profile?.role === "admin" ? supabase : null;
}

// Shared checks so create and update behave the same way.
function validate(input: ProductInput) {
  if (!input.item_code.trim()) return "Item code is required.";
  if (!input.name.trim()) return "Product name is required.";

  const price = Number(input.price);
  if (Number.isNaN(price) || price < 0) {
    return "Price must be a number of 0 or more.";
  }
  return null;
}

// Turns the form's text fields into the shape the database expects.
// Empty optional fields become null rather than empty strings.
function toRow(input: ProductInput) {
  return {
    item_code: input.item_code.trim().toUpperCase(),
    name: input.name.trim(),
    description: input.description.trim() || null,
    price: Number(input.price),
    category: input.category.trim() || null,
    sizes: input.sizes.trim() || null,
    is_active: input.is_active,
  };
}

export async function createProduct(input: ProductInput) {
  const supabase = await requireAdminClient();
  if (!supabase) return { error: "Only admins can do that." };

  const problem = validate(input);
  if (problem) return { error: problem };

  const { error } = await supabase.from("products").insert(toRow(input));

  if (error) {
    // 23505 is Postgres's unique-violation code.
    if (error.code === "23505") {
      return { error: "That item code is already in use." };
    }
    return { error: "Could not add the product: " + error.message };
  }

  revalidatePath("/protected/admin/products");
  revalidatePath("/protected/shop");
  return { success: true };
}

export async function updateProduct(id: number, input: ProductInput) {
  const supabase = await requireAdminClient();
  if (!supabase) return { error: "Only admins can do that." };

  const problem = validate(input);
  if (problem) return { error: problem };

  const { error } = await supabase
    .from("products")
    .update(toRow(input))
    .eq("id", id);

  if (error) {
    if (error.code === "23505") {
      return { error: "That item code is already in use." };
    }
    return { error: "Could not save: " + error.message };
  }

  revalidatePath("/protected/admin/products");
  revalidatePath("/protected/shop");
  return { success: true };
}

// Hides a product from the shop without touching order history.
export async function setProductActive(id: number, active: boolean) {
  const supabase = await requireAdminClient();
  if (!supabase) return { error: "Only admins can do that." };

  const { error } = await supabase
    .from("products")
    .update({ is_active: active })
    .eq("id", id);

  if (error) return { error: "Could not update: " + error.message };

  revalidatePath("/protected/admin/products");
  revalidatePath("/protected/shop");
  return { success: true };
}

// Permanent removal. Only works for products nobody has ordered —
// the database refuses to break an existing order line.
export async function deleteProduct(id: number) {
  const supabase = await requireAdminClient();
  if (!supabase) return { error: "Only admins can do that." };

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

  const { error } = await supabase.from("products").delete().eq("id", id);

  if (error) return { error: "Could not delete: " + error.message };

  revalidatePath("/protected/admin/products");
  revalidatePath("/protected/shop");
  return { success: true };
}