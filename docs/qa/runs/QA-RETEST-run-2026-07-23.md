# Full critical journey retest - 2026-07-23

## Result

**PASS - 24 of 24 planned Test IDs passed.**

The retest used Chrome against a production-style Next.js build and a
freshly migrated and seeded local Supabase database. All scenarios were
completed through browser interaction. Source inspection was used only
to diagnose failures.

## Coverage

| Group | Test IDs | Result |
|---|---:|---|
| Public and responsive | P0-A1 to P0-A5 | 5 PASS |
| Authentication and session | P0-B1 to P0-B5 | 5 PASS |
| Membership and household | P0-C1 to P0-C5 | 5 PASS |
| Lessons | P0-D1 to P0-D5 | 5 PASS |
| Invoicing and payment | P0-E1 to P0-E4 | 4 PASS |

Supplemental check: the admin booking selector included all four active
profiles.

## Verification highlights

- Public routes returned HTTP 200 without horizontal overflow at
  375x812, 768x1024, and 1280x800.
- Browser login, refresh persistence, logout, and all admin-route guards
  passed.
- Membership approval and decline, household attachment, payer and
  dependent boundaries, and financial isolation passed.
- Guest, dependent, payer, admin, and tampered cross-household booking
  behavior passed.
- Invoice replay remained idempotent at `CFA-001000`; manual settlement
  produced exactly one receipt.
- The only browser error was the expected HTTP 404 when a dependent
  directly requested the forbidden billing route.

## Defects

- BUG-001 through BUG-004 are resolved and browser verified.
- [BUG-005](../bug-reports/BUG-005-admin-personal-dashboard-counts-all-visible-households.md)
  remains open as P2. It does not block the critical journey.

## Environment notes

- Local backend used only the required Supabase services.
- The Next.js Webpack production build passed before the final run.
- Hero and login presentation were not changed during QA fixes.
