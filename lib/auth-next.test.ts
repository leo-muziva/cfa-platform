import { describe, expect, it } from 'vitest'
import { safeInternalNext } from './auth-next'

describe('safeInternalNext', () => {
  it('keeps internal paths with query strings', () => expect(safeInternalNext('/protected/book?slot=1')).toBe('/protected/book?slot=1'))
  it('supports a public-home fallback for direct authentication', () => {
    expect(safeInternalNext(undefined, '/')).toBe('/')
    expect(safeInternalNext('https://evil.test', '/')).toBe('/')
  })
  it.each(['https://evil.test', '//evil.test', '/\\evil.test', '%2F%2Fevil.test', 'not-a-path'])(
    'rejects unsafe destination %s', (value) => expect(safeInternalNext(value)).toBe('/protected'))
})
