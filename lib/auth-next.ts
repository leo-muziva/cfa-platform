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
