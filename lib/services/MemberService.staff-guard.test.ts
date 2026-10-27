import { beforeEach, describe, expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))

const getUser = vi.fn()
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => ({ auth: { getUser } }) }))
vi.mock('@/lib/repositories/MemberRepository', () => ({
  getProfileById: vi.fn(),
  adminUpdateProfile: vi.fn(),
}))
vi.mock('@/lib/repositories/PlatformRepository', () => ({ getMembership: vi.fn() }))

import * as repo from '@/lib/repositories/MemberRepository'
import { adminUpdateMember, changesOwnStaffAccess, OWN_STAFF_ACCESS_MESSAGE } from './MemberService'
import type { Profile } from '@/types/domain'

const mocked = vi.mocked(repo)
const alice = { id: 'alice', is_staff: true, staff_type: 'admin', is_active: true } as Profile
const form = (overrides: Record<string, unknown> = {}) => ({
  full_name: 'Alice Admin', is_staff: true, staff_type: 'admin', is_active: true, ...overrides,
})

describe('changesOwnStaffAccess', () => {
  it('flags an admin removing or changing their own staff access', () => {
    expect(changesOwnStaffAccess(alice, 'alice', { is_staff: false, staff_type: null })).toBe(true)
    expect(changesOwnStaffAccess(alice, 'alice', { is_staff: true, staff_type: 'coach' })).toBe(true)
  })

  it('flags an admin deactivating their own account', () => {
    expect(changesOwnStaffAccess(alice, 'alice', { is_staff: true, staff_type: 'admin', is_active: false })).toBe(true)
    expect(changesOwnStaffAccess(alice, 'bob', { is_active: false })).toBe(false)
  })

  it('allows saving your own record with the same staff access', () => {
    expect(changesOwnStaffAccess(alice, 'alice', { is_staff: true, staff_type: 'admin' })).toBe(false)
    expect(changesOwnStaffAccess(alice, 'alice', {})).toBe(false)
  })

  it('never blocks changes to someone else', () => {
    expect(changesOwnStaffAccess(alice, 'bob', { is_staff: false, staff_type: null })).toBe(false)
  })
})

describe('adminUpdateMember staff guard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getUser.mockResolvedValue({ data: { user: { id: 'alice' } } })
    mocked.getProfileById.mockResolvedValue(alice)
    mocked.adminUpdateProfile.mockImplementation(async (id) => ({ ...alice, id }) as Profile)
  })

  it('rejects a forged request that removes your own staff access', async () => {
    const result = await adminUpdateMember('alice', form({ is_staff: false, staff_type: null }))
    expect(result).toEqual({ error: OWN_STAFF_ACCESS_MESSAGE })
    expect(mocked.adminUpdateProfile).not.toHaveBeenCalled()
  })

  it('rejects a forged request that deactivates your own account', async () => {
    const result = await adminUpdateMember('alice', form({ is_active: false }))
    expect(result).toEqual({ error: OWN_STAFF_ACCESS_MESSAGE })
    expect(mocked.adminUpdateProfile).not.toHaveBeenCalled()
  })

  it('still saves your own record when staff access is unchanged', async () => {
    const result = await adminUpdateMember('alice', form({ full_name: 'Alice A. Admin' }))
    expect(result).toHaveProperty('profile')
    expect(mocked.adminUpdateProfile).toHaveBeenCalledOnce()
  })

  it("still lets an admin change another member's staff access", async () => {
    const result = await adminUpdateMember('bob', form({ full_name: 'Bob Coach', is_staff: false, staff_type: null }))
    expect(result).toHaveProperty('profile')
    expect(mocked.adminUpdateProfile).toHaveBeenCalledWith('bob', expect.objectContaining({ is_staff: false }))
  })
})
