import type { Metadata } from 'next'
import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { MembershipSection } from '@/components/landing/membership-section'
import { MembershipPanel } from '@/components/portal/membership-panel'
import { getMembershipRequestPageData } from '@/lib/services/PlatformService'

export const metadata: Metadata = {
  title: 'Membership — Cape Fencing Academy',
}

// Prices, the member's current membership and the apply form in one place.
export default async function MembershipPage() {
  const membershipData = await getMembershipRequestPageData()
  if ('error' in membershipData) {
    redirect('/auth/login?next=%2Fprotected%2Fmembership')
  }

  return (
    <div className="space-y-12">
      <header className="max-w-3xl">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.26em] text-muted-foreground">
          Member Portal
        </p>
        <h1 className="font-serif text-4xl font-light tracking-tight text-foreground sm:text-5xl">
          Membership
        </h1>
      </header>

      <Suspense fallback={<p className="text-muted-foreground">Loading membership options...</p>}>
        <MembershipSection
          className="bg-transparent px-0 py-0 sm:px-0 md:px-0 md:py-0"
          ctaHref="#apply-membership"
        />
      </Suspense>

      <div id="apply-membership" className="mx-auto w-full max-w-2xl">
        <MembershipPanel membershipData={membershipData} />
      </div>
    </div>
  )
}
