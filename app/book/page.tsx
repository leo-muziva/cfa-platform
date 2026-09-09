import { redirect } from "next/navigation";
import { safeBookingSlot } from "@/lib/booking-calendar";

export default async function BookingCompatibilityPage({
  searchParams,
}: {
  searchParams: Promise<{ slot?: string }>;
}) {
  const slot = safeBookingSlot((await searchParams).slot);
  redirect(`/protected/book${slot ? `?slot=${encodeURIComponent(slot)}` : ""}`);
}
