import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { MembershipPlans } from '@/components/portal/membership-plans'
import { MembershipPanel, membershipApplyState } from '@/components/portal/membership-panel'
import { getMembershipRequestPageData } from '@/lib/services/PlatformService'
import { getPublicPricingPlans } from '@/lib/services/public-membership-service'

export const metadata: Metadata = {
  title: 'Membership — Cape Fencing Academy',
}

// Prices at the top, then the member's current membership and the apply
// form. The price buttons come back here with ?plan= so the form has that
// plan picked. They're hidden when there's no form to go to. Dependents
// see no prices, like everywhere else in the portal.
export default async function MembershipPage({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string }>
}) {
  const [membershipData, plans, { plan }] = await Promise.all([
    getMembershipRequestPageData(),
    getPublicPricingPlans(),
    searchParams,
  ])
  if ('error' in membershipData) {
    redirect('/auth/login?next=%2Fprotected%2Fmembership')
  }
  const { showForm } = membershipApplyState(membershipData)

  return (
    <div className="space-y-14 py-4">
      {membershipData.canSeeMoney && <MembershipPlans plans={plans} showButtons={showForm} />}

      <div
        id="apply-membership"
        className="mx-auto w-full max-w-2xl border-t border-[#140a2e]/10 pt-12 dark:border-white/10"
      >
        <MembershipPanel membershipData={membershipData} selectedPlanCode={plan} />
      </div>
    </div>
  )
}
