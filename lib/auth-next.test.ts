import { describe, expect, it } from 'vitest'
import { emailConfirmRedirect, loginReasonFor, safeInternalNext } from './auth-next'

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

describe('loginReasonFor', () => {
  it.each([
    ['/protected/book', 'book a lesson'],
    ['/protected/book/coach-1?slot=2', 'book a lesson'],
    ['/protected/shop/cart', 'shop'],
    ['/protected/lessons', 'view your lessons'],
    ['/protected/membership', 'manage your membership'],
    ['/protected/family', 'manage your family'],
    ['/protected/refunds/new?attempt=1', 'request a refund'],
  ])('explains a redirect from %s', (next, reason) => expect(loginReasonFor(next)).toBe(reason))
  it('shows no notice when login was opened directly', () => expect(loginReasonFor('/')).toBeNull())
  it('falls back to a generic reason for other pages', () => expect(loginReasonFor('/protected/admin')).toBe('continue'))
  it('does not match a prefix that is only part of a segment', () => expect(loginReasonFor('/bookings')).toBe('continue'))
})
