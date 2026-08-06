import { redirect } from 'next/navigation'

export default async function BookLessonPage({ searchParams }: { searchParams: Promise<{ slot?: string }> }) {
  const slot = (await searchParams).slot
  redirect('/book' + (slot ? '?slot=' + encodeURIComponent(slot) : ''))
}