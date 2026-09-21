import { describe, expect, it } from 'vitest'
import { profileUpdateSchema } from '@/lib/validations/member.schema'

describe('profile reminder preference', () => {
  const profile = { full_name: 'Ada Fencer', phone: '', date_of_birth: null }

  it.each(['email', 'whatsapp', 'both'])('accepts %s', (reminder_preference) => {
    expect(profileUpdateSchema.safeParse({ ...profile, reminder_preference }).success).toBe(true)
  })

  it('rejects an unrecognised reminder channel', () => {
    expect(profileUpdateSchema.safeParse({ ...profile, reminder_preference: 'sms' }).success).toBe(false)
  })
})
