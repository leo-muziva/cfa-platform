# Phase 00 - Full critical journey manual test plan

Date: 2026-07-23  
Branch: `qa/full-critical-journey`  
Target: local Next.js application with local Supabase  
Viewports: mobile 375x812 (primary), tablet 768x1024, desktop 1280x800

## Setup

- Docker Desktop and the CFA Supabase stack must be running.
- The website must respond at `http://localhost:3000`.
- Supabase Auth health must return HTTP 200.
- Use the seeded admin, coach, fencer, and guardian personas.
- Clear browser storage and cookies when changing personas.

## Out of scope

- Final Privacy/POPIA and Terms wording
- Payment and email provider delivery
- VAT, refunds, partial payments, credit notes, debit orders, and arrears enforcement
- Lesson cancellation, no-show, recurrence, capacity enforcement, and free-trial rules
- Equipment-rental workflow and unapproved coach credentials
- WhatsApp details pending CFA confirmation

## A - Public and responsive

| ID | Scenario | Steps | Expected |
|---|---|---|---|
| P0-A1 | Homepage loads responsively | Open `/` at all three viewports | HTTP 200, no horizontal overflow, hero and below-hero content render |
| P0-A2 | Public route smoke test | Open `/classes`, `/membership`, `/about`, `/contact`, `/privacy`, `/terms` | Every route returns HTTP 200 and remains usable at all viewports |
| P0-A3 | Account choice is distinct | Open `/auth` | Login, guest signup, and membership request are separate choices |
| P0-A4 | Pricing is accurate | Open `/membership` | R550, R2,970 (marked 10% off six monthly dues), R6,000, R1,000 and separate R350 joining fee appear |
| P0-A5 | Public navigation and footer | Navigate public pages | Primary routes, privacy, terms, contact and social information are reachable |

## B - Authentication and session

| ID | Scenario | Steps | Expected |
|---|---|---|---|
| P0-B1 | Admin password login | `/auth/login`, enter seeded admin credentials, submit | Redirect to `/protected`; no console or network error |
| P0-B2 | Admin dashboard access | After P0-B1, open `/protected/admin` | Admin navigation and dashboard appear |
| P0-B3 | Session survives refresh | Refresh protected route after login | User remains authenticated |
| P0-B4 | Logout protects portal | Use Logout, then open `/protected` | Redirect to `/auth/login` |
| P0-B5 | Non-admin access is rejected | Sign in as coach/fencer/guardian and open every admin route | Redirect to `/protected`, with no admin data in payload |

## C - Membership and household

| ID | Scenario | Steps | Expected |
|---|---|---|---|
| P0-C1 | Guest requests membership | Submit one product from `/protected/membership-request` | One pending request appears and guest status remains |
| P0-C2 | Admin approves request | Approve from admin request queue | Member status and product update atomically; membership and joining-fee charges are created |
| P0-C3 | Admin declines request | Decline a separate pending request | Request closes without membership or charges |
| P0-C4 | Attach dependent | Admin attaches fencer to guardian payer | Household has one adult payer; dependent retains profile history |
| P0-C5 | Dependent financial isolation | Sign in as dependent and inspect UI, direct route and API | No billing entry or financial DTO keys are returned |

## D - Lessons

| ID | Scenario | Steps | Expected |
|---|---|---|---|
| P0-D1 | Admin creates lesson slot | Create a future slot with price and optional capacity | Slot appears once and remains open |
| P0-D2 | Guest booking | Book as guest | Payment mode is forced to pay now and unavailable provider state is honest |
| P0-D3 | Dependent booking | Book as dependent | Only self can be selected and payment mode is forced to pay later |
| P0-D4 | Payer booking | Book for payer and household dependent | Both are allowed; cross-household fencer is rejected |
| P0-D5 | Lesson history attribution | View history after payer books for dependent | History follows fencer and contains no household money |

## E - Invoicing and payment

| ID | Scenario | Steps | Expected |
|---|---|---|---|
| P0-E1 | Generate current-period invoices | Run invoice generation twice | One idempotent invoice per payer/period with sequential CFA reference |
| P0-E2 | Inclusion rules | Compare invoice lines with charges | Includes unpaid pay-later lessons and eligible membership charges only |
| P0-E3 | Record manual payment | Mark unpaid invoice paid | Invoice and charges settle; exactly one receipt appears |
| P0-E4 | Provider unavailable state | Open pay-now and billing surfaces | No simulated success, card, link or email delivery claim |

## Pass criteria

- Every Test ID passes or is explicitly deferred.
- No open P0 or P1 defects.
- Authentication and role regression matrix is green.
- No PASS is based only on source inspection.

## Architecture reference

| Area | Path |
|---|---|
| Auth UI | `components/ui/sign-in.tsx` |
| Server capabilities | `lib/services/MemberService.ts` |
| Platform workflows | `lib/services/PlatformService.ts` |
| Database and RLS | `supabase/migrations/0003_cfa_platform_foundation.sql` |
