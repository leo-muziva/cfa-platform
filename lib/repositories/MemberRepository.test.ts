import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ invite: vi.fn(), rpc: vi.fn(), admin: vi.fn() }))
vi.mock('server-only', () => ({}))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: mocks.admin }))
import { inviteMemberByEmail } from './MemberRepository'

describe('trusted invitation provisioning', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mocks.admin.mockReturnValue({ auth: { admin: { inviteUserByEmail: mocks.invite } }, rpc: mocks.rpc })
    mocks.invite.mockResolvedValue({ data: { user: { id: 'invited-user' } }, error: null })
    mocks.rpc.mockResolvedValue({ error: null })
  })

  it('sends only profile data as user metadata and assigns staff through the privileged RPC', async () => {
    await expect(inviteMemberByEmail('staff@cfa.test', 'Staff', true, 'coach'))
      .resolves.toEqual({ userId: 'invited-user' })
    expect(mocks.invite.mock.calls[0][1].data).toEqual({ full_name: 'Staff' })
    expect(mocks.rpc).toHaveBeenCalledWith('provision_invited_staff', {
      target_user: 'invited-user', target_staff_type: 'coach',
    })
  })

  it('does not provision an ordinary invitation', async () => {
    await inviteMemberByEmail('guest@cfa.test', 'Guest', false, null)
    expect(mocks.rpc).not.toHaveBeenCalled()
  })

  it('reports partial invitation failure without claiming staff access was assigned', async () => {
    mocks.rpc.mockResolvedValue({ error: { message: 'unavailable' } })
    expect(await inviteMemberByEmail('staff@cfa.test', 'Staff', true, 'admin'))
      .toEqual({ error: 'Invitation sent, but staff assignment failed. An administrator must assign staff access before use.' })
  })

  it('never provisions staff after an invitation error', async () => {
    mocks.invite.mockResolvedValue({ data: null, error: { message: 'already registered' } })
    await expect(inviteMemberByEmail('staff@cfa.test', 'Staff', true, 'admin'))
      .resolves.toEqual({ error: 'A user with this email already exists' })
    expect(mocks.rpc).not.toHaveBeenCalled()
  })
})
