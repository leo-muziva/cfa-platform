import { redirect } from 'next/navigation'
import { BookingCalendar } from '@/components/booking-calendar'
import { safeBookingSlot } from '@/lib/booking-calendar'
import { getBookingPageData } from '@/lib/services/PlatformService'

export default async function BookLessonPage({ searchParams }: { searchParams: Promise<{ slot?: string }> }) {
  const slot = safeBookingSlot((await searchParams).slot)
  const data = await getBookingPageData()
  if ('error' in data) {
    const next = `/protected/book${slot ? `?slot=${encodeURIComponent(slot)}` : ''}`
    redirect(`/auth/login?next=${encodeURIComponent(next)}`)
  }
  const participants = data.bookingParticipants.map((member) => ({
    id: member.profile_id,
    label: member.profile?.full_name || member.profile?.email || 'Account member',
  }))

  return (
    <div className="space-y-8">
      <div>
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.26em] text-slate-500">Member Portal</p>
        <h1 className="font-serif text-4xl font-light tracking-tight text-slate-950 sm:text-5xl">Book a lesson</h1>
        <p className="mt-2 text-sm text-slate-600">Choose an available CFA lesson and participant.</p>
      </div>
      <BookingCalendar slots={data.slots} requestedSlotId={slot} participants={participants} isDependent={data.capabilities.isDependent} />
    </div>
  )
}
