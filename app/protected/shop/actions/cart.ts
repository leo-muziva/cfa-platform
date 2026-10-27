"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import * as shop from "@/lib/services/shop-order-service";

// Thin wrappers: the shop service validates input, checks who is signed in
// and enforces the cart rules.

export type CartActionResult = { success: true } | { error: string };

// Converts a service result into the shape the client components expect.
function toActionResult(result: { ok: true } | { ok: false; error: string }): CartActionResult {
  return result.ok ? { success: true } : { error: result.error };
}

// The route that forwards the browser to the payment provider.
function checkoutUrl(attemptId: string) {
  return `/api/payments/checkout?attempt=${encodeURIComponent(attemptId)}`;
}

// Adds a product to the logged-in user's cart (their draft order).
export async function addToCart(
  productId: number,
  size: string | null,
  handedness: string | null
): Promise<CartActionResult> {
  const result = await shop.addToCart({ productId, size, handedness });
  if (result.ok) {
    revalidatePath("/protected/shop");
    revalidatePath("/protected/shop/cart");
  }
  return toActionResult(result);
}

// Changes how many of an item are in the cart. 0 removes the line.
export async function updateQuantity(itemId: string, quantity: number): Promise<CartActionResult> {
  const result = await shop.updateQuantity({ itemId, quantity });
  if (result.ok) revalidatePath("/protected/shop/cart");
  return toActionResult(result);
}

// Takes a line out of the cart.
export async function removeItem(itemId: string): Promise<CartActionResult> {
  const result = await shop.removeItem({ itemId });
  if (result.ok) revalidatePath("/protected/shop/cart");
  return toActionResult(result);
}

// Locks the cart and sends the customer to PayFast. Only returns when
// checkout could not start. If checkout re-priced the draft, the customer
// goes back to the cart to see the new total before paying.
export async function checkoutOrder(notes?: string): Promise<{ error: string }> {
  const result = await shop.checkoutOrder(notes === undefined ? {} : { notes });
  if (!result.ok) {
    revalidatePath("/protected/shop/cart");
    return { error: result.error };
  }
  revalidatePath("/protected/shop");
  revalidatePath("/protected/shop/cart");
  revalidatePath("/protected/shop/orders");
  redirect(result.pricesChanged ? "/protected/shop/cart?prices=changed" : checkoutUrl(result.attemptId));
}

// Form action for "Continue to payment" on an order already awaiting
// payment. The locked order keeps its prices, so this goes straight on.
export async function continueCheckout(): Promise<void> {
  const result = await shop.checkoutOrder({});
  if (!result.ok) redirect("/protected/shop/cart?checkout=failed");
  redirect(checkoutUrl(result.attemptId));
}

// Form action for "Edit cart": unlocks a pending order.
export async function reopenOrder(): Promise<void> {
  const result = await shop.reopenOrder();
  revalidatePath("/protected/shop");
  revalidatePath("/protected/shop/cart");
  revalidatePath("/protected/shop/orders");
  redirect(result.ok ? "/protected/shop/cart" : "/protected/shop/cart?reopen=failed");
}

// How many items are in the logged-in user's cart. 0 when signed out.
export async function getCartCount(): Promise<number> {
  return shop.getCartCount();
}
