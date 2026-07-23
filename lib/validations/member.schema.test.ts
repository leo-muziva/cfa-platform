import { describe, it, expect } from 'vitest'
import {
  profileUpdateSchema,
  adminProfileUpdateSchema,
  memberListFiltersSchema,
} from './member.schema'

describe('memberListFiltersSchema', () => {
  it('defaults to page 1 with no filters', () => {
    expect(memberListFiltersSchema.parse({})).toEqual({ page: 1 })
  })

  it('coerces a valid page string from the URL', () => {
    expect(memberListFiltersSchema.parse({ page: '3' }).page).toBe(3)
  })

  it.each([['abc'], ['0'], ['-2'], ['1.5']])(
    'falls back to page 1 for invalid page %s',
    (page) => {
      expect(memberListFiltersSchema.parse({ page }).page).toBe(1)
    }
  )

  it('accepts valid membership and status values', () => {
    const parsed = memberListFiltersSchema.parse({ membershipStatus: 'member', staffType: 'coach', status: 'inactive' })
    expect(parsed.membershipStatus).toBe('member')
    expect(parsed.staffType).toBe('coach')
    expect(parsed.status).toBe('inactive')
  })

  it('degrades unknown role/status values to undefined instead of throwing', () => {
    const parsed = memberListFiltersSchema.parse({ membershipStatus: 'hacker', staffType: 'owner', status: 'banned' })
    expect(parsed.membershipStatus).toBeUndefined()
    expect(parsed.staffType).toBeUndefined()
    expect(parsed.status).toBeUndefined()
  })

  it('treats empty-string selects ("All roles") as no filter', () => {
    const parsed = memberListFiltersSchema.parse({ membershipStatus: '', staffType: '', status: '', search: '' })
    expect(parsed.membershipStatus).toBeUndefined()
    expect(parsed.status).toBeUndefined()
    expect(parsed.search).toBeUndefined()
  })

  it('trims search input', () => {
    expect(memberListFiltersSchema.parse({ search: '  jane  ' }).search).toBe('jane')
  })

  it('drops search terms longer than 100 characters', () => {
    expect(memberListFiltersSchema.parse({ search: 'x'.repeat(101) }).search).toBeUndefined()
  })
})

describe('profileUpdateSchema', () => {
  it('accepts valid full data', () => {
    const result = profileUpdateSchema.safeParse({
      full_name: 'Jane Smith',
      phone: '+27 21 555 0000',
      date_of_birth: '1990-06-15',
    })
    expect(result.success).toBe(true)
  })

  it('rejects full_name shorter than 2 characters', () => {
    const result = profileUpdateSchema.safeParse({ full_name: 'J' })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].message).toMatch(/at least 2/)
    }
  })

  it('rejects full_name longer than 100 characters', () => {
    const result = profileUpdateSchema.safeParse({ full_name: 'A'.repeat(101) })
    expect(result.success).toBe(false)
  })

  it('accepts missing phone (optional)', () => {
    const result = profileUpdateSchema.safeParse({ full_name: 'Jane Smith' })
    expect(result.success).toBe(true)
  })

  it('accepts empty string phone', () => {
    const result = profileUpdateSchema.safeParse({
      full_name: 'Jane Smith',
      phone: '',
    })
    expect(result.success).toBe(true)
  })

  it('rejects invalid phone format', () => {
    const result = profileUpdateSchema.safeParse({
      full_name: 'Jane Smith',
      phone: 'abc',
    })
    expect(result.success).toBe(false)
  })

  it('accepts null date_of_birth', () => {
    const result = profileUpdateSchema.safeParse({
      full_name: 'Jane Smith',
      date_of_birth: null,
    })
    expect(result.success).toBe(true)
  })
})

describe('adminProfileUpdateSchema', () => {
  it('accepts valid admin update with all fields', () => {
    const result = adminProfileUpdateSchema.safeParse({
      full_name: 'Coach Bob',
      membership_status: 'member',
      is_staff: true,
      staff_type: 'coach',
      is_active: true,
      membership_type_id: '550e8400-e29b-41d4-a716-446655440000',
    })
    expect(result.success).toBe(true)
  })

  it('rejects invalid staff type', () => {
    const result = adminProfileUpdateSchema.safeParse({
      full_name: 'Someone',
      is_staff: true,
      staff_type: 'superuser',
    })
    expect(result.success).toBe(false)
  })

  it('rejects non-UUID membership_type_id', () => {
    const result = adminProfileUpdateSchema.safeParse({
      full_name: 'Someone',
      membership_type_id: 'not-a-uuid',
    })
    expect(result.success).toBe(false)
  })

  it('accepts null membership_type_id', () => {
    const result = adminProfileUpdateSchema.safeParse({
      full_name: 'Someone',
      membership_type_id: null,
    })
    expect(result.success).toBe(true)
  })

  it('accepts both valid staff types', () => {
    const staffTypes = ['admin', 'coach'] as const
    for (const staff_type of staffTypes) {
      const result = adminProfileUpdateSchema.safeParse({
        full_name: 'Test User',
        is_staff: true,
        staff_type,
      })
      expect(result.success).toBe(true)
    }
  })
})
