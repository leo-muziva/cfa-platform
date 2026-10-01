import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { fieldErrorsFrom, fieldLabel, validationFailure } from './form-errors'

const schema = z.object({
  full_name: z.string().min(2, 'Too short'),
  phone: z.string().min(5, 'Bad phone').regex(/^\d+$/, 'Digits only'),
})

describe('form errors', () => {
  it('keeps the first message per field', () => {
    const parsed = schema.safeParse({ full_name: 'A', phone: 'x' })
    expect(parsed.success).toBe(false)
    if (parsed.success) return
    expect(fieldErrorsFrom(parsed.error)).toEqual({ full_name: 'Too short', phone: 'Bad phone' })
  })

  it('names a single invalid field in the message', () => {
    const parsed = schema.safeParse({ full_name: 'Alice', phone: '12' })
    if (parsed.success) throw new Error('expected failure')
    expect(validationFailure(parsed.error)).toEqual({ error: 'Phone: Bad phone', fieldErrors: { phone: 'Bad phone' } })
  })

  it('lists every invalid field, using labels when given', () => {
    const parsed = schema.safeParse({ full_name: 'A', phone: '12' })
    if (parsed.success) throw new Error('expected failure')
    expect(validationFailure(parsed.error, { full_name: 'Full name' }).error).toBe('Check the highlighted fields: Full name, Phone')
  })

  it('keeps form-level messages', () => {
    const refined = z.object({ a: z.string() }).refine(() => false, { message: 'Whole form is wrong' })
    const parsed = refined.safeParse({ a: 'x' })
    if (parsed.success) throw new Error('expected failure')
    expect(validationFailure(parsed.error)).toEqual({ error: 'Whole form is wrong', fieldErrors: {} })
  })

  it('humanises snake and camel case names', () => {
    expect(fieldLabel('emergency_contact_phone')).toBe('Emergency contact phone')
    expect(fieldLabel('startsAt')).toBe('Starts at')
  })
})
