import { BookingCalendar } from "@/components/booking-calendar";
import { PublicPageShell } from "@/components/public-page-shell";
import { listOpenSlots } from "@/lib/repositories/PlatformRepository";
import { getCurrentProfile } from "@/lib/services/MemberService";
import { getBookingPageData } from "@/lib/services/PlatformService";

export default async function PublicBookingPage({
  searchParams,
}: {
  searchParams: Promise<{ slot?: string }>;
}) {
  const [slots, params, profile] = await Promise.all([
    listOpenSlots(),
    searchParams,
    getCurrentProfile(),
  ]);
  const bookingData = profile ? await getBookingPageData() : null;
  const bookingContextError =
    bookingData && "error" in bookingData ? bookingData.error : undefined;
  const participants =
    bookingData && !("error" in bookingData)
      ? bookingData.bookingParticipants.map((member) => ({
          id: member.profile_id,
          label:
            member.profile?.full_name ||
            member.profile?.email ||
            "Account member",
        }))
      : [];

  return (
    <PublicPageShell
      eyebrow="Book a lesson"
      title="Choose your date and time."
      intro="Browse available CFA lessons without signing in. You only need an account when you are ready to confirm your booking."
    >
      <BookingCalendar
        slots={slots}
        requestedSlotId={params.slot}
        isAuthenticated={Boolean(profile)}
        participants={participants}
        isDependent={
          bookingData && !("error" in bookingData)
            ? bookingData.capabilities.isDependent
            : false
        }
        bookingContextError={bookingContextError}
      />
    </PublicPageShell>
  );
}
