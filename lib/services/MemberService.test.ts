import { describe, expect, it, vi } from 'vitest' //Vittest is used for unit testing. when we want to test the cde, vittest will open memberservice.test.ts and test whether the permissions is working correctly  
vi.mock('server-only', () => ({})) // server only means "dont let this run in the users browser"

//server only makes sire that the code is only run on the server side and not in the users browser


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
  it('never grants household money or payment to a dependent', () => { //lets pretend that we have a dependent in the household. we want to make sure that the dependent does not have access to household money or payment capabilities. this is important because dependents should not be able to manage household finances. we will create a profile for the dependent and check their capabilities using the deriveCapabilities function. we expect that the dependent will not be able to see household money or trigger payments. this test ensures that our code correctly identifies dependents and restricts their financial capabilities accordingly.
    const capabilities = deriveCapabilities(profile, { household_role: 'dependent' } as HouseholdMember, 'payer-id')
    expect(capabilities.canSeeHouseholdMoney).toBe(false)
    expect(capabilities.canTriggerPayment).toBe(false)

// can the dependent see household money? no, they cannot. can the dependent trigger payment? no, they cannot.

    //did our code correctly identify that the user is a dependent and not a payer? yes, it did. the code is working correctly


  })
  it('grants payer financial capabilities', () => {
    const payer = { ...profile, id: 'payer-id' } as Profile
    const capabilities = deriveCapabilities(payer, { household_role: 'payer' } as HouseholdMember, 'payer-id')
    expect(capabilities.canSeeHouseholdMoney).toBe(true)
    expect(capabilities.canTriggerPayment).toBe(true)
  })
  it('keeps coach and admin capabilities distinct', () => { //keep coach and admin capabilities distinct means that we want to make sure that coaches and admins have different capabilities. we will create a profile for a coach and a profile for an admin and check their capabilities using the deriveCapabilities function. we expect that the coach will not be able to manage the staff area, while the admin will be able to manage the staff area. this test ensures that our code correctly identifies coaches and admins and grants them the appropriate capabilities.
    const coach = { ...profile, id: 'coach-id', is_staff: true, staff_type: 'coach' } as Profile
    const admin = { ...profile, id: 'admin-id', is_staff: true, staff_type: 'admin' } as Profile
    expect(deriveCapabilities(coach, { household_role: 'payer' } as HouseholdMember, 'coach-id').canManageStaffArea).toBe(false)
    expect(deriveCapabilities(admin, { household_role: 'dependent' } as HouseholdMember, 'payer-id').canManageStaffArea).toBe(true)
    expect(deriveCapabilities(admin, { household_role: 'dependent' } as HouseholdMember, 'payer-id').isDependent).toBe(true)
    expect(deriveCapabilities(admin, { household_role: 'dependent' } as HouseholdMember, 'payer-id').canSeeHouseholdMoney).toBe(false)
  })
  it('grants the equipment register to both staff types but nobody else', () => {
    const coach = { ...profile, id: 'coach-id', is_staff: true, staff_type: 'coach' } as Profile
    const admin = { ...profile, id: 'admin-id', is_staff: true, staff_type: 'admin' } as Profile
    const household = { household_role: 'payer' } as HouseholdMember
    expect(deriveCapabilities(coach, household, 'coach-id').canManageEquipment).toBe(true)
    expect(deriveCapabilities(admin, household, 'admin-id').canManageEquipment).toBe(true)
    expect(deriveCapabilities(profile, household, 'payer-id').canManageEquipment).toBe(false)
  })
  it('uses effective billing responsibility instead of a stale household role', () => {
    const linked = { ...profile, id: 'linked-dependent' } as Profile
    const capabilities = deriveCapabilities(linked, { household_role: 'payer' } as HouseholdMember, 'guardian-id')
    expect(capabilities.isDependent).toBe(true)
    expect(capabilities.isPayer).toBe(false)
    expect(capabilities.canSeeHouseholdMoney).toBe(false)
  })
  it('grants coaches personal financial capabilities when they are their own payer', () => {
    const coach = { ...profile, id: 'coach-id', is_staff: true, staff_type: 'coach' } as Profile
    const capabilities = deriveCapabilities(coach, { household_role: 'payer' } as HouseholdMember, 'coach-id')
    expect(capabilities.canSeeHouseholdMoney).toBe(true)
    expect(capabilities.canTriggerPayment).toBe(true)
  })
})
