import { describe, expect, it } from 'vitest'
import { capeTownDateTimeToIso } from './cape-town-time'

describe('capeTownDateTimeToIso', () => {
  it('treats datetime-local values as Cape Town time', () => {
    expect(capeTownDateTimeToIso('2026-08-20T10:00')).toBe('2026-08-20T08:00:00.000Z')
  })

  it('preserves explicitly offset values and invalid input for validation', () => {
    expect(capeTownDateTimeToIso('2026-08-20T10:00:00+02:00')).toBe('2026-08-20T08:00:00.000Z')
    expect(capeTownDateTimeToIso('not-a-date')).toBe('not-a-date')
  })
})
