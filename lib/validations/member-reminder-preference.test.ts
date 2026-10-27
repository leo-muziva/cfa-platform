import { describe, expect, it } from 'vitest'
import { profileUpdateSchema, reminderPreferenceAllowed } from '@/lib/validations/member.schema'

describe('profile reminder preference', () => {
  const profile = { full_name: 'Ada Fencer', phone: '', date_of_birth: null }

  it.each(['email', 'whatsapp', 'both'])('accepts %s', (reminder_preference) => {
    expect(profileUpdateSchema.safeParse({ ...profile, reminder_preference }).success).toBe(true)
  })

  it('rejects an unrecognised reminder channel', () => {
    expect(profileUpdateSchema.safeParse({ ...profile, reminder_preference: 'sms' }).success).toBe(false)
  })
})

describe('reminder preference while WhatsApp is off', () => {
  it('only allows email', () => {
    expect(reminderPreferenceAllowed('email', false)).toBe(true)
    expect(reminderPreferenceAllowed('whatsapp', false)).toBe(false)
    expect(reminderPreferenceAllowed('both', false)).toBe(false)
  })

  it('keeps the saved choice when the field is left out', () => {
    expect(reminderPreferenceAllowed(undefined, false)).toBe(true)
  })

  it('allows every option once WhatsApp is on', () => {
    expect(reminderPreferenceAllowed('whatsapp', true)).toBe(true)
    expect(reminderPreferenceAllowed('both', true)).toBe(true)
  })
})
