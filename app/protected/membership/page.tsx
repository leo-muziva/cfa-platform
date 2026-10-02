import type { Metadata } from 'next'
import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { MembershipSection } from '@/components/landing/membership-section'
import { MembershipPanel, membershipApplyState } from '@/components/portal/membership-panel'
import { getMembershipRequestPageData } from '@/lib/services/PlatformService'

export const metadata: Metadata = {
  title: 'Membership — Cape Fencing Academy',
}

// Prices, the member's current membership and the apply form in one place.
// The pricing card buttons come back here with ?plan= so the form has that
// plan picked. They're hidden when there's no form to go to.
export default async function MembershipPage({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string }>
}) {
  const [membershipData, { plan }] = await Promise.all([
    getMembershipRequestPageData(),
    searchParams,
  ])
  if ('error' in membershipData) {
    redirect('/auth/login?next=%2Fprotected%2Fmembership')
  }
  const { showForm } = membershipApplyState(membershipData)

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
          applyPath="/protected/membership"
          hideCta={!showForm}
        />
      </Suspense>

      <div id="apply-membership" className="mx-auto w-full max-w-2xl">
        <MembershipPanel membershipData={membershipData} selectedPlanCode={plan} />
      </div>
    </div>
  )
}
