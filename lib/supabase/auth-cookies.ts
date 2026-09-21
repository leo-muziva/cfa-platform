/**
 * Returns session cookies that can safely be removed after Supabase confirms
 * that a persisted session is invalid. PKCE verifier cookies are deliberately
 * retained because the OAuth callback needs them to exchange its auth code.
 */
export function selectStaleAuthCookieNames(names: string[]): string[] {
  return names.filter(
    (name) =>
      name.startsWith("sb-") &&
      name.includes("-auth-token") &&
      !name.includes("-code-verifier"),
  );
}
