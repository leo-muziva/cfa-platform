import { redirect } from "next/navigation";
import Link from "next/link";
import { getCart } from "@/lib/services/shop-order-service";
import { continueCheckout, reopenOrder } from "../actions/cart";
import { CartItemControls } from "../components/CartItemControls";
import { PayNowButton } from "../components/SubmitOrderButton";
import { formatZar } from "@/lib/money";



/** /protected/shop/cart: the open cart, checkout, and editing a cart that is waiting for payment. */
export default async function CartPage({
  searchParams,
}: {
  searchParams: Promise<{ prices?: string; checkout?: string; reopen?: string }>;
}) {
  const sp = await searchParams;
  const result = await getCart();

  if (!result.ok) {
    redirect("/auth/login?next=%2Fprotected%2Fshop%2Fcart");
  }

  const { cart, canPay, paymentsAvailable } = result;

  if (!cart || cart.lines.length === 0) {
    return (
      <div>
        <h1 className="mb-6 text-2xl font-semibold text-foreground">
          Your cart
        </h1>
        <p className="text-muted-foreground">Your cart is empty.</p>
        <Link
          href="/protected/shop"
          className="mt-4 inline-block underline underline-offset-4"
        >
          Browse the catalogue
        </Link>
      </div>
    );
  }

  const pending = cart.status === "pending_payment";

  const rows = cart.lines.map(function (line) {
    return (
      <div
        key={line.id}
        className="flex items-center justify-between border-b border-border py-4"
      >
        <div>
          <p className="font-mono text-xs text-muted-foreground">
            {line.itemCode}
          </p>
          <p className="font-medium text-foreground">{line.name}</p>

          {line.size ? (
            <p className="text-sm text-muted-foreground">Size: {line.size}</p>
          ) : null}

          {line.handedness ? (
            <p className="text-sm text-muted-foreground">
              {line.handedness === "right" ? "Right handed" : "Left handed"}
            </p>
          ) : null}

          <p className="mt-1 text-sm text-muted-foreground">
            {formatZar(line.unitPriceCents)} each
          </p>
        </div>

        <div className="flex items-center gap-6">
          {/* A pending order is locked until the customer chooses Edit cart. */}
          {pending ? (
            <span className="text-sm text-muted-foreground">
              Qty {line.quantity}
            </span>
          ) : (
            <CartItemControls itemId={line.id} quantity={line.quantity} />
          )}
          <p className="w-24 text-right font-semibold text-foreground">
            {formatZar(line.unitPriceCents * line.quantity)}
          </p>
        </div>
      </div>
    );
  });

  return (
    <div className="mx-auto max-w-3xl">
      <Link
        href="/protected/shop"
        className="text-sm text-muted-foreground underline underline-offset-4"
      >
        Back to catalogue
      </Link>

      <h1 className="mb-6 mt-4 text-2xl font-semibold text-foreground">
        Your cart
      </h1>

      {sp.prices === "changed" && pending ? (
        <div
          role="status"
          className="mb-6 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4"
        >
          <p className="font-medium text-amber-700 dark:text-amber-400">
            Prices have changed
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Some catalogue prices changed since you added these items. Check
            the new total, then continue to payment.
          </p>
        </div>
      ) : null}

      {sp.checkout === "failed" || sp.reopen === "failed" ? (
        <p role="alert" className="mb-6 text-sm text-red-600 dark:text-red-400">
          {sp.checkout === "failed"
            ? "Could not start the payment. Please try again."
            : "Could not reopen your cart. Please try again."}
        </p>
      ) : null}

      {pending ? (
        <div className="mb-6 rounded-2xl border border-border bg-card/80 p-4 backdrop-blur-sm">
          <p className="font-medium text-foreground">Awaiting payment</p>
          <p className="mt-1 text-sm text-muted-foreground">
            This cart is locked while payment is in progress. Continue to
            payment, or choose Edit cart to change it.
          </p>
        </div>
      ) : null}

      <div className="rounded-2xl border border-border bg-card/80 p-5 backdrop-blur-sm">
        <div className="border-t border-border">{rows}</div>

        <div className="mt-6 flex items-center justify-between">
          <p className="text-lg text-foreground">Total</p>
          <p className="text-xl font-semibold text-foreground">
            {formatZar(cart.totalCents)}
          </p>
        </div>
      </div>

      {pending ? (
        <div className="mt-8">
          {cart.notes ? (
            <p className="mb-3 text-sm text-muted-foreground">
              Your note: {cart.notes}
            </p>
          ) : null}

          {/* Dependents and minors cannot pay; their guardian does. */}
          {!canPay ? (
            <p className="mb-3 text-sm text-muted-foreground">
              Your guardian needs to pay for this order.
            </p>
          ) : (
            <form action={continueCheckout}>
              <button
                type="submit"
                disabled={!paymentsAvailable}
                className="w-full rounded-lg bg-black px-4 py-3 text-white disabled:bg-gray-400 dark:bg-violet-600 dark:disabled:bg-white/20"
              >
                Continue to payment - {formatZar(cart.totalCents)}
              </button>
              {!paymentsAvailable ? (
                <p className="mt-2 text-sm text-muted-foreground">
                  Online payment is not available right now.
                </p>
              ) : null}
            </form>
          )}

          <form action={reopenOrder} className="mt-3">
            <button
              type="submit"
              className="w-full rounded-lg border border-border px-4 py-3 text-foreground hover:bg-accent"
            >
              Edit cart
            </button>
          </form>

          <p className="mt-3 text-xs text-gray-500 dark:text-white/60">
            Sandbox demonstration - no real money is charged.
          </p>
        </div>
      ) : (
        <PayNowButton
          totalLabel={formatZar(cart.totalCents)}
          canPay={canPay}
          paymentsAvailable={paymentsAvailable}
          initialNotes={cart.notes ?? ""}
        />
      )}
    </div>
  );
}
