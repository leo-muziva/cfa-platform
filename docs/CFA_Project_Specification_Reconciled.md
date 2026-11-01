# CFA Platform - Reconciled Specification

Reconciled 9 September 2026 against the working tree, including existing uncommitted work. This describes intended behavior separately from source-observed capability; it is not a deployment or QA certification.

## 0. Authority and scope of reconciliation

The supplied [original specification](CFA_Project_Specification.md) is preserved. This document incorporates the confirmed decisions supplied for reconciliation and supersedes conflicting requirements in that original. Preserve existing behavior wherever this document is silent. Missing implementation is work to complete, not a reason to reopen settled product decisions.

The original references `CFA_Payments_Technical_Spec.md`, which was not found in the working-tree file inventory. Its contents, schema and alleged EFT design are not assumed. The local `CFA-SPEC-AUDIT.md` records evidence and unresolved verification; it is not a distributable prerequisite for this specification.

This reconciliation changes documentation only: no application/payment implementation, database changes, staging, commits or deployment. Source inspection cannot establish which migrations are applied to a hosted database.

## 1. Confirmed product scope

CFA's member-facing site, account and membership management, family responsibility, lesson booking, expenses and automated invoicing remain the core scope. The detailed v1 scope also includes pay-now shop orders and stock, payment integration, refunds/credits, saved-card management and notifications. Older three-feature summaries do not exclude these explicit tracks. Equipment-rental policy remains pending; existing rental charges are preserved without assuming a new rental inventory workflow.

Preserve the cinematic hero, top navigation and login design. Continue responsive public pages, profiles and member/guardian/staff portals. Existing membership lifecycle, availability, weapon selection, club closures and other behavior remain unless a confirmed rule below changes them.

## 2. Confirmed behavior

### Accounts, membership and family

- Membership, family responsibility and staff permissions are independent dimensions, not four mutually exclusive roles. Guest/member status and membership lifecycle remain distinct from payer/dependent relationships and admin/coach staff assignments.
- Visitors can register, confirm email, complete profiles and book eligible lessons. Membership applications and promotion to membership require staff review. Retain application resubmission, visible responses, protected private review notes and lifecycle management.
- Dependents retain their own login, profile, membership applications and lesson access, including self-booking. They receive no financial information: prices, balances, invoices, receipts, payment details, credits and financial metadata must be excluded from UI, server responses and direct database access. Hiding navigation is insufficient.
- Link two existing accounts using the existing request/acceptance workflow. Keep one guardian/payer per dependent; do not introduce multiple payers or recreate the removed dependent-invite flow.
- Unlinking and transfers of financial responsibility require staff approval and an audit trail. Minors cannot grant themselves financial access. Preserve historical payer attribution and existing charges when responsibility changes.
- All staff may perform financial operations. Staff may also fence personally and act as guardians. Staff scope and personal/household scope must remain explicit so a personal dashboard does not aggregate every household visible through staff privileges. This does not imply that every staff member may promote other staff.
- Retain month-to-month, six-month, twelve-month and beginner-package products and their existing non-conflicting behavior. Database settings and membership product rows remain authoritative.
- Apply the confirmed 10% six-month discount to six monthly dues. Paid prepayment suppresses covered membership dues only; lessons, joining fees and other charges remain billable. Do not skip the entire payer or member in invoice generation. Coverage must be backed by successful payment and tracked periods.
- Junior/Senior/Social membership categories are prohibited in active functionality and resulting data. Preserve historical migrations that mention them; verify the full migration chain and resulting data instead of rewriting history.

### Lessons

- Retain 30-minute sessions, standing coach schedules, exceptions, weapon compatibility, closures, booking horizons/cutoffs and database-enforced protection against competing bookings.
- Pay-later bookings confirm immediately. Pay-now bookings hold the slot pending payment and release it on expiry. A held slot cannot also be sold to another booking. Dependent self-bookings use monthly billing.
- Double lessons contain at most two participants, cost twice the single lesson price, have one payer and share cancellation/rescheduling as one booking unit. Attendance/no-show outcomes are recorded per participant.
- Rescheduling follows the cancellation policy. A cancellation or reschedule exactly at the free-cancellation boundary is free. Preserve booked prices and applicable policy terms so later settings changes do not rewrite obligations; rescheduling must not silently reprice the booking.
- Staff overrides, coach cancellations and club-closure handling remain, with reasons and audit records. The implementation must reconcile any paid amount through credits/refunds rather than changing issued invoice contents.

### Billing, payments and shop

- The scheduled run on the 25th invoices finalized, uninvoiced charges through the 24th, including older missed charges, plus current-month membership dues. Use CFA's Africa/Johannesburg business dates and an exclusive start-of-25th cutoff. Exclude provisional, voided, waived, already invoiced or otherwise settled charges. Covered prepaid dues are excluded individually.
- Issued invoice contents and totals are immutable, including paid invoices. Corrections use auditable adjustments/credits and subsequent documents. Payment/allocation state may change without rewriting the issued document. Reruns and concurrent runs must not duplicate dues, charges or documents.
- Create an internal payment attempt and reference before starting checkout. Allocate successful payments explicitly, supporting full, partial, split and excess payments. Derive outstanding/paid state from the ledger, not a browser redirect or manual status flag.
- Account credit is the provisional refund default; approved Peach refunds must also be supported. Credit issuance, consumption and remaining balance require an auditable lifecycle. All staff can perform financial operations; sponsor-specific refund approval limits remain pending.
- Shop/equipment orders are always pay-now, produce receipts and must never be attached to monthly invoices. Preserve price snapshots. Reserve stock atomically, release abandoned reservations and support `pending_payment -> paid -> preparing -> ready -> collected`. Retain the original 30-minute order-reservation target, but verify provider expiry compatibility; do not claim all payment sessions last 30 minutes. Late payment must not double-sell released stock or slots.
- Saved cards require secure provider tokenization, consent and lifecycle handling. Saved-card support does not activate recurring automatic membership charging, which remains deferred.

## 3. Settings and pending policies

Use existing database settings as runtime authority. Do not introduce a competing hardcoded `config/pending-decisions.ts`; that path in the original is a proposal, not an existing implementation. Maintain explicit provisional status, non-production provisional indicators and feature gates for unconfirmed capabilities. A default is not sponsor approval.

Source defaults include R300 per single lesson, R550 month-to-month dues, a 24-hour cancellation window and 100% late-cancellation/no-show multipliers. They remain provisional. Original examples of R250/R450 and 50% late cancellation do not override the database. Other product prices and joining fees are also not newly confirmed by this reconciliation.

The six-month discount is confirmed at 10%. Migration `0036_six_month_discount.sql` sets the six-month price from the stored month-to-month price (6 x R550 x 0.9 = R2970), replacing the seeded R3050. The public membership section reads prices from the database and shows the 10% note only when the stored price matches.

| ID | Pending sponsor decision or external dependency | Interim treatment |
| --- | --- | --- |
| J-A/J-B | Peach sandbox and dashboard access | Access is unconfirmed, not known to be available or merely awaiting a secret. Build mock lifecycle first. |
| J-C | Enabled Payment Links, tokenization, refunds, recurring, wallets and Pay by Bank capabilities | Confirm each capability; do not assume all are enabled. |
| J-D | Real Wix export and migration communications | Inspect an authorized sample before mapping; no invented import scripts. |
| J-E | Peach live access | Go-live dependency, separate from sandbox validation. |
| J-01 | VAT registration and treatment | VAT-disabled remains provisional; no claim of tax compliance. |
| J-02 | Cancellation window, late/no-show fees | Existing settings provisional; equality-at-boundary and reschedule consistency are settled. |
| J-03 | Prices, joining fees and product economics | Preserve products and database authority; 10% six-month discount is settled. |
| J-04 | Arrears restrictions and thresholds | Existing arrears blocking remains off. |
| J-05 | Email/WhatsApp channels and operational messaging | Build the engine; external channel enablement remains pending. |
| J-06 | Refund eligibility, windows and deductions | Account credit provisional; approved provider refunds supported. |
| J-07 | Equipment-rental deposit, period and billing policy | Do not invent a rental module; preserve existing charge capability. |
| J-08 | Resolved: family cardinality | One guardian/payer; staff-approved unlink/transfer. |
| J-09 | Additional membership entitlements | Preserve existing product/access rules; unspecified additional benefits remain pending. |
| J-10 | Resolved: category prohibition | No active Junior/Senior/Social categories; preserve historical migrations. |
| J-11 | Refund approval escalation and monetary limits | All staff financial access is settled; no confirmed R1000 owner-only threshold. |
| J-12 | Bank and statement export support | Relevant to deferred EFT reconciliation. |
| J-13 | Physical card terminal | Outside current scope pending a separate decision. |

## 4. Build tracks: observed foundations and remaining work

The original diagram lists ten tracks A-J, not nine. No percentage-complete estimate or promise of a one-file provider swap is supported.

| Track | Source-observed capability | Remaining implementation and acceptance |
| --- | --- | --- |
| A - Data foundation | Migrations 0001-0012; profiles, products, households, memberships/applications, family/billing links, legacy and lesson-v2 bookings, participants, charges, invoice lines, receipts, attempts/events, lesson notifications, audit events and ledger credits. | Extend this ledger; migrate mixed numeric-rand/integer-cent fields to bigint cents with exact conversion, backfill/reconciliation and safe TypeScript serialization. Add allocations, coverage and payment/shop/refund/card structures as needed. Verify fresh migrations, seed and RLS. Do not infer missing companion-schema names as mandatory tables. |
| B - Accounts/access | Confirmed-email profile lifecycle, profile completion, membership review/resubmission, existing-account linking and effective payer lookup. | Staff-approved transfer/unlink, independent staff/personal access and financial isolation across every data path; resolve authorization concerns below. |
| C - Site/portals | Public/auth pages, member profile, membership, family, lessons, billing and staff routes; money-free lesson DTOs and a guarded lesson quote path. | Guardian/dependent data-path verification, revised staff access, saved-card UI and full responsive/accessibility testing. Protect hero/navigation/login. |
| D - Lessons | Migration 0011 adds atomic single/double booking, schedules/exceptions, closures, cancellation/rescheduling, booking-level outcomes, provisional/finalized charges; 0012 adds time options. | Pay-now holds/payment completion/expiry, per-participant outcomes, inclusive cancellation boundary and booked policy snapshots. Current v2 is invoice-only. |
| E - Shop | No complete catalogue/cart/order/stock implementation found. | Product/stock management, atomic reservation and expiry, checkout, receipt/fulfillment, order-to-invoice prohibition and concurrency tests. |
| F - Billing/mock | Manual invoice RPC, billing views, manual paid-status/receipt recording, provider contracts and basic waiver credits exist. | Implement mock provider, payment attempts/allocations, protected scheduled billing, exact cutoff/catch-up, immutability, prepay coverage, credit consumption, refund lifecycle, invoice PDFs/VAT configuration and robust webhook processing. |
| G - Peach | `getPaymentProvider()` returns null; no functional Peach provider found. | Hosted Checkout V2, Payment Links, authenticated notifications/status reconciliation, capability-dependent saved cards/wallets/refunds and sandbox lifecycle tests. Access/capabilities unconfirmed. |
| H - Staff console | Member and application management, household, invoice/payment and lesson/coach/settings/closure screens exist, generally admin-gated. | Staff financial access, refund queue with approval notes, shop/stock tools, comprehensive audit viewer and full-month operation. Manual invoice creation/voiding must respect immutability. |
| I - Notifications | `lesson_notifications` and related trigger plus email contracts exist; email provider returns null. | Durable queue/retries, templates for invoice/payment/booking/refund events, email adapter and gated WhatsApp. A stored event is not delivered email. |
| J - Wix | No validated sample/export mapping established by this review. | Inspect sample, reconstruct family links and reconcile membership data. Plan re-registration/password reset and sponsor communications; do not assume Wix passwords can transfer. |

Primary implementation references: [domain contracts](../types/domain.ts), [MemberService](../lib/services/MemberService.ts), [PlatformService](../lib/services/PlatformService.ts), [PlatformRepository](../lib/repositories/PlatformRepository.ts), [provider contracts](../lib/providers/contracts.ts), [foundation](../supabase/migrations/0003_cfa_platform_foundation.sql), [account/family migration](../supabase/migrations/0005_account_membership_family_booking.sql), [lesson foundation](../supabase/migrations/0011_lesson_booking_demo.sql) and [time options](../supabase/migrations/0019_lesson_time_options.sql).

### Source-level concerns requiring verification

These are static findings, not runtime-reproduced defects. The local audit separates direct requirement conflicts from suspected defects.

1. [Confirmation triggers](../supabase/migrations/0008_auth_confirmation_lifecycle.sql) derive staff flags from `raw_user_meta_data`. Verify crafted registration/confirmation cannot grant staff authority; trusted staff provisioning must be server-controlled.
2. [Legacy role helper](../supabase/migrations/0002_fix_profiles_rls_recursion.sql) reads `profiles.role`, whereas newer service/admin checks use `is_staff`/`staff_type`. Verify coach and admin paths after role changes and reconcile authorization sources.
3. [Guardian profile visibility](../supabase/migrations/0004_payer_household_profile_visibility.sql) uses household membership, while newer linking writes family/billing links. Verify linked guardian profile/name visibility without widening unrelated-account access.
4. The guarded new lesson quote path does not prove financial isolation everywhere. Membership product reads return prices and the older slot path includes prices. Verify dependent membership screens, serialized data and direct queries/RPCs.
5. `recordManualPayment` in PlatformRepository performs invoice, charge and receipt writes separately. Verify partial failure, retries and concurrent submissions; financial completion needs atomic ledger behavior.
6. `run_monthly_invoices` can reuse a payer/period invoice and update its lines/total; waiver code can delete lines and revise totals. Verify issued/paid documents cannot mutate under reruns, late charges or waivers.
7. Existing database tests encode invoice-only/coach-no-money behavior and older booking invoice expectations. Update executable tests for this contract; source-text assertions and historical browser passes do not establish current correctness.

## 5. Sequencing and dependencies

First reconcile authorization, ledger units and invariants against existing data. Then extend accounts, booking policies and hold semantics alongside shop foundations. Build deterministic mock payment lifecycle, billing/coverage/allocations and notifications before full-month staff acceptance. Integrate Peach after access and individual capabilities are verified; complete real sandbox acceptance separately. Wix mapping depends on a sample export. No calendar dates or effort estimates from the original Gantt are commitments.

## 6. Peach integration contract

Target Hosted Checkout V2. It exchanges `clientId`, `clientSecret` and `merchantId` at `/api/oauth/token`, then uses the returned JWT to initiate `/v2/checkout`. Do not describe V2 initiation as the original generic `entityId + secret` HMAC request. Separate initiation authentication, webhook signature verification and other Peach API credentials. [Official Hosted Checkout V2 documentation](https://developer.peachpayments.com/docs/v2-checkout-hosted).

Checkout notifications are signed with the secret token; validate signatures and correlate amount, currency and internal references before ledger effects. Use server-side status reconciliation for ambiguous states; a shopper return is not proof of settlement. Treat IP filtering as additional defense, not a substitute for authenticated verification. [Official Checkout webhooks](https://developer.peachpayments.com/docs/checkout-webhooks), [V2 status](https://developer.peachpayments.com/docs/v2-checkout-status).

Payment Links can produce both link notifications and Checkout notifications, and delivery order is not guaranteed. Correlate both to the same payment attempt and enforce payment-level idempotency as well as event deduplication. Link lifecycle states must not cause duplicate allocation or roll a settled payment back to pending. Timestamps alone are insufficient; reconcile state transitions and uncertain/late outcomes. [Official Payment Links webhooks](https://developer.peachpayments.com/docs/payment-links-webhooks).

These references were checked on 9 September 2026. CFA account access, enabled capabilities, timeout behavior and applicable credentials still require confirmation. Do not send Hosted Checkout redirects as message links without checking the documented single-load limitation; use the Payment Links product for invoice messaging.

## 7. Deliberately deferred

Manual EFT statement reconciliation, recurring auto-charged membership, automatic bank feeds/open banking and physical card terminals remain deferred. Basic manual/off-system payment recording is retained. Pay by Bank availability is unconfirmed, so its predicted uptake is not evidence that EFT reconciliation is unnecessary. Rental expansion awaits J-07. No contents of the missing technical specification are asserted.

## 8. Working agreements and superseded guidance

Extend existing systems; do not create parallel ledgers or replace current products with guessed categories. Use behavior contracts plus verifiable acceptance criteria, preserving useful architecture/security conventions. Document technical decisions in ClickUp as the original working agreement; use existing GitHub issues/PRs for code delivery where applicable. WhatsApp coordination must not be the only decision record. This review did not verify external tracker configuration or post messages.

The following are explicitly superseded wherever they conflict with this document: the original specification; the older account/membership/family specification; scope/status statements in README and earlier setup/demo/sponsor notes; and historical QA readiness claims. Examples include exclusive roles, admin-only finances, invoice-only as final scope, Next.js 15, nested repository paths and two-table schema descriptions. Their useful non-conflicting instructions remain applicable. Cleanup is follow-up work, not silently performed here.

## 9. Acceptance and verification

All boxes below are future implementation acceptance requirements, not claims of current passes.

- [ ] Fresh migration/seed execution leaves only permitted active membership products; exact bigint-cent conversion reconciles historical charges, invoices, receipts and credits.
- [ ] Executable RLS/RPC tests cover anonymous, guest, dependent/minor, payer, coach and admin identities, including staff-as-member/guardian, crafted metadata, direct writes and unrelated-household isolation.
- [ ] Visitors register and book; guardians link existing accounts and book for dependents; dependents manage profiles/applications/lessons with no financial payloads. Unlink/transfer requires staff approval and retains historical debt attribution.
- [ ] Concurrent single/double bookings cannot win the same slot. Pay-now holds expire/release correctly; late success cannot double-book. Pay-later and dependent bookings confirm without checkout.
- [ ] Double attendance can differ by participant. Cancellation/reschedule tests cover just before, exactly at and just after the boundary, modified settings, retained booked prices/policies, overrides and closures.
- [ ] The 25th job includes finalized charges through the 24th and older missed charges plus current-month dues; excludes provisional/already invoiced/covered dues. Test business-date boundaries, reruns and concurrency. Prepaid members' lessons still invoice.
- [ ] Issued/paid invoice contents stay unchanged under reruns, new charges, waivers, refunds and partial payments. Atomic manual payments survive failures/retries without duplicate receipts or partial ledger updates.
- [ ] Mock lifecycle covers success, decline, pending, cancelled, uncertain, late success, duplicate and out-of-order notifications; full/partial/split/overpayment allocations reconcile exactly.
- [ ] Refund request/approve/reject/process, partial refunds and credit consumption work with audit records and remaining balances. Duplicate overlapping Payment Links/Checkout events never allocate twice.
- [ ] Shop checkout reserves stock, settles to receipt, supports fulfillment and releases abandoned stock; server/database tests prohibit shop invoice lines and double-selling on late payment.
- [ ] Saved-card lifecycle and notification queue/retry/templates work; gated channels remain disabled until enabled. Invoice PDF totals/VAT presentation match confirmed settings.
- [ ] Staff can run a complete mock billing month from the console, including personal/guardian use, with an audit trail for all material operations. Mobile, keyboard, accessibility and protected-design regression checks pass.
- [ ] Peach sandbox verification passes for enabled capabilities before live deployment; Wix mapping is validated against an authorized sample. Demo payments are clearly labeled simulated.

Verified command definitions are in [package.json](../package.json): `npm run dev`/`dev:local` use [the local launcher](../scripts/dev-local.mjs) and require running local Supabase; `npm run dev:hosted` starts Next directly with configured hosted settings. `npm run lint` runs ESLint only; `npx tsc --noEmit` is a separate type check; `npm test -- --run` runs Vitest once; `npm run build` runs the webpack production build. `npm run test:db-workflows` runs the two pgTAP workflow files and requires a suitable local database. `npx supabase db reset` is destructive to local data and is not a documentation check.

This documentation change requires link, requirement-coverage and source-consistency checks only. No application, database/RLS, browser or payment tests were executed as part of reconciliation. [QA gates](QA_GATES.md) describe dated evidence and even reference a missing audit guide; they do not certify this working tree or these new requirements.

## 10. Risks and original-section coverage

Unconfirmed prices/policies must not be presented as sponsor-approved. Provider delay leaves real settlement unverified even with a strong mock. Mixed ledger units, authorization inconsistencies, immutable-document handling and credit reuse require explicit tests. Wix data quality and re-registration need planning. Existing uncommitted work means file presence alone cannot establish deployed behavior. Review scope against this specification to avoid duplicate systems or unsupported readiness claims.

| Original section | Reconciled coverage |
| --- | --- |
| 0 - Short version | Sections 0, 4-6: foundations versus gaps; no unsupported 80% or one-file-swap claim. |
| 1 - Scope | Section 1 and deferred work in section 7. |
| 2 - Settled decisions | Section 2 and acceptance in section 9. |
| 3 - Placeholders | Section 3: database authority and explicit pending decisions. |
| 4 - Tracks A-J | Section 4, with source concerns and completion criteria. |
| 5 - Sequencing | Section 5; dates/effort not commitments. |
| 6 - J-A through J-E, J-01 through J-13 | Section 3 register; resolved items distinguished from pending. |
| 7 - Deferred | Section 7. |
| 8 - Agreements | Section 8 and shared local guidance. |
| 9 - Demo-ready | Section 9; expanded tests, prepaid dues rather than whole-member exclusion. |
| 10 - Risks | Section 10 and source concerns in section 4. |
