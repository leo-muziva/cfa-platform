import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Handedness, OrderStatus, ShopCart, ShopCartLine } from "@/types/domain";

// All customer shop data access. RLS limits every query to the signed-in
// customer's own orders; status changes past draft happen only through the
// security-definer checkout routines.

// The product fields the cart rules need.
export interface CartProductRecord {
  id: number;
  price: number;
  sizes: string | null;
  needsHandedness: boolean;
  isActive: boolean;
}

// The open cart's id and whether it is still editable.
export interface OpenCartHeader {
  id: string;
  status: ShopCart["status"];
}

// An existing cart line that matches a product, size and hand.
export interface CartLineMatch {
  id: string;
  quantity: number;
}

// A line to insert into the cart. unitPrice is in rands.
export interface NewCartLine {
  orderId: string;
  productId: number;
  quantity: number;
  size: string | null;
  handedness: Handedness | null;
  unitPrice: number;
}

// Paid total of the collecting bulk order against its threshold.
export interface BulkProgressRecord {
  reference: string;
  thresholdCents: number;
  totalCents: number;
}

// One line of a submitted order, for the "my orders" page.
export interface ShopOrderLineSummary {
  id: string;
  itemCode: string;
  name: string;
  size: string | null;
  handedness: Handedness | null;
  quantity: number;
  unitPriceCents: number;
}

// A submitted order with its lines and bulk order status.
export interface ShopOrderSummary {
  id: string;
  status: Exclude<OrderStatus, "draft">;
  notes: string | null;
  createdAt: string;
  bulkStatus: string | null;
  estimatedArrival: string | null;
  lines: ShopOrderLineSummary[];
  totalCents: number;
}

// Supabase returns a to-one join as either an object or a one-item array.
function one<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

// numeric(10,2) arrives as a string or number; ledger work uses cents.
export function toCents(value: number | string): number {
  return Math.round(Number(value) * 100);
}

// Narrows the stored text to "right", "left" or null.
function toHandedness(value: string | null): Handedness | null {
  return value === "right" || value === "left" ? value : null;
}

/** The signed-in user's id, or null. */
export async function getCurrentUserId(): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  return data?.user?.id ?? null;
}

/** The customer's one open order (draft or pending payment), without its lines. */
export async function findOpenCartHeader(userId: string): Promise<OpenCartHeader | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("orders")
    .select("id, status")
    .eq("user_id", userId)
    .in("status", ["draft", "pending_payment"])
    .maybeSingle();
  if (!data) return null;
  return {
    id: data.id as string,
    status: data.status === "pending_payment" ? "pending_payment" : "draft",
  };
}

// Raw order_items row with its joined product.
interface CartLineRow {
  id: string;
  product_id: number;
  quantity: number;
  size: string | null;
  handedness: string | null;
  unit_price: number | string;
  products:
    | { item_code: string; name: string; image_path: string | null }
    | { item_code: string; name: string; image_path: string | null }[]
    | null;
}

/** The open order with its lines and a total worked out from the stored unit prices. */
export async function findOpenCart(userId: string): Promise<ShopCart | null> {
  const supabase = await createClient();
  const { data: order } = await supabase
    .from("orders")
    .select("id, status, notes")
    .eq("user_id", userId)
    .in("status", ["draft", "pending_payment"])
    .maybeSingle();
  if (!order) return null;

  const { data: items } = await supabase
    .from("order_items")
    .select("id, product_id, quantity, size, handedness, unit_price, products (item_code, name, image_path)")
    .eq("order_id", order.id)
    .order("created_at");

  const lines: ShopCartLine[] = ((items ?? []) as CartLineRow[]).map(function (row) {
    const product = one(row.products);
    return {
      id: row.id,
      productId: row.product_id,
      itemCode: product?.item_code ?? "",
      name: product?.name ?? "Unknown item",
      imagePath: product?.image_path ?? null,
      size: row.size,
      handedness: toHandedness(row.handedness),
      quantity: row.quantity,
      unitPriceCents: toCents(row.unit_price),
    };
  });

  let totalCents = 0;
  for (const line of lines) {
    totalCents = totalCents + line.unitPriceCents * line.quantity;
  }

  return {
    orderId: order.id as string,
    status: order.status === "pending_payment" ? "pending_payment" : "draft",
    notes: (order.notes as string | null) ?? null,
    lines,
    totalCents,
  };
}

/** The product fields needed to validate an add-to-cart request. */
export async function findProduct(productId: number): Promise<CartProductRecord | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("products")
    .select("id, price, sizes, needs_handedness, is_active")
    .eq("id", productId)
    .maybeSingle();
  if (!data) return null;
  return {
    id: data.id as number,
    price: Number(data.price),
    sizes: (data.sizes as string | null) ?? null,
    needsHandedness: Boolean(data.needs_handedness),
    isActive: Boolean(data.is_active),
  };
}

// Returns the new draft id, or null if the insert failed (for example a
// concurrent request created the cart first; the caller re-reads it).
export async function createDraftOrder(userId: string): Promise<string | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("orders")
    .insert({ user_id: userId, status: "draft" })
    .select("id")
    .single();
  if (error || !data) return null;
  return data.id as string;
}

/** The cart line for this exact product, size and hand, if there is one. */
export async function findMatchingLine(
  orderId: string,
  productId: number,
  size: string | null,
  handedness: Handedness | null
): Promise<CartLineMatch | null> {
  const supabase = await createClient();
  let query = supabase
    .from("order_items")
    .select("id, quantity")
    .eq("order_id", orderId)
    .eq("product_id", productId);
  // Null needs .is() rather than .eq() in SQL.
  query = size ? query.eq("size", size) : query.is("size", null);
  query = handedness ? query.eq("handedness", handedness) : query.is("handedness", null);
  const { data } = await query.limit(1).maybeSingle();
  if (!data) return null;
  return { id: data.id as string, quantity: data.quantity as number };
}

/** Adds a new line to the cart. */
export async function insertLine(line: NewCartLine): Promise<boolean> {
  const supabase = await createClient();
  const { error } = await supabase.from("order_items").insert({
    order_id: line.orderId,
    product_id: line.productId,
    quantity: line.quantity,
    size: line.size,
    handedness: line.handedness,
    unit_price: line.unitPrice,
  });
  return !error;
}

// Scoped to the order so a line id from another order changes nothing.
// Returns false when no row was updated.
export async function updateLineQuantity(orderId: string, itemId: string, quantity: number): Promise<boolean> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("order_items")
    .update({ quantity })
    .eq("id", itemId)
    .eq("order_id", orderId)
    .select("id");
  return !error && (data ?? []).length > 0;
}

/** Deletes a cart line; scoped to the order like updateLineQuantity. */
export async function deleteLine(orderId: string, itemId: string): Promise<boolean> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("order_items")
    .delete()
    .eq("id", itemId)
    .eq("order_id", orderId)
    .select("id");
  return !error && (data ?? []).length > 0;
}

/** Total quantity across all lines in the cart. */
export async function countCartItems(orderId: string): Promise<number> {
  const supabase = await createClient();
  const { data } = await supabase.from("order_items").select("quantity").eq("order_id", orderId);
  let count = 0;
  for (const row of (data ?? []) as { quantity: number }[]) {
    count = count + row.quantity;
  }
  return count;
}

// true when the order moved back to draft, false when it already was a
// draft, null when the database refused.
export async function reopenOrderCart(orderId: string): Promise<boolean | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("reopen_order_cart", { target_order: orderId });
  if (error) return null;
  return Boolean(data);
}

// Dependents and minors are not payers; their guardian pays.
export async function actorCanPay(): Promise<boolean> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("payment_actor_is_payer");
  if (error) return false;
  return data === true;
}

/** Progress of the bulk order currently collecting customer orders, or null. */
export async function findCollectingBulkProgress(): Promise<BulkProgressRecord | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_collecting_bulk_progress");
  if (error) return null;
  const rows = (data ?? []) as { reference: string; threshold: number | string; total_cents: number | string }[];
  const row = rows[0];
  if (!row) return null;
  return {
    reference: row.reference,
    thresholdCents: toCents(row.threshold),
    totalCents: Number(row.total_cents),
  };
}

// Raw order row with its bulk order and lines joined in.
interface OrderListRow {
  id: string;
  status: string;
  notes: string | null;
  created_at: string;
  bulk_orders:
    | { status: string; estimated_arrival: string | null }
    | { status: string; estimated_arrival: string | null }[]
    | null;
  order_items: (Omit<CartLineRow, "product_id" | "products"> & {
    products: { item_code: string; name: string } | { item_code: string; name: string }[] | null;
  })[] | null;
}

// Every order past the editable cart, newest first. pending_payment is
// included so the customer can see an order still waiting for payment.
export async function listCustomerOrders(userId: string): Promise<ShopOrderSummary[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("orders")
    .select(
      "id, status, notes, created_at, bulk_orders (status, estimated_arrival), order_items (id, quantity, size, handedness, unit_price, products (item_code, name))"
    )
    .eq("user_id", userId)
    .neq("status", "draft")
    .order("created_at", { ascending: false });

  return ((data ?? []) as OrderListRow[]).map(function (row) {
    const bulk = one(row.bulk_orders);
    const lines: ShopOrderLineSummary[] = (row.order_items ?? []).map(function (item) {
      const product = one(item.products);
      return {
        id: item.id,
        itemCode: product?.item_code ?? "",
        name: product?.name ?? "Unknown item",
        size: item.size,
        handedness: toHandedness(item.handedness),
        quantity: item.quantity,
        unitPriceCents: toCents(item.unit_price),
      };
    });
    let totalCents = 0;
    for (const line of lines) {
      totalCents = totalCents + line.unitPriceCents * line.quantity;
    }
    return {
      id: row.id,
      status: row.status as ShopOrderSummary["status"],
      notes: row.notes,
      createdAt: row.created_at,
      bulkStatus: bulk?.status ?? null,
      estimatedArrival: bulk?.estimated_arrival ?? null,
      lines,
      totalCents,
    };
  });
}
