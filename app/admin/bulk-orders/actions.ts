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

  revalidatePath("/admin/bulk-orders");
  revalidatePath("/shop");

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

  revalidatePath("/admin/bulk-orders");
  revalidatePath("/shop");

  return { success: true };
}