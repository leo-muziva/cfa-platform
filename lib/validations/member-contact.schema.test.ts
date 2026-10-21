import { describe, it, expect } from 'vitest'
import { profileUpdateSchema, registrationDetailsSchema } from './member.schema'
import { validationFailure } from './form-errors'

const completeProfile = {
  full_name: 'Leo Muziva',
  phone: '+27662642424',
  date_of_birth: '2005-03-05',
  emergency_contact_name: 'Sam Muziva',
  emergency_contact_phone: '+447911123456',
  terms_accepted: true,
  privacy_accepted: true,
  payer_consent: false,
}

describe('phone numbers', () => {
  it.each([
    ['+27662642424', '+27662642424'],
    ['0662642424', '+27662642424'],
    ['+27 66 264 2424', '+27662642424'],
    ['+447911123456', '+447911123456'],
    ['+12025550123', '+12025550123'],
  ])('accepts %s and stores it as %s', (input, stored) => {
    expect(profileUpdateSchema.parse({ full_name: 'Leo', phone: input }).phone).toBe(stored)
  })

  it.each([['+2766264242'], ['12345'], ['not a number'], ['+27 66 264 2424 999']])('rejects %s', (input) => {
    const parsed = profileUpdateSchema.safeParse({ full_name: 'Leo', phone: input })
    expect(parsed.success).toBe(false)
    if (parsed.success) return
    expect(validationFailure(parsed.error).fieldErrors).toEqual({ phone: 'Enter a valid phone number for the selected country' })
  })

  it('keeps phone optional when editing a profile', () => {
    expect(profileUpdateSchema.parse({ full_name: 'Leo', phone: '' }).phone).toBe('')
  })
})

describe('registrationDetailsSchema', () => {
  it('accepts a complete profile', () => {
    expect(registrationDetailsSchema.safeParse(completeProfile).success).toBe(true)
  })

  it('requires every contact detail and names each missing field', () => {
    const parsed = registrationDetailsSchema.safeParse({
      ...completeProfile, phone: '', date_of_birth: '', emergency_contact_name: '', emergency_contact_phone: '',
    })
    if (parsed.success) throw new Error('expected failure')
    expect(Object.keys(validationFailure(parsed.error).fieldErrors).sort()).toEqual([
      'date_of_birth', 'emergency_contact_name', 'emergency_contact_phone', 'phone',
    ])
  })

  it('flags only the invalid field', () => {
    const parsed = registrationDetailsSchema.safeParse({ ...completeProfile, emergency_contact_phone: '0821' })
    if (parsed.success) throw new Error('expected failure')
    expect(validationFailure(parsed.error)).toEqual({
      error: 'Emergency contact phone: Enter a valid phone number for the selected country',
      fieldErrors: { emergency_contact_phone: 'Enter a valid phone number for the selected country' },
    })
  })

  it.each([
    ['2999-01-01', 'Date of birth cannot be in the future'],
    ['1850-06-01', 'Enter a date of birth after 1900'],
    ['2005-02-30', 'Enter a valid date'],
  ])('rejects date of birth %s', (date_of_birth, message) => {
    const parsed = registrationDetailsSchema.safeParse({ ...completeProfile, date_of_birth })
    if (parsed.success) throw new Error('expected failure')
    expect(validationFailure(parsed.error).fieldErrors.date_of_birth).toBe(message)
  })

  it('still requires payer consent for minors', () => {
    const parsed = registrationDetailsSchema.safeParse({ ...completeProfile, date_of_birth: '2015-01-01' })
    if (parsed.success) throw new Error('expected failure')
    expect(validationFailure(parsed.error).fieldErrors).toEqual({ payer_consent: 'Payer consent is required for minors' })
  })
})
