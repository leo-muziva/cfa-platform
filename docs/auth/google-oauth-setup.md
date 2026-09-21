# Google OAuth sign-in - setup and implementation plan

Status: plan, not yet implemented. Written 2026-09-15.

## Context

The "Continue with Google" button already exists on both the sign-in and sign-up
flows, and it is not a stub: `components/ui/sign-in.tsx:56-72` and
`components/ui/sign-up.tsx:74-91` both call a real
`supabase.auth.signInWithOAuth({ provider: "google" })`, and
`app/auth/callback/route.ts` already exchanges the returned code for a session.
The button nevertheless cannot work today, for two independent reasons found
during exploration:

1. **The Google provider is not enabled on either Supabase environment.**
   `supabase/config.toml` contains only a disabled `[auth.external.apple]` stub -
   there is no `[auth.external.google]` block - and the in-code comments confirm
   the hosted dashboard provider was never switched on. Clicking the button
   returns `Unsupported provider: provider is not enabled`.

2. **The proxy deletes the PKCE code-verifier cookie on the callback request.**
   This is a real bug that will still break the flow after the provider is
   enabled, so enabling Google alone is not sufficient.

The intended outcome: a user can click "Continue with Google" on
`/auth/login` or `/auth/sign-up`, in both local and hosted environments, and
land signed in with a `profiles` row and a household, exactly as an
email-confirmed signup does.

## The PKCE bug (primary fix)

`lib/supabase/proxy.ts:46-58`:

```ts
const { data: { user }, error } = await supabase.auth.getUser();

if (error) {
  const staleAuthCookies = request.cookies
    .getAll()
    .filter(({ name }) => name.startsWith("sb-") && name.includes("-auth-token"));
  // ...deletes them from both request and response...
}
```

The chain, each link verified:

- `@supabase/auth-js` stores the PKCE verifier under `` `${storageKey}-code-verifier` ``
  (`node_modules/@supabase/auth-js/dist/main/lib/helpers.js:275`), i.e. the
  cookie `sb-<ref>-auth-token-code-verifier`. That name **matches** the filter
  above (`startsWith("sb-")` and `includes("-auth-token")`).
- `getUser()` returns `{ data: { user: null }, error: AuthSessionMissingError }`
  when there is no session (`GoTrueClient.js:2497`) - so `error` is truthy on
  *every* signed-out request, not only genuinely stale ones.
- `/auth/callback` is by definition a signed-out request. `proxy.ts` matches it
  (the matcher excludes only `_next/*` and paths with a file extension, and
  `/auth` is a public prefix so it is not redirected - but the cookie-clearing
  branch runs *before* the public-route check).
- `request.cookies.delete(...)` followed by `NextResponse.next({ request })`
  propagates the deletion downstream, so the route handler never sees the
  verifier; `supabaseResponse.cookies.delete(...)` also expires it in the
  browser, so retrying fails too.

Result: `exchangeCodeForSession(code)` fails with *"invalid request: both auth
code and code verifier should be non-empty"*, and the user is bounced to
`/auth/error`. (It would appear to work for a user who is *already* signed in,
since `getUser()` then succeeds - worth knowing when reproducing.)

**Fix** - two independent guards in `lib/supabase/proxy.ts`:

- Do not treat a missing session as a stale session. `isAuthSessionMissingError`
  is exported from `@supabase/supabase-js` (verified present at runtime), so
  skip the cleanup branch for that error. The comment above the branch says the
  intent is clearing tokens that "refer to a user deleted by a local database
  reset" - that is a *different* error, and the narrowing preserves it.
- Never delete PKCE artifacts: exclude names containing `-code-verifier` from
  the stale-cookie filter regardless.

Extract the selection into a pure helper so it can be unit-tested without a
request object, following the existing `lib/auth-next.ts` + `lib/auth-next.test.ts`
pattern:

- New `lib/supabase/auth-cookies.ts` - `selectStaleAuthCookieNames(names: string[]): string[]`
- New `lib/supabase/auth-cookies.test.ts` - asserts `sb-x-auth-token` and the
  chunked `sb-x-auth-token.0` / `.1` are selected, and that
  `sb-x-auth-token-code-verifier` is not.
- `lib/supabase/proxy.ts` imports the helper and gates the branch on
  `error && !isAuthSessionMissingError(error)`.

## Work plan

### 1. Google Cloud Console (manual, one OAuth client for both environments)

Under **APIs & Services -> Google Auth Platform**:

- *Branding*: app name "Cape Fencing Academy", support email, no logo needed yet.
- *Audience*: **External**. Request only the non-sensitive scopes `openid`,
  `.../auth/userinfo.email`, `.../auth/userinfo.profile`. Apps limited to that
  subset can be set to **In production** without Google's verification review
  and without the unverified-app warning screen, so do publish it - otherwise
  the project is capped at 100 test users whose consent expires after 7 days.
- *Clients* -> Create OAuth client -> **Web application**. Add:
  - Authorized JavaScript origins: `http://localhost:3000` and the hosted app origin.
  - Authorized redirect URIs - these point at **Supabase**, not at the app:
    - `http://127.0.0.1:54321/auth/v1/callback` (local Supabase)
    - `https://<project-ref>.supabase.co/auth/v1/callback` (hosted; copy the exact
      value shown on the Supabase dashboard's Google provider page)
- Keep the Client ID and Client Secret for steps 2 and 5.

### 2. Local Supabase (`supabase/config.toml`)

Add a `[auth.external.google]` block next to the existing Apple stub, mirroring
its shape and comments:

```toml
[auth.external.google]
enabled = true
client_id = "env(SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID)"
# DO NOT commit your OAuth provider secret to git.
secret = "env(SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET)"
redirect_uri = ""
url = ""
# config.toml's own comment states this is required for local Google sign-in.
skip_nonce_check = true
```

Both values go through `env(...)` so nothing secret is committed. They must be
present in the environment when **`npx supabase start`** runs (not when
`npm run dev:local` runs - `scripts/dev-local.mjs` only shells out to
`supabase status`). Put them in the repo-root `.env`, which `.gitignore:35`
already ignores. Per AGENTS.md these values cannot be read from `.env` during
implementation, so the two keys must be confirmed set by hand;
`npx supabase stop && npx supabase start` picks them up.

`site_url = "http://localhost:3000"` and
`additional_redirect_urls = ["http://localhost:3000/**"]` are already correct -
no change needed there.

### 3. Fix `lib/supabase/proxy.ts`

As described in the section above: add `lib/supabase/auth-cookies.ts` +
its colocated test, and narrow the cleanup branch in `proxy.ts`.

### 4. Harden `app/auth/callback/route.ts`

The route currently only handles `?code=`. When Google or Supabase rejects the
request they redirect back with `?error=` / `?error_description=` and **no**
code, so the user currently sees the generic "No code provided" - which hides
the real cause and is exactly what makes this hard to debug.

- Read `error_description` (falling back to `error`) and forward it to
  `/auth/error`.
- Keep `next` on the error redirect so the user can retry into the right place.
- Continue using `safeInternalNext` from `lib/auth-next.ts` - no change there.
- Leave the `redirect()` calls outside any `try` block (they throw `NEXT_REDIRECT`
  by design); the current structure is already correct.

### 5. Hosted Supabase project

Dashboard only, no code:

- **Authentication -> Sign In / Providers -> Google**: enable, paste the same
  Client ID and Secret, and copy the callback URL it displays back into Google
  Cloud's authorized redirect URIs if it differs from step 1.
- **Authentication -> URL Configuration**: set *Site URL* to the deployed origin
  and add `http://localhost:3000/**` plus `<deployed-origin>/**` to the
  *Redirect URLs* allow list. `signInWithOAuth` passes
  `${window.location.origin}/auth/callback`, which must match an allow-list entry.

### 6. Verify profile provisioning, and migrate only if the evidence requires it

Verify first, because the assumption here is genuinely untested.
`handle_new_user` (latest version in
`supabase/migrations/0020_trusted_staff_provisioning.sql`) inserts a `profiles`
row **only** `if new.email_confirmed_at is not null`, and the companion
`on_auth_user_email_confirmed` trigger (`0008_auth_confirmation_lifecycle.sql`)
fires only on an `email_confirmed_at` NULL -> NOT NULL *update*. Whether a Google
user hits either path depends on whether GoTrue sets `email_confirmed_at` in the
INSERT or in a follow-up UPDATE - a version-dependent detail that must be
observed, not assumed.

After steps 1-5, sign in with a fresh Google account against local Supabase and
check, via Studio or `psql`:

```sql
select u.id, u.email, u.email_confirmed_at, u.raw_app_meta_data->>'provider' as provider
from auth.users u order by u.created_at desc limit 1;

select p.id, p.email, p.full_name from public.profiles p order by p.created_at desc limit 1;
select hm.* from public.household_members hm order by hm.created_at desc limit 1;
```

- **If a `profiles` row and a `household_members` row both appear**, no migration
  is needed. `on_profile_created_household`
  (`0003_cfa_platform_foundation.sql:441`) creates the household off the profile
  insert, and Google populates `raw_user_meta_data->>'full_name'`, so
  `full_name` fills in correctly. Record the observation here and stop.
- **If the `profiles` row is missing**, add `supabase/migrations/0017_oauth_profile_provisioning.sql`
  that `create or replace`s `handle_new_user` to also provision when the identity
  did not come from the email provider - keeping the existing
  email-confirmation gate untouched for password signups:

  ```sql
  if new.email_confirmed_at is not null
     or coalesce(new.raw_app_meta_data->>'provider', 'email') <> 'email' then
  ```

  Carry over the `trusted_staff` logic from `0013` verbatim so staff claims stay
  server-controlled, and keep the `on conflict (id) do nothing`. Then re-run the
  verification above after `npx supabase db reset`.

Either way this is a *finding to record*, not a guess to encode.

## Files touched

| File | Change |
| --- | --- |
| `lib/supabase/auth-cookies.ts` | New - pure `selectStaleAuthCookieNames` helper |
| `lib/supabase/auth-cookies.test.ts` | New - colocated Vitest cover |
| `lib/supabase/proxy.ts` | Narrow the stale-cookie branch; use the helper |
| `app/auth/callback/route.ts` | Surface provider `error_description`; preserve `next` |
| `supabase/config.toml` | Add `[auth.external.google]` |
| `docs/auth/google-oauth-setup.md` | This document |
| `supabase/migrations/0017_oauth_profile_provisioning.sql` | **Conditional** - only if step 6 shows the profile is not created |

Untouched on purpose: the sign-in/sign-up components (the button and
`signInWithOAuth` call are already correct), `lib/auth-next.ts`, the glass auth
design, and the email/password and confirmation flows.

## Verification

1. `npm test -- --run` - new `auth-cookies.test.ts` passes; existing
   `lib/auth-next.test.ts`, `lib/supabase/config.test.ts` and the migration text
   tests (`supabase/migrations/auth-confirmation-lifecycle.test.ts`) stay green.
   Note that migration tests assert on SQL *text*, so a new `0017` will not break
   them but also is not runtime evidence.
2. `npm run lint` and `npx tsc --noEmit`.
3. **Regression check for the proxy change** - confirm a signed-out visit to a
   protected path (e.g. `/protected/billing`) still redirects to
   `/auth/login?next=/protected/billing`, and that a genuinely stale cookie
   (sign in, then `npx supabase db reset`, then reload) is still cleared rather
   than looping.
4. **Local end-to-end**: `npx supabase start` -> `npm run dev:local` ->
   `/auth/login` -> "Continue with Google" -> Google consent -> lands on `/`
   signed in. Then open `/protected` and confirm it renders rather than
   redirecting back to login (which is what a missing `profiles` or
   `household_members` row would cause). Run the step 6 SQL and record the result.
5. **Hosted end-to-end**: same click-through against `npm run dev:hosted` or the
   deployed origin, confirming the redirect allow list accepts the origin.
6. Capture screenshots of the consent screen and the signed-in `/protected` page
   for the PR, per AGENTS.md's rule for visible UI changes.
7. `npm run build` before requesting review.

## Troubleshooting

| Symptom | Cause |
| --- | --- |
| `Unsupported provider: provider is not enabled` | Step 2 or 5 not done, or `npx supabase start` was not restarted after editing `config.toml` |
| `invalid request: both auth code and code verifier should be non-empty` | The `proxy.ts` PKCE bug (step 3), or third-party cookies blocked |
| `redirect_uri_mismatch` from Google | The Google Cloud authorized redirect URI does not exactly match the Supabase callback URL - note it is the *Supabase* URL, not the app's `/auth/callback` |
| `requested path is invalid` from Supabase | The origin passed as `redirectTo` is not on the Supabase redirect allow list (step 5) |
| Signed in but `/protected` bounces to login | No `profiles` or `household_members` row - see step 6 |

## Notes and constraints

- AGENTS.md's "documentation edits only" clause was scoped to the earlier spec
  reconciliation. This task involves code and possibly one migration - flagged
  explicitly rather than assuming the older restriction is lifted.
- Only the basic `openid`/`email`/`profile` scopes are requested, so no Google
  verification review and no `access_type=offline` / refresh-token handling is
  needed - the app never calls Google APIs on the user's behalf.
- Google users arrive without `phone`, `date_of_birth`, or emergency contacts.
  That needs no new routing: `app/protected/page.tsx:55` already links to
  `/protected/complete-profile` when the profile is incomplete.

## References

- [Supabase: Login with Google](https://supabase.com/docs/guides/auth/social-login/auth-google)
- [Supabase: Redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls)
- [Supabase CLI config reference](https://supabase.com/docs/guides/local-development/cli/config)
- [Google: When verification is not needed](https://support.google.com/cloud/answer/13464323?hl=en)
- [Google: Unverified apps](https://support.google.com/cloud/answer/7454865?hl=en)
