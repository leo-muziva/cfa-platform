import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
import { withCounterparts } from './PlatformRepository'
import type { FamilyLink } from '@/types/domain'

const pending: FamilyLink = {
  id: 'link-1', guardian_id: 'guardian-1', dependent_id: 'dependent-1', status: 'pending',
  requested_by: 'guardian-1', accepted_by: null, requested_at: '2026-10-07T10:00:00Z',
  accepted_at: null, rejected_at: null, ended_at: null,
  guardian: undefined, dependent: { id: 'dependent-1', full_name: 'Fiona Fencer', email: 'fencer@cfa.test' },
}

describe('family link counterparts', () => {
  it('names the requesting guardian when RLS hid their profile from the dependent', () => {
    const [link] = withCounterparts([pending], [
      { link_id: 'link-1', counterpart_id: 'guardian-1', counterpart_name: 'George Guardian', counterpart_email: 'guardian@cfa.test' },
    ])
    expect(link.guardian).toEqual({ id: 'guardian-1', full_name: 'George Guardian', email: 'guardian@cfa.test' })
    expect(link.dependent?.full_name).toBe('Fiona Fencer')
  })

  it('keeps an embedded profile the caller could already read', () => {
    const visible = { ...pending, guardian: { id: 'guardian-1', full_name: 'Already Visible', email: 'guardian@cfa.test' } }
    const [link] = withCounterparts([visible], [
      { link_id: 'link-1', counterpart_id: 'guardian-1', counterpart_name: 'Other', counterpart_email: 'other@cfa.test' },
    ])
    expect(link.guardian?.full_name).toBe('Already Visible')
  })

  it('leaves links without a counterpart row unchanged', () => {
    expect(withCounterparts([pending], [])).toEqual([pending])
  })
})
