export function safeInternalNext(value: string | null | undefined, fallback = '/protected'): string {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return fallback
  try {
    const decoded = decodeURIComponent(value)
    if (!decoded.startsWith('/') || decoded.startsWith('//') || decoded.includes('\\')) return fallback
    const url = new URL(decoded, 'https://internal.invalid')
    return url.origin === 'https://internal.invalid' ? `${url.pathname}${url.search}${url.hash}` : fallback
  } catch { return fallback }
}
