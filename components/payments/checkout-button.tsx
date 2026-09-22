"use client";

import { useActionState } from "react";
import { startCheckoutAction } from "@/app/actions/payments";
import { Button } from "@/components/ui/button";

export function CheckoutButton({ bookingId, invoiceId }: { bookingId?: string; invoiceId?: string }) {
  const [state, action, pending] = useActionState(startCheckoutAction, {});
  return (
    <form action={action} className="mt-4 space-y-2">
      {bookingId && <input type="hidden" name="bookingId" value={bookingId} />}
      {invoiceId && <input type="hidden" name="invoiceId" value={invoiceId} />}
      <p className="text-sm text-muted-foreground">Sandbox demonstration - no real money is charged.</p>
      <Button type="submit" disabled={pending}>{pending ? "Preparing checkout…" : "Continue to secure checkout"}</Button>
      {state.error && <p role="alert" className="text-sm text-destructive">{state.error}</p>}
    </form>
  );
}
