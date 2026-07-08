import { describe, it, expect } from 'vitest'
import {
  profileUpdateSchema,
  adminProfileUpdateSchema,
} from './member.schema'

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
      role: 'coach',
      is_active: true,
      membership_type_id: '550e8400-e29b-41d4-a716-446655440000',
    })
    expect(result.success).toBe(true)
  })

  it('rejects invalid role', () => {
    const result = adminProfileUpdateSchema.safeParse({
      full_name: 'Someone',
      role: 'superuser',
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

  it('accepts all four valid roles', () => {
    const roles = ['admin', 'coach', 'fencer', 'guardian'] as const
    for (const role of roles) {
      const result = adminProfileUpdateSchema.safeParse({
        full_name: 'Test User',
        role,
      })
      expect(result.success).toBe(true)
    }
  })
})
