import { describe, expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
import { aggregateMemberStats, deriveCapabilities } from './MemberService'
import type { HouseholdMember, MemberStatsRow, Profile } from '@/types/domain'

const row = (membership_status: 'guest' | 'member', is_active = true, membershipName: string | null = null,
  staff_type: 'admin' | 'coach' | null = null): MemberStatsRow => ({
  membership_status, is_active, is_staff: staff_type !== null, staff_type,
  membership_type: membershipName ? { name: membershipName } : null,
})

describe('aggregateMemberStats', () => {
  it('returns zeroed stats for an empty club', () => {
    expect(aggregateMemberStats([])).toEqual({ total: 0, active: 0, inactive: 0, guests: 0, members: 0,
      admins: 0, coaches: 0, byMembershipType: {}, unassigned: 0 })
  })

  it('counts independent membership and staff dimensions', () => {
    const stats = aggregateMemberStats([row('guest'), row('member', true, 'Month-to-month'), row('member', false, null, 'admin'), row('guest', true, null, 'coach')])
    expect(stats).toMatchObject({ total: 4, active: 3, inactive: 1, guests: 2, members: 2, admins: 1, coaches: 1 })
    expect(stats.byMembershipType).toEqual({ 'Month-to-month': 1 })
  })
})

describe('deriveCapabilities', () => {
  const profile = { is_staff: false, staff_type: null } as Profile
  it('never grants household money or payment to a dependent', () => {
    const capabilities = deriveCapabilities(profile, { household_role: 'dependent' } as HouseholdMember)
    expect(capabilities.canSeeHouseholdMoney).toBe(false)
    expect(capabilities.canTriggerPayment).toBe(false)
  })
  it('grants payer financial capabilities', () => {
    const capabilities = deriveCapabilities(profile, { household_role: 'payer' } as HouseholdMember)
    expect(capabilities.canSeeHouseholdMoney).toBe(true)
    expect(capabilities.canTriggerPayment).toBe(true)
  })
  it('keeps coach and admin capabilities distinct', () => {
    expect(deriveCapabilities({ ...profile, is_staff: true, staff_type: 'coach' } as Profile, { household_role: 'payer' } as HouseholdMember).canManageStaffArea).toBe(false)
    expect(deriveCapabilities({ ...profile, is_staff: true, staff_type: 'admin' } as Profile, { household_role: 'dependent' } as HouseholdMember).canManageStaffArea).toBe(true)
  })
})
