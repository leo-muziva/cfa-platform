import { describe, expect, it } from 'vitest'
import { emailConfirmRedirect, safeInternalNext } from './auth-next'

describe('safeInternalNext', () => {
  it('keeps internal paths with query strings', () => expect(safeInternalNext('/protected/book?slot=1')).toBe('/protected/book?slot=1'))
  it('keeps a confirmation login path with the protected booking destination', () => {
    const next = '/auth/login?confirmed=1&next=%2Fprotected%2Fbook%3Fslot%3D1'
    expect(safeInternalNext(next)).toBe('/auth/login?confirmed=1&next=/protected/book?slot=1')
  })
  it('supports a public-home fallback for direct authentication', () => {
    expect(safeInternalNext(undefined, '/')).toBe('/')
    expect(safeInternalNext('https://evil.test', '/')).toBe('/')
  })
  it.each(['https://evil.test', '//evil.test', '/\\evil.test', '%2F%2Fevil.test', 'not-a-path'])(
    'rejects unsafe destination %s', (value) => expect(safeInternalNext(value)).toBe('/protected'))
})

describe('emailConfirmRedirect', () => {
  it('sends the confirmed account to login, then on to next', () => {
    const url = new URL(emailConfirmRedirect('https://cfa.example', '/protected/shop'))
    expect(url.pathname).toBe('/auth/confirm')
    expect(url.searchParams.get('next')).toBe('/auth/login?confirmed=1&next=%2Fprotected%2Fshop')
  })
})
