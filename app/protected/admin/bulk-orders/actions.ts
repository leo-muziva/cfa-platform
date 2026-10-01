"use server";

import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/services/MemberService";
import {
  buildDistributionCsv,
  buildSupplierCsv,
  type ExportOrder,
  type Handedness,
} from "@/lib/services/bulk-order-export";
import {
  advanceBulkOrderSchema,
  bulkOrderIdSchema,
  bulkOrderStatusSchema,
  estimatedArrivalSchema,
} from "@/lib/validations/bulk-order.schema";
import { revalidatePath } from "next/cache";

type ActionResult = { success: true; error?: undefined } | { error: string; success?: undefined };

type CancelResult =
  | { success: true; refundsRequested: number; error?: undefined }
  | { error: string; success?: undefined; refundsRequested?: undefined };

type ExportResult =
  | { success: true; filename: string; csv: string; error?: undefined }
  | { error: string; success?: undefined; filename?: undefined; csv?: undefined };

// Staff capability comes from is_staff/staff_type, not the legacy role column.
async function requireAdminClient() {
  const admin = await requireAdmin();
  if ("error" in admin) return null;
  return createClient();
}

// Supabase returns a to-one join as an object or a one-element array.
type OneOrMany<T> = T | T[] | null;

function one<T>(value: OneOrMany<T>): T | null {
  return Array.isArray(value) ? value[0] ?? null : value;
}

type RawItem = {
  quantity: number;
  size: string | null;
  handedness: Handedness | null;
  unit_price: number | string;
  products: OneOrMany<{ item_code: string; name: string }>;
};

type RawOrder = {
  status: string;
  profiles?: OneOrMany<{ full_name: string | null; email: string | null; phone: string | null }>;
  order_items: RawItem[] | null;
};

type RawBulk = { reference: string; orders: RawOrder[] | null };

function toExportOrders(bulk: RawBulk): ExportOrder[] {
  return (bulk.orders ?? []).map(function (order) {
    const profile = one(order.profiles ?? null);
    return {
      status: order.status,
      customer: profile
        ? { fullName: profile.full_name, email: profile.email, phone: profile.phone }
        : null,
      items: (order.order_items ?? []).flatMap(function (item) {
        const product = one(item.products);
        if (!product) return [];
        return [{
          itemCode: product.item_code,
          name: product.name,
          size: item.size,
          handedness: item.handedness,
          quantity: item.quantity,
          unitPrice: Number(item.unit_price),
        }];
      }),
    };
  });
}

// Moves a bulk order one step forward. Cancelling goes through
// cancelBulkOrder so paid orders always get a refund request.
// When it leaves 'collecting', a fresh empty one opens so newly paid
// customer orders have somewhere to go.
export async function advanceStatus(bulkOrderId: string, newStatus: string): Promise<ActionResult> {
  const supabase = await requireAdminClient();
  if (!supabase) {
    return { error: "Only admins can do that." };
  }

  if (!bulkOrderIdSchema.safeParse(bulkOrderId).success) {
    return { error: "Invalid bulk order." };
  }

  const { data: current, error: readError } = await supabase
    .from("bulk_orders")
    .select("status")
    .eq("id", bulkOrderId)
    .maybeSingle();

  if (readError) {
    return { error: "Could not load the bulk order." };
  }
  const currentStatus = bulkOrderStatusSchema.safeParse(current?.status);
  if (!current || !currentStatus.success) {
    return { error: "Bulk order not found." };
  }

  const parsed = advanceBulkOrderSchema.safeParse({
    bulkOrderId,
    currentStatus: currentStatus.data,
    newStatus,
  });
  if (!parsed.success) {
    return { error: "That status change is not allowed." };
  }
  if (parsed.data.newStatus === "cancelled") {
    return { error: "Use Cancel bulk order so paid orders get refund requests." };
  }

  const updates: Record<string, string> = { status: parsed.data.newStatus };

  // Record when it was actually placed with the supplier.
  if (parsed.data.newStatus === "placed") {
    updates.placed_at = new Date().toISOString();
  }

  // Matching on the status we read stops two admins advancing it twice.
  const { data: updated, error } = await supabase
    .from("bulk_orders")
    .update(updates)
    .eq("id", bulkOrderId)
    .eq("status", parsed.data.currentStatus)
    .select("id");

  if (error) {
    return { error: "Could not update: " + error.message };
  }
  if (!updated || updated.length === 0) {
    return { error: "The bulk order changed or could not be updated. Refresh and try again." };
  }

  // If this one is no longer collecting, open the next one.
  if (parsed.data.currentStatus === "collecting") {
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

const CANCEL_ERRORS: Record<string, string> = {
  forbidden: "Only staff can cancel a bulk order.",
  bulk_order_not_found: "Bulk order not found.",
  bulk_order_closed: "This bulk order is already distributed or cancelled.",
};

// Cancels a bulk order in one database transaction: the status changes,
// a new collecting bulk order opens if needed, and every paid order in it
// gets a full refund request in the Refunds queue.
export async function cancelBulkOrder(bulkOrderId: string): Promise<CancelResult> {
  const supabase = await requireAdminClient();
  if (!supabase) {
    return { error: "Only admins can do that." };
  }
  if (!bulkOrderIdSchema.safeParse(bulkOrderId).success) {
    return { error: "Invalid bulk order." };
  }

  const { data, error } = await supabase.rpc("cancel_bulk_order", { target_bulk: bulkOrderId });
  if (error) {
    const code = Object.keys(CANCEL_ERRORS).find(function (key) {
      return error.message.includes(key);
    });
    return { error: code ? CANCEL_ERRORS[code] : "Could not cancel the bulk order." };
  }

  revalidatePath("/protected/admin/bulk-orders");
  revalidatePath("/protected/admin/refunds");
  revalidatePath("/protected/shop");
  revalidatePath("/protected/shop/orders");

  return { success: true, refundsRequested: Number(data ?? 0) };
}

// Sets the expected arrival date shown to customers.
export async function setEstimatedArrival(bulkOrderId: string, date: string): Promise<ActionResult> {
  const supabase = await requireAdminClient();
  if (!supabase) {
    return { error: "Only admins can do that." };
  }

  const parsed = estimatedArrivalSchema.safeParse({ bulkOrderId, date });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid date." };
  }

  const { data, error } = await supabase
    .from("bulk_orders")
    .update({ estimated_arrival: parsed.data.date || null })
    .eq("id", parsed.data.bulkOrderId)
    .select("id");

  if (error || !data || data.length === 0) {
    return { error: "Could not save the date." };
  }

  revalidatePath("/protected/admin/bulk-orders");
  revalidatePath("/protected/shop");

  return { success: true };
}

// The supplier CSV: one line per item code, size and hand, with quantities
// added up across every paid customer order in the bulk order.
export async function exportForSupplier(bulkOrderId: string): Promise<ExportResult> {
  const supabase = await requireAdminClient();
  if (!supabase) {
    return { error: "Only admins can do that." };
  }
  if (!bulkOrderIdSchema.safeParse(bulkOrderId).success) {
    return { error: "Invalid bulk order." };
  }

  const { data: bulk } = await supabase
    .from("bulk_orders")
    .select(
      "reference, orders (status, order_items (quantity, size, handedness, unit_price, products (item_code, name)))"
    )
    .eq("id", bulkOrderId)
    .maybeSingle();

  if (!bulk) {
    return { error: "Bulk order not found." };
  }

  const raw = bulk as RawBulk;
  return {
    success: true,
    filename: raw.reference + "-supplier-order.csv",
    csv: buildSupplierCsv(toExportOrders(raw)),
  };
}

// CFA's own packing list: one line per paid customer per item,
// for sorting the shipment when it arrives.
export async function exportForDistribution(bulkOrderId: string): Promise<ExportResult> {
  const supabase = await requireAdminClient();
  if (!supabase) {
    return { error: "Only admins can do that." };
  }
  if (!bulkOrderIdSchema.safeParse(bulkOrderId).success) {
    return { error: "Invalid bulk order." };
  }

  const { data: bulk } = await supabase
    .from("bulk_orders")
    .select(
      "reference, orders (status, created_at, profiles (full_name, email, phone), order_items (quantity, size, handedness, unit_price, products (item_code, name)))"
    )
    .eq("id", bulkOrderId)
    .maybeSingle();

  if (!bulk) {
    return { error: "Bulk order not found." };
  }

  const raw = bulk as RawBulk;
  return {
    success: true,
    filename: raw.reference + "-distribution.csv",
    csv: buildDistributionCsv(toExportOrders(raw)),
  };
}
