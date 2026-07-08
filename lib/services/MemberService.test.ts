import { describe, it, expect } from 'vitest'
import { aggregateMemberStats } from './MemberService'
import type { MemberStatsRow } from '@/types/domain'

const row = (
  role: MemberStatsRow['role'],
  is_active = true,
  membershipName: string | null = null
): MemberStatsRow => ({
  role,
  is_active,
  membership_type: membershipName ? { name: membershipName } : null,
})

describe('aggregateMemberStats', () => {
  it('returns zeroed stats for an empty club', () => {
    const stats = aggregateMemberStats([])
    expect(stats.total).toBe(0)
    expect(stats.active).toBe(0)
    expect(stats.inactive).toBe(0)
    expect(stats.unassigned).toBe(0)
    expect(stats.byRole).toEqual({ admin: 0, coach: 0, fencer: 0, guardian: 0 })
    expect(stats.byMembershipType).toEqual({})
  })

  it('counts totals and active/inactive split', () => {
    const stats = aggregateMemberStats([
      row('fencer', true, 'Junior'),
      row('fencer', false, 'Senior'),
      row('admin', true),
    ])
    expect(stats.total).toBe(3)
    expect(stats.active).toBe(2)
    expect(stats.inactive).toBe(1)
  })

  it('counts every role, including roles with zero members', () => {
    const stats = aggregateMemberStats([
      row('fencer'),
      row('fencer'),
      row('guardian'),
    ])
    expect(stats.byRole).toEqual({ admin: 0, coach: 0, fencer: 2, guardian: 1 })
  })

  it('groups by membership type name and counts unassigned members', () => {
    const stats = aggregateMemberStats([
      row('fencer', true, 'Junior'),
      row('fencer', true, 'Junior'),
      row('fencer', true, 'Senior'),
      row('guardian', true, null),
      row('admin', true, null),
    ])
    expect(stats.byMembershipType).toEqual({ Junior: 2, Senior: 1 })
    expect(stats.unassigned).toBe(2)
  })
})
