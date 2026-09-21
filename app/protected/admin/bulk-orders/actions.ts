"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

// Checks the logged-in user is an admin.
// Returns the Supabase client if so, null if not.
async function requireAdmin() {
  const supabase = await createClient();

  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) {
    return null;
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", auth.user.id)
    .single();

  if (profile?.role !== "admin") {
    return null;
  }

  return supabase;
}

// Moves a bulk order to its next status.
// When it leaves 'collecting', a fresh empty one opens so new
// customer orders have somewhere to go.
export async function advanceStatus(bulkOrderId: string, newStatus: string) {
  const supabase = await requireAdmin();
  if (!supabase) {
    return { error: "Only admins can do that." };
  }

  const updates: Record<string, string> = { status: newStatus };

  // Record when it was actually placed with the supplier.
  if (newStatus === "placed") {
    updates.placed_at = new Date().toISOString();
  }

  const { error } = await supabase
    .from("bulk_orders")
    .update(updates)
    .eq("id", bulkOrderId);

  if (error) {
    return { error: "Could not update: " + error.message };
  }

  // If this one is no longer collecting, open the next one.
  if (newStatus !== "collecting") {
    const { data: stillOpen } = await supabase
      .from("bulk_orders")
      .select("id")
      .eq("status", "collecting")
      .maybeSingle();

    if (!stillOpen) {
      const stamp = new Date()
        .toISOString()
        .slice(0, 19)
        .replace(/[-:T]/g, "");

      await supabase
        .from("bulk_orders")
        .insert({ reference: "BO-" + stamp, status: "collecting" });
    }
  }

  revalidatePath("/protected/admin/bulk-orders");
  revalidatePath("/protected/shop");

  return { success: true };
}

// Sets the expected arrival date shown to customers.
export async function setEstimatedArrival(bulkOrderId: string, date: string) {
  const supabase = await requireAdmin();
  if (!supabase) {
    return { error: "Only admins can do that." };
  }

  const { error } = await supabase
    .from("bulk_orders")
    .update({ estimated_arrival: date || null })
    .eq("id", bulkOrderId);

  if (error) {
    return { error: "Could not save the date." };
  }

  revalidatePath("/protected/admin/bulk-orders");
  revalidatePath("/protected/shop");

  return { success: true };

}
// Turns a value into a safe CSV cell.
// Wraps in quotes if it contains a comma, quote or newline.
function csvCell(value: string | number | null): string {
  const s = value === null ? "" : String(value);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

// Builds the CSV the supplier receives: one line per item code and size,
// with quantities added up across every customer in the bulk order.
export async function exportForSupplier(bulkOrderId: string) {
  const supabase = await requireAdmin();
  if (!supabase) {
    return { error: "Only admins can do that." };
  }

  const { data: bulk } = await supabase
    .from("bulk_orders")
    .select(
      "reference, orders (order_items (quantity, size, unit_price, products (item_code, name)))"
    )
    .eq("id", bulkOrderId)
    .single();

  if (!bulk) {
    return { error: "Bulk order not found." };
  }


  // Group by item code plus size. Two jackets in different sizes are
  // two separate line items to the supplier.
  const lines: Record <
    string,
    { code: string; name: string; size: string; qty: number; price: number }
  > = {};

  for (const order of bulk.orders ?? []) {
    for (const item of order.order_items ?? []) {
      const product = Array.isArray(item.products)
        ? item.products[0]
        : item.products;
      if (!product) continue;

      const size = item.size ?? "";
      const key = product.item_code + "|" + size;

      if (lines[key]) {
        lines[key].qty = lines[key].qty + item.quantity;
      } else {
        lines[key] = {
          code: product.item_code,
          name: product.name,
          size: size,
          qty: item.quantity,
          price: Number(item.unit_price),
        };
      }
    }
  }

    type Line = {
    code: string;
    name: string;
    size: string;
    qty: number;
    price: number;
  };

  const sorted: Line[] = Object.values(lines).sort(function (a, b) {
    return a.code.localeCompare(b.code);
  
  });

  const rows = ["Item Code,Description,Size,Quantity,Unit Price,Line Total"];
  let total = 0;

  for (const l of sorted) {
    const lineTotal = l.price * l.qty;
    total = total + lineTotal;
    rows.push(
      [
        csvCell(l.code),
        csvCell(l.name),
        csvCell(l.size),
        csvCell(l.qty),
        csvCell(l.price.toFixed(2)),
        csvCell(lineTotal.toFixed(2)),
      ].join(",")
    );
  }

  rows.push(",,,,,");
  rows.push(",,,,Total," + total.toFixed(2));

  return {
    success: true,
    filename: bulk.reference + "-supplier-order.csv",
    csv: rows.join("\n"),
  };
}

// Builds CFA's own packing list: one line per customer per item,
// for sorting the shipment when it arrives.
export async function exportForDistribution(bulkOrderId: string) {
  const supabase = await requireAdmin();
  if (!supabase) {
    return { error: "Only admins can do that." };
  }

  const { data: bulk } = await supabase
    .from("bulk_orders")
    .select(
      "reference, orders (created_at, profiles (full_name, email, phone), order_items (quantity, size, unit_price, products (item_code, name)))"
    )
    .eq("id", bulkOrderId)
    .single();

  if (!bulk) {
    return { error: "Bulk order not found." };
  }

  const rows = [
    "Customer,Email,Phone,Item Code,Description,Size,Quantity,Unit Price,Line Total",
  ];

  for (const order of bulk.orders ?? []) {
    const profile = Array.isArray(order.profiles)
      ? order.profiles[0]
      : order.profiles;

    for (const item of order.order_items ?? []) {
      const product = Array.isArray(item.products)
        ? item.products[0]
        : item.products;
      if (!product) continue;

      const lineTotal = Number(item.unit_price) * item.quantity;

      rows.push(
        [
          csvCell(profile?.full_name ?? ""),
          csvCell(profile?.email ?? ""),
          csvCell(profile?.phone ?? ""),
          csvCell(product.item_code),
          csvCell(product.name),
          csvCell(item.size ?? ""),
          csvCell(item.quantity),
          csvCell(Number(item.unit_price).toFixed(2)),
          csvCell(lineTotal.toFixed(2)),
        ].join(",")
      );
    }
  }

  return {
    success: true,
    filename: bulk.reference + "-distribution.csv",
    csv: rows.join("\n"),
  };
}
