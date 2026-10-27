import { redirect } from "next/navigation";
import { safeBookingSlot } from "@/lib/booking-calendar";

/** /book: old public link; sends people to the portal booking page, keeping a valid ?slot= id. */
export default async function BookingCompatibilityPage({
  searchParams,
}: {
  searchParams: Promise<{ slot?: string }>;
}) {
  const slot = safeBookingSlot((await searchParams).slot);
  redirect(`/protected/book${slot ? `?slot=${encodeURIComponent(slot)}` : ""}`);
}
