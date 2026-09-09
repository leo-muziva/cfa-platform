# Current scope audit and live-QA attempt - 2026-07-28

## Result

**BLOCKED - automated baseline passed, fresh browser scenarios did not run.**

This run did not replace the successful 23 July 2026 browser pass. Its purpose
was to recheck the newer current working tree and supply evidence for
`docs/CFA_PROJECT_AUDIT_AND_BEGINNER_GUIDE.md`.

## Passing preparation checks

| Check | Result |
|---|---|
| `npm test -- --run` | PASS - 9 files, 58 tests |
| `npm run lint` | PASS |
| `npm run build` | PASS - 39 non-image application routes |
| `npx supabase init` | PASS - missing local `supabase/config.toml` created |

## Blocking condition

Docker Desktop was launched, but its Linux engine did not become responsive.
Initial `supabase status` reported that the `dockerDesktopLinuxEngine` named
pipe was unavailable. Docker Desktop processes started, while
`wsl.exe --list --verbose` showed `docker-desktop` stopped. The distribution
was started directly and responded, but `docker version`, `docker info`, and
`npx supabase start` did not return a usable engine response.

Because local Supabase could not start:

- Migrations could not be reset and seeded for this run.
- The current Next.js app could not be connected to a fresh local backend.
- Seeded guest, dependent, payer, coach, and admin browser sessions could not be
  executed.
- No fresh browser scenario was marked PASS from source inspection.

## Browser scenarios remaining

- Public responsive pass at 375 x 812, 768 x 1024, and 1280 x 800.
- Password auth, recovery entry points, redirects, refresh persistence, logout,
  and role guards.
- Profile completion and profile edit persistence.
- Membership application, changes requested, resubmission, approval, rejection,
  cancellation, and admin status changes.
- Existing-account family-link request, acceptance, rejection, ending, and
  privacy. Dependent invitations are no longer in scope.
- Lesson creation, participant-based booking, history, and cross-household
  rejection.
- Invoice generation/replay, payment, receipt, and dependent financial
  isolation.
- Admin member list, filters, pagination, invitation, editing, households, and
  navigation.
- BUG-005 admin personal-dependent-count retest.

## Current verdict

**Current working tree ready? NOT SIGNED OFF**

Reason: the automated baseline is green, but the newer current scope lacks a
fresh live browser pass. The historical 23 July phase remains a documented YES;
this blocked attempt does not rewrite that evidence.

## Next-run handoff

Repair or restart Docker Desktop until `docker version` prints both Client and
Server sections. Then run `npx supabase start`, `npx supabase db reset`, and
`npm run dev:local`. Execute the scenarios above with clean cookies between
personas, retain BUG-005 as open until specifically verified, and update the
handbook only from captured browser evidence.
