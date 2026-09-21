"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isPeachSandboxEnabled } from "@/lib/providers/peach-sandbox";

export async function startCheckoutAction(formData: FormData) {
  if (!isPeachSandboxEnabled()) throw new Error("Online payments are not enabled for this environment.");
  const bookingId = formData.get("bookingId");
  if (typeof bookingId !== "string" || !/^[0-9a-f-]{36}$/i.test(bookingId)) throw new Error("Invalid booking.");
  const db = await createClient();
  const { data: session } = await db.auth.getUser();
  if (!session.user) redirect("/auth/login?next=%2Fprotected%2Fbook");
  const { data, error } = await db.rpc("prepare_peach_sandbox_checkout", { target_booking: bookingId });
  const checkout = Array.isArray(data) ? data[0] : data;
  if (error || !checkout?.attempt_id) throw new Error("This booking cannot be checked out right now.");
  redirect(`/api/payments/peach/checkout?attempt=${encodeURIComponent(checkout.attempt_id)}`);
}
