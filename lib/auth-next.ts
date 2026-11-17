/**
 * Returns `value` only when it is a path on this site, otherwise
 * `fallback`. Stops a crafted ?next= link from sending someone to another
 * website after login (an open redirect).
 */
export function safeInternalNext(value: string | null | undefined, fallback = '/protected'): string {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return fallback
  try {
    const decoded = decodeURIComponent(value)
    if (!decoded.startsWith('/') || decoded.startsWith('//') || decoded.includes('\\')) return fallback
    const url = new URL(decoded, 'https://internal.invalid')
    return url.origin === 'https://internal.invalid' ? `${url.pathname}${url.search}${url.hash}` : fallback
  } catch { return fallback }
}

// Where a confirmation email link lands: /auth/confirm verifies the account,
// then the login page says it is confirmed and continues to `next`.
export function emailConfirmRedirect(origin: string, next: string): string {
  return `${origin}/auth/confirm?next=${encodeURIComponent(`/auth/login?confirmed=1&next=${encodeURIComponent(next)}`)}`
}

// What a logged-out visitor was trying to do, keyed by where login sends
// them next. Shown on the login page as "Log in or create an account to ...".
const LOGIN_REASONS: ReadonlyArray<readonly [prefix: string, reason: string]> = [
  ['/protected/book', 'book a lesson'],
  ['/book', 'book a lesson'],
  ['/protected/shop', 'shop'],
  ['/shop', 'shop'],
  ['/protected/lessons', 'view your lessons'],
  ['/protected/membership', 'manage your membership'],
  ['/membership-portal', 'manage your membership'],
  ['/protected/family', 'manage your family'],
  ['/family', 'manage your family'],
  ['/protected/refunds', 'request a refund'],
]

/** The reason behind a login redirect, or null when login was opened directly. */
export function loginReasonFor(next: string): string | null {
  const path = next.split(/[?#]/)[0]
  if (!path || path === '/') return null
  const match = LOGIN_REASONS.find(([prefix]) => path === prefix || path.startsWith(`${prefix}/`))
  return match ? match[1] : 'continue'
}
