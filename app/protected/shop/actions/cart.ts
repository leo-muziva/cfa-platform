"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

// Adds a product to the logged-in user's cart.
// The cart is their order with status 'draft'.
export async function addToCart(
  productId: number,
  size: string | null,
  handedness: string | null
) {
  const supabase = await createClient();

  // Who is logged in? Returns null if nobody.
  const { data: auth } = await supabase.auth.getUser();
  const user = auth?.user;
  if (!user) {
    return { error: "You need to be logged in to order." };
  }

  // Look up the product so we can copy its current price.
  const { data: product } = await supabase
    .from("products")
    .select("id, price")
    .eq("id", productId)
    .single();

  if (!product) {
    return { error: "Product not found." };
  }

  // Do they already have a cart? maybeSingle() returns null instead of
  // erroring when there's no match.
  const { data: existingOrder } = await supabase
    .from("orders")
    .select("id")
    .eq("user_id", user.id)
    .eq("status", "draft")
    .maybeSingle();

  let orderId = existingOrder?.id;

  // No cart yet, so make one.
  if (!orderId) {
    const { data: newOrder, error: createError } = await supabase
      .from("orders")
      .insert({ user_id: user.id, status: "draft" })
      .select("id")
      .single();

    if (createError || !newOrder) {
      return { error: "Could not start an order." };
    }
    orderId = newOrder.id;
  }

  // Is this exact thing already in the cart? Same product, same size,
  // same hand — otherwise it's a separate line.
  let existingQuery = supabase
    .from("order_items")
    .select("id, quantity")
    .eq("order_id", orderId)
    .eq("product_id", productId);

  // Null needs .is() rather than .eq() in SQL.
  existingQuery = size
    ? existingQuery.eq("size", size)
    : existingQuery.is("size", null);

  // The same jacket in a different hand is a different line item,
  // not another one of the same thing.
  existingQuery = handedness
    ? existingQuery.eq("handedness", handedness)
    : existingQuery.is("handedness", null);

  const { data: existingItem } = await existingQuery.maybeSingle();

  if (existingItem) {
    // Already there, so just add one more.
    const { error } = await supabase
      .from("order_items")
      .update({ quantity: existingItem.quantity + 1 })
      .eq("id", existingItem.id);

    if (error) {
      return { error: "Could not update your order." };
    }
  } else {
    // New line in the cart. unit_price copies the price as it is now,
    // so the order remembers what was quoted even if prices change later.
    const { error } = await supabase.from("order_items").insert({
      order_id: orderId,
      product_id: productId,
      quantity: 1,
      size: size,
      handedness: handedness,
      unit_price: product.price,
    });

    if (error) {
      return { error: "Could not add that to your order." };
    }
  }

  // Tell Next these pages have changed so it re-fetches them.
  revalidatePath("/protected/shop");
  revalidatePath("/protected/shop/cart");

  return { success: true };
}

// Changes how many of an item are in the cart.
// Passing 0 or less removes the line entirely.
export async function updateQuantity(itemId: string, quantity: number) {
  const supabase = await createClient();

  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) {
    return { error: "You need to be logged in." };
  }

  if (quantity <= 0) {
    return removeItem(itemId);
  }

  // RLS already stops people editing someone else's cart,
  // so we don't need to check ownership here.
  const { error } = await supabase
    .from("order_items")
    .update({ quantity: quantity })
    .eq("id", itemId);

  if (error) {
    return { error: "Could not update quantity." };
  }

  revalidatePath("/protected/shop/cart");
  return { success: true };
}

// Takes a line out of the cart.
export async function removeItem(itemId: string) {
  const supabase = await createClient();

  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) {
    return { error: "You need to be logged in." };
  }

  const { error } = await supabase
    .from("order_items")
    .delete()
    .eq("id", itemId);

  if (error) {
    return { error: "Could not remove that item." };
  }

  revalidatePath("/protected/shop/cart");
  return { success: true };
}

// Turns the draft order into a real one by changing its status.
export async function submitOrder(notes: string) {
  const supabase = await createClient();

  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) {
    return { error: "You need to be logged in." };
  }

  // Find their cart.
  const { data: order } = await supabase
    .from("orders")
    .select("id")
    .eq("user_id", auth.user.id)
    .eq("status", "draft")
    .maybeSingle();

  if (!order) {
    return { error: "You do not have an order to submit." };
  }

  // Make sure there is actually something in it.
  const { data: items } = await supabase
    .from("order_items")
    .select("id")
    .eq("order_id", order.id);

  if (!items || items.length === 0) {
    return { error: "Your order is empty." };
  }

  // Flip the status. After this the customer can no longer edit it —
  // the database policies only allow changes while status is 'draft'.
  const { error } = await supabase
    .from("orders")
    .update({ status: "submitted", notes: notes || null })
    .eq("id", order.id);

  if (error) {
    return { error: "Could not submit your order." };
  }

  revalidatePath("/protected/shop/cart");
  revalidatePath("/protected/shop/orders");

  return { success: true, orderId: order.id };
}

// How many items are in the logged-in user's cart.
// Returns 0 for anyone not logged in or with no cart.
export async function getCartCount() {
  const supabase = await createClient();

  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) {
    return 0;
  }

  const { data: order } = await supabase
    .from("orders")
    .select("id")
    .eq("user_id", auth.user.id)
    .eq("status", "draft")
    .maybeSingle();

  if (!order) {
    return 0;
  }

  const { data: items } = await supabase
    .from("order_items")
    .select("quantity")
    .eq("order_id", order.id);

  let count = 0;
  for (const item of items ?? []) {
    count = count + item.quantity;
  }

  return count;
}