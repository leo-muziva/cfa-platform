import "server-only";
import { onlinePaymentsAvailable, startPayment } from "@/lib/services/payment-service";
import {
  actorCanPay,
  countCartItems,
  createDraftOrder,
  deleteLine,
  findCollectingBulkProgress,
  findMatchingLine,
  findOpenCart,
  findOpenCartHeader,
  findProduct,
  getCurrentUserId,
  insertLine,
  listCustomerOrders,
  reopenOrderCart,
  updateLineQuantity,
  type BulkProgressRecord,
  type CartProductRecord,
  type OpenCartHeader,
  type ShopOrderSummary,
} from "@/lib/repositories/shop-order-repository";
import {
  addToCartSchema,
  checkoutSchema,
  removeItemSchema,
  updateQuantitySchema,
  type AddToCartInput,
} from "@/lib/validations/shop.schema";
import type { ShopCart } from "@/types/domain";

// Shop rules. CFA holds no stock, so every order is paid in full up front
// and only a paid order joins the collecting bulk order. The cart is the
// customer's one open order: 'draft' while editable, 'pending_payment'
// once checkout has started and the lines are locked.

export type ShopFailure = { ok: false; error: string; code?: string };
export type ShopResult<T extends object = object> = ({ ok: true } & T) | ShopFailure;

// Every message the shop shows a customer, in one place.
export const SHOP_MESSAGES = {
  signIn: "You need to be logged in to order.",
  invalid: "Check the item and try again.",
  productUnavailable: "This item is not available to order.",
  priceOnRequest: "This item is priced on request. Talk to CFA to order it.",
  chooseSize: "Please choose a size first.",
  noSize: "This item does not come in sizes.",
  chooseHand: "Please choose right or left handed.",
  noHand: "This item is not made for a specific hand.",
  pendingPayment: "Your cart is waiting for payment. Choose Edit cart to change it.",
  noCart: "You do not have a cart in progress.",
  emptyCart: "Your cart is empty.",
  itemMissing: "That item is no longer in your cart.",
  guardianPays: "Your guardian needs to pay for this order.",
  requestFailed: "Could not update your cart. Please try again.",
  reopenFailed: "Could not reopen your cart. Please try again.",
} as const;

// Builds a failed ShopResult, with a machine-readable code when given.
function fail(error: string, code?: string): ShopFailure {
  return code ? { ok: false, error, code } : { ok: false, error };
}

// The sizes column holds "S, M, L".
export function sizeOptions(sizes: string | null): string[] {
  if (!sizes) return [];
  return sizes
    .split(",")
    .map((size) => size.trim())
    .filter((size) => size.length > 0);
}

// Checks the customer's choices against what the product actually offers.
// Returns an error message, or null when the choice is valid.
export function productChoiceError(product: CartProductRecord, input: AddToCartInput): string | null {
  if (!product.isActive) return SHOP_MESSAGES.productUnavailable;
  // A zero price means "price on request"; it cannot be paid online.
  if (!(product.price > 0)) return SHOP_MESSAGES.priceOnRequest;

  const options = sizeOptions(product.sizes);
  if (options.length > 0) {
    if (!input.size || !options.includes(input.size)) return SHOP_MESSAGES.chooseSize;
  } else if (input.size !== null) {
    return SHOP_MESSAGES.noSize;
  }

  if (product.needsHandedness && !input.handedness) return SHOP_MESSAGES.chooseHand;
  if (!product.needsHandedness && input.handedness) return SHOP_MESSAGES.noHand;
  return null;
}

// Finds the open cart, creating a draft when there is none. A concurrent
// request may win the one-open-cart index, so re-read after a failed insert.
async function openOrCreateCart(userId: string): Promise<OpenCartHeader | null> {
  const existing = await findOpenCartHeader(userId);
  if (existing) return existing;
  const createdId = await createDraftOrder(userId);
  if (createdId) return { id: createdId, status: "draft" };
  return findOpenCartHeader(userId);
}

// The editable cart, or a failure when there is none or it is locked.
async function editableCart(userId: string): Promise<{ ok: true; cart: OpenCartHeader } | ShopFailure> {
  const cart = await findOpenCartHeader(userId);
  if (!cart) return fail(SHOP_MESSAGES.itemMissing);
  if (cart.status === "pending_payment") return fail(SHOP_MESSAGES.pendingPayment, "pending_payment");
  return { ok: true, cart };
}

/**
 * Adds one of a product to the customer's cart, creating the cart if
 * needed. Adding the same product, size and hand again raises the quantity.
 */
export async function addToCart(raw: unknown): Promise<ShopResult> {
  const input = addToCartSchema.safeParse(raw);
  if (!input.success) return fail(SHOP_MESSAGES.invalid, "invalid_input");

  const userId = await getCurrentUserId();
  if (!userId) return fail(SHOP_MESSAGES.signIn, "not_authenticated");

  const product = await findProduct(input.data.productId);
  if (!product) return fail(SHOP_MESSAGES.productUnavailable, "product_unavailable");
  const choiceError = productChoiceError(product, input.data);
  if (choiceError) return fail(choiceError, "invalid_choice");

  const cart = await openOrCreateCart(userId);
  if (!cart) return fail(SHOP_MESSAGES.requestFailed);
  if (cart.status === "pending_payment") return fail(SHOP_MESSAGES.pendingPayment, "pending_payment");

  // Same product, size and hand is one line; anything else is a new line.
  const existing = await findMatchingLine(cart.id, product.id, input.data.size, input.data.handedness);
  if (existing) {
    if (existing.quantity >= 99) return fail("You can order at most 99 of one item.", "invalid_input");
    const updated = await updateLineQuantity(cart.id, existing.id, existing.quantity + 1);
    return updated ? { ok: true } : fail(SHOP_MESSAGES.requestFailed);
  }

  // unit_price is a display snapshot; checkout re-prices a draft from the
  // catalogue before any money is requested.
  const inserted = await insertLine({
    orderId: cart.id,
    productId: product.id,
    quantity: 1,
    size: input.data.size,
    handedness: input.data.handedness,
    unitPrice: product.price,
  });
  return inserted ? { ok: true } : fail(SHOP_MESSAGES.requestFailed);
}

/** Removes a line from the editable cart. */
export async function removeItem(raw: unknown): Promise<ShopResult> {
  const input = removeItemSchema.safeParse(raw);
  if (!input.success) return fail(SHOP_MESSAGES.invalid, "invalid_input");

  const userId = await getCurrentUserId();
  if (!userId) return fail(SHOP_MESSAGES.signIn, "not_authenticated");

  const cart = await editableCart(userId);
  if (!cart.ok) return cart;

  const removed = await deleteLine(cart.cart.id, input.data.itemId);
  return removed ? { ok: true } : fail(SHOP_MESSAGES.itemMissing, "not_found");
}

// A quantity of 0 removes the line.
export async function updateQuantity(raw: unknown): Promise<ShopResult> {
  const input = updateQuantitySchema.safeParse(raw);
  if (!input.success) return fail(SHOP_MESSAGES.invalid, "invalid_input");

  if (input.data.quantity === 0) return removeItem({ itemId: input.data.itemId });

  const userId = await getCurrentUserId();
  if (!userId) return fail(SHOP_MESSAGES.signIn, "not_authenticated");

  const cart = await editableCart(userId);
  if (!cart.ok) return cart;

  const updated = await updateLineQuantity(cart.cart.id, input.data.itemId, input.data.quantity);
  return updated ? { ok: true } : fail(SHOP_MESSAGES.itemMissing, "not_found");
}

// Item count for the catalogue header. 0 when signed out or no cart.
export async function getCartCount(): Promise<number> {
  const userId = await getCurrentUserId();
  if (!userId) return 0;
  const cart = await findOpenCartHeader(userId);
  if (!cart) return 0;
  return countCartItems(cart.id);
}

/** The open cart, whether this person may pay for it, and whether online payment is on. */
export async function getCart(): Promise<
  ShopResult<{ cart: ShopCart | null; canPay: boolean; paymentsAvailable: boolean }>
> {
  const userId = await getCurrentUserId();
  if (!userId) return fail(SHOP_MESSAGES.signIn, "not_authenticated");
  const [cart, canPay] = await Promise.all([findOpenCart(userId), actorCanPay()]);
  return { ok: true, cart, canPay, paymentsAvailable: onlinePaymentsAvailable() };
}

// Locks the cart and opens a payment attempt. The database re-prices a
// draft, so pricesChanged tells the customer the total moved.
export async function checkoutOrder(
  raw: unknown
): Promise<{ ok: true; attemptId: string; pricesChanged: boolean } | ShopFailure> {
  const input = checkoutSchema.safeParse(raw ?? {});
  if (!input.success) return fail("Notes must be 500 characters or fewer.", "invalid_input");

  const userId = await getCurrentUserId();
  if (!userId) return fail(SHOP_MESSAGES.signIn, "not_authenticated");

  const cart = await findOpenCart(userId);
  if (!cart) return fail(SHOP_MESSAGES.noCart, "not_found");
  if (cart.lines.length === 0) return fail(SHOP_MESSAGES.emptyCart, "empty_order");

  if (!(await actorCanPay())) return fail(SHOP_MESSAGES.guardianPays, "forbidden");

  const result = await startPayment({
    orderId: cart.orderId,
    ...(input.data.notes !== undefined ? { notes: input.data.notes } : {}),
  });
  if (!result.ok) return fail(result.error, result.code);
  return { ok: true, attemptId: result.attemptId, pricesChanged: result.pricesChanged };
}

// Unlocks a pending order so the customer can change it. Any started
// payment is abandoned by the database.
export async function reopenOrder(): Promise<ShopResult<{ reopened: boolean }>> {
  const userId = await getCurrentUserId();
  if (!userId) return fail(SHOP_MESSAGES.signIn, "not_authenticated");

  const cart = await findOpenCartHeader(userId);
  if (!cart) return fail(SHOP_MESSAGES.noCart, "not_found");
  if (cart.status === "draft") return { ok: true, reopened: false };

  const reopened = await reopenOrderCart(cart.id);
  if (reopened === null) return fail(SHOP_MESSAGES.reopenFailed);
  return { ok: true, reopened };
}

// Bulk order progress with the percentage and whether the threshold is reached.
export interface BulkProgressView extends BulkProgressRecord {
  percent: number;
  reached: boolean;
}

// Paid total of the collecting bulk order, pooled across customers
// without exposing anyone's order rows.
export async function getBulkProgress(): Promise<BulkProgressView | null> {
  const progress = await findCollectingBulkProgress();
  if (!progress) return null;
  const reached = progress.thresholdCents > 0 && progress.totalCents >= progress.thresholdCents;
  const percent =
    progress.thresholdCents > 0
      ? Math.min(100, Math.round((progress.totalCents / progress.thresholdCents) * 100))
      : 0;
  return { ...progress, percent, reached };
}

/** The customer's submitted orders, newest first. */
export async function listOrders(): Promise<ShopResult<{ orders: ShopOrderSummary[] }>> {
  const userId = await getCurrentUserId();
  if (!userId) return fail(SHOP_MESSAGES.signIn, "not_authenticated");
  return { ok: true, orders: await listCustomerOrders(userId) };
}
