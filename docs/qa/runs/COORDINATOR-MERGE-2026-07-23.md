# Coordinator merge - 2026-07-23

## Verdict

**Phase 00 ready? NO**

### Open P0

- [BUG-001](../bug-reports/BUG-001-login-cannot-reach-configured-supabase-host.md) - Login cannot reach configured Supabase host

### Open P1

- [BUG-002](../bug-reports/BUG-002-public-footers-omit-required-links.md) - Public footers omit required links
- Eighteen protected Test IDs remain blocked behind BUG-001.

### Handoff prompt

On branch `qa/full-critical-journey`, fix BUG-001 without changing the
existing login design: correct the browser-facing Supabase URL through
the user’s secret-management process, restart Next.js, and re-run P0-B1.
If login succeeds, verify the seeded admin’s new staff fields before
continuing P0-B2 through P0-E4. Read this merge, the manual test plan,
and BUG-001 before testing.

## Shard summary

| Shard | Scenarios | Status | Report |
|---|---|---|---|
| QA-A | P0-A1 to P0-A5 | Complete with one failure | [Public report](QA-A-run-2026-07-23.md) |
| QA-BF | P0-B1 to P0-E4 | Blocked by P0 | [Protected report](QA-BF-run-2026-07-23.md) |

## Coverage

- Total Test IDs: 24
- PASS: 4
- FAIL: 2
- BLOCKED: 18
- Unaccounted: 0

## Coordinator verification

- Reproduced P0-B1 twice through browser interaction.
- Verified the site and local Auth service independently return HTTP 200.
- Verified the login failure screenshot and console DNS error.
- No product code was changed during QA.

## Product gaps for later review

- Public footer completeness differs between homepage and secondary pages.
- Classes page lacks the requested rough schedule.
- Stock portraits are displayed beside named coaches.
- Achievement and equipment statements still need CFA approval.
- Six-month saving percentage conflicts with the accepted R3,050 price.

## Tracker sync

Local Markdown only. No external issues created.
