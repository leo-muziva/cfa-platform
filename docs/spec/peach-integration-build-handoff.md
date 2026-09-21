# Peach Payments integration - build handoff

Audience: an engineer or coding agent implementing Peach Payments in this repository.

Status: research complete, implementation not started. No Peach call in this codebase has ever run against a real account.

Research date: 14 September 2026. Peach rotates documentation; re-verify any URL before relying on it.

Read `AGENTS.md` first. It governs architecture, secrets, testing and commit rules, and overrides anything here that conflicts.

---

## 1. What already exists

The repository is further along than the sponsor proposal implies. Do not rebuild these.

| Layer | File | State |
| --- | --- | --- |
| Provider interface | `lib/providers/payment-types.ts` | Complete |
| Peach adapter | `lib/providers/peach-payment.ts` | Checkout, status and webhook verification implemented; refunds and saved cards are stubs |
| Mock adapter | `lib/providers/mock-payment.ts` | Complete, used for local development |
| Provider selection | `lib/providers/contracts.ts` | Reads env, returns `null` when unconfigured |
| Service | `lib/services/payment-service.ts` | `startCheckout` and `receivePaymentWebhook` |
| Repository | `lib/repositories/payment-repository.ts` | Wraps three RPCs |
| Webhook route | `app/api/payments/webhook/route.ts` | Raw body passthrough |
| Reconciliation job | `app/api/jobs/reconcile-payments/route.ts` | Polls status for pending attempts |
| Ledger schema | `supabase/migrations/0014`-`0019` | Cents-based, RLS-enforced, service-role settlement |

The money path is Server Action to `payment-service` to `payment-repository` to a Supabase RPC. Writes to financial tables are revoked from `authenticated` and `anon`; all settlement runs through `SECURITY DEFINER` functions granted only to `service_role`. Preserve that shape.

`supabase/migrations/0017_payment_lifecycle.sql:41` builds the merchant reference as `'CFA' || upper(substr(replace(attempt.id,'-',''),1,13))`, which is exactly 16 characters. That is deliberate - see the length constraint in section 3.3.

---

## 2. Credentials and environment

Peach issues **three distinct secrets** for one channel. They are not interchangeable.

| Secret | Used for | Env var |
| --- | --- | --- |
| Client Secret | OAuth token exchange | `PEACH_CLIENT_SECRET` (exists) |
| Webhook signing secret | HMAC verification of inbound webhooks | `PEACH_WEBHOOK_SECRET` (exists) |
| Secret Token | HMAC signing of outbound refund requests | **missing - add `PEACH_SECRET_TOKEN`** |

Full variable set read by `lib/providers/contracts.ts`:

```
CFA_PAYMENT_PROVIDER        mock | peach
CFA_MOCK_PAYMENT_SECRET     required for the mock provider; ignored when NODE_ENV=production
NEXT_PUBLIC_SITE_URL        origin for returnUrl and notificationUrl
PEACH_CLIENT_ID
PEACH_CLIENT_SECRET
PEACH_MERCHANT_ID
PEACH_ENTITY_ID
PEACH_WEBHOOK_SECRET
PEACH_WEBHOOK_URL           must byte-match the URL configured in the Peach Dashboard
PEACH_AUTH_BASE_URL
PEACH_CHECKOUT_BASE_URL
PEACH_LINKS_ENABLED / PEACH_LINKS_BASE_URL
PEACH_REFUNDS_ENABLED       currently dead, see 5.2
PEACH_SAVED_CARDS_ENABLED   currently dead, see 5.2
PEACH_SECRET_TOKEN          TO ADD
PEACH_REFUND_BASE_URL       TO ADD
CFA_SCHEDULED_JOB_SECRET    job routes return 401 without it
SUPABASE_SECRET_KEY         service-role settlement writes
```

If any of `PEACH_CLIENT_ID`, `PEACH_CLIENT_SECRET`, `PEACH_MERCHANT_ID`, `PEACH_ENTITY_ID`, `PEACH_WEBHOOK_SECRET` or `PEACH_WEBHOOK_URL` is absent, `getPaymentProvider()` returns `null` and the UI reports "Online payments are not configured". That is the intended failure mode.

The mock provider is selected only when `CFA_PAYMENT_PROVIDER=mock`, `CFA_MOCK_PAYMENT_SECRET` is set, **and** `NODE_ENV` is not `production` (`lib/providers/contracts.ts:30`). That guard is deliberate - it makes it impossible to ship a build that fakes settlement. Do not relax it.

Never read `.env` or `.env.local`. `.env.sample` is the safe template and is the file to update.

---

## 3. Verified Peach contract

Every claim below was checked against live documentation on the research date. Source URLs are given so you can re-verify rather than trust this document.

### 3.1 Hosts

| Service | Sandbox | Production |
| --- | --- | --- |
| OAuth token | `https://sandbox-dashboard.peachpayments.com` | `https://dashboard.peachpayments.com` |
| Checkout V2 and status | `https://testsecure.peachpayments.com` | `https://secure.peachpayments.com` |
| Checkout refund | `https://testapi.peachpayments.com` | `https://api.peachpayments.com` |
| Payment Links | `https://sandbox-l.ppay.io` | `https://links.peachpayments.com` |

Sandbox and production are separate environments with separate credentials. Peach: "Actions taken in sandbox are separate from your live environment and have no effect there." <https://developer.peachpayments.com/docs/dashboard-sandbox>

### 3.2 Token exchange

`POST {auth-host}/api/oauth/token`, `content-type: application/json`, body `{clientId, clientSecret, merchantId}`. Response `{access_token, expires_in, token_type: "Bearer"}`.

The numeric lifetime is **not published**. Read `expires_in` at runtime. The current implementation hardcodes a five minute cache at `lib/providers/peach-payment.ts:70`; replace it. <https://developer.peachpayments.com/docs/checkout-embedded-authentication>

### 3.3 Create checkout

`POST {checkout-host}/v2/checkout`, Bearer auth, plus a `Referer` header containing an allowlisted merchant domain.

Hard constraints from the reference schema:

- `merchantTransactionId` - **required, 8 to 16 characters**. A bare UUID is rejected. Our 16-character `CFA...` reference fits exactly.
- `nonce` - required, 1 to 64 characters, unique per request. This is Peach's duplicate-submission guard.
- `merchantInvoiceId` - optional, but if sent must be 8 to 255 characters. Truncated to 17 characters for FNB, SBSA, MCB and SBM acquiring.
- `amount` - decimal string in major units (rand), 0 to 99999999.99.

The response is `{checkoutId, redirectUrl}` and **carries no result code**. HTTP 200 here proves a checkout session was created, nothing about payment. <https://developer.peachpayments.com/reference/post_v2-checkout>

### 3.4 Status

`GET {checkout-host}/v2/checkout/{checkoutId}/status`, Bearer auth, no `entityId` query parameter.

The existing implementation at `lib/providers/peach-payment.ts:103` is **correct**. A plain `GET /v2/checkout/{checkoutId}` does not exist - that path returns 404 and is absent from Peach's own endpoint index. Do not "fix" the working path.

The response carries `result.code`, `result.description`, `amount`, `currency`, `checkoutId`, `id`, `merchantTransactionId`, `card.last4Digits`, `card.expiryMonth`, `card.expiryYear`, `paymentBrand`, `paymentType` and `timestamp`. <https://developer.peachpayments.com/reference/get_v2-checkout-checkoutid-status>

### 3.5 Webhooks

Headers: `x-webhook-signature-algorithm`, `x-webhook-timestamp`, `x-webhook-id`, `x-webhook-signature`.

Signed message: timestamp, webhook id, url and payload joined by periods - HMAC-SHA256, hex digest, keyed by the webhook signing secret. The `url` component is the **configured** webhook URL, not the path as received. The implementation at `lib/providers/peach-payment.ts:116` matches this exactly and is verified correct.

Body format differs by source:

- Checkout: `application/x-www-form-urlencoded`
- Payment Links: JSON
- **The first configuration webhook is JSON regardless.** Handle both; the content-type branch at `peach-payment.ts:119` already does.

Verify against the **raw** body bytes, never a re-serialised parse.

Webhook signing is **off by default**. It is enabled in the Dashboard under Connect, "Webhook security", "Enable webhook signing", which then reveals the shared secret.

Retries on a non-200 response: 2, 4, 8, 15 and 30 minutes, then hourly and daily for 30 days. <https://developer.peachpayments.com/docs/checkout-webhooks>

IP allowlisting is available as defence in depth, with separate live and sandbox lists. Fetch the current list rather than hardcoding it. <https://developer.peachpayments.com/docs/reference-webhooks>

### 3.6 Refunds

`POST {refund-host}/v1/checkout/refund`, body `{authentication.entityId, amount, paymentType: "RF", currency, id, signature}` where `id` is the original payment id.

**Refunds do not use the OAuth Bearer token.** They are authenticated by an HMAC-SHA256 `signature` keyed by the **Secret Token**:

1. Include all parameters, even empty ones, sorted alphabetically by name. Nested keys flatten to their literal dotted form, for example `authentication.entityId`.
2. Concatenate name and value into one string with no spaces or separators.
3. HMAC-SHA256 with the secret token as key.

Worked example from the docs:

```
amount5.00authentication.entityId8ac7a4ca7802ed8e0178176ca52222dzcurrencyZARid8ac7a4a284c684140184c7a8f19a553zpaymentTypeRF
```

Peach signs its refund responses with the same key - verify them.

**Warning.** `https://developer.peachpayments.com/reference/refund` documents a *different* product: `POST /payments/{uniqueId}` on `api-v2.peachpayments.com`, authenticated with `userId` and `password`. That is the legacy OPPWA Payments API. Do not mix the two.

Partial refunds appear in a worked example but are never stated as supported, and no time limit is documented. Both are open questions for Peach. <https://developer.peachpayments.com/docs/checkout-refund>, <https://developer.peachpayments.com/docs/checkout-authentication>

### 3.7 Capability discovery

`GET {checkout-host}/v2/channels/{entityId}/payment-methods?currency=ZAR`, Bearer auth. The `currency` query parameter is **required**; omitting it returns 400. Response shape is `{"paymentMethods":[{"name":"card"}]}`.

Use this to determine which features are actually enabled on the club's channel instead of relying on anyone's recollection. <https://developer.peachpayments.com/reference/get_v2-channels-entityid-payment-methods>

### 3.8 Tokenisation and saved cards

- `createRegistration: true` tokenises during checkout.
- `allowStoringDetails: true` lets the shopper opt in.
- **The two are mutually exclusive.** Pick one per checkout. With `allowStoringDetails` the shopper may decline, so handle a missing token.
- The token returns as `registrationId`, shaped like `8ac7a49f8e9f15d2018ea09b285f0ebz`, in the checkout response, the status response, and as an optional field on Payment Links webhooks.
- `standingInstruction` carries `type` (`UNSCHEDULED`, `INSTALLMENT`, `RECURRING`), `mode` (`INITIAL`, `REPEATED`), `frequency`, `expiry`, `recurringType`, `industryPractice` and `numberOfInstallments`. This is the merchant-initiated-transaction flag.
- **No deregistration endpoint exists under Checkout V2.** The only documented one is `DELETE /v1/registrations/{id}?entityId={entityId}` on the card host under the OPPWA product, and it is unverified against Checkout-created tokens. Either prove it in sandbox first, or implement removal as a local soft-delete that stops sending the token, and document the limitation.

Recurring must be activated by Peach support; it is not on by default. Tokenisation is billed at R200 per month. <https://developer.peachpayments.com/docs/checkout-tokenisation>, <https://developer.peachpayments.com/docs/dashboard-recurring>, <https://www.peachpayments.com/fees/>

### 3.9 Result codes

Authoritative list: <https://developer.peachpayments.com/docs/dashboard-response-codes>

- Success prefixes: `000.000.`, `000.100.1`, `000.3`, `000.6`, and `000.400.1[12]0`.
- Pending: `000.200.` (short term), `800.400.5` and `100.400.500` (delayed finalisation).
- Everything else is rejected.
- **Sandbox success is `000.100.110`**, "Request successfully processed in Merchant in Integrator Test Mode". Tests must accept it alongside `000.000.000`.
- `100.396.101` ("cancelled by user") and `100.396.104` ("uncertain status, probably cancelled by user") appear on Peach's partner documentation but not the main developer docs. Treat them as secondary-sourced.

### 3.10 Domain allowlisting and local development

**`localhost` cannot be used.** Peach's FAQ: "No, you cannot add a local domain to the allowlist. You can only add publicly accessible domains." The sandbox concession is only that domains need no *verification*, not that local addresses are permitted.

Consequences for setup:

- A public HTTPS hostname is required from day one - Cloudflare Tunnel, ngrok, or a deployed preview domain - registered under Connect, "Allowlisted domains".
- The `Referer` header on `POST /v2/checkout` must match that hostname.
- In production a domain either matches Peach's records immediately or enters pending verification. A domain that fails risk checks is **declined for 14 days**, so register the real domain early.

Lower-friction alternative for most development: set `notificationUrl` per request and poll `GET /v2/checkout/{id}/status`, which returns the same structure as the webhook. That removes the tunnel dependency for everything except webhook-signature work itself. <https://developer.peachpayments.com/docs/checkout-faq>, <https://developer.peachpayments.com/docs/dashboard-connect>

### 3.11 Payment Links

Payment Links use the same HMAC webhook mechanism and the same headers as Checkout; only the body format differs (JSON).

States: `initiated`, `opened`, `processing`, `completed`, `cancelled`, `expired`.

**A single payment fires both a Payment Links webhook and a Checkout webhook**, and delivery order is not guaranteed. Peach: "Payment Links uses Checkout to accept payments. Peach Payments therefore sends you webhooks for Payment Links and Checkout updates." Bulk payment link webhooks are **not signed**. <https://developer.peachpayments.com/docs/payment-links-webhooks>

---

## 4. Test cards

Any future expiry; CVV any three digits, four for Amex.

| Scenario | Card |
| --- | --- |
| Simplest happy path (3DS1 disabled) | `4200000000000000`, `4242424242424242`, MC `5105105105105100` |
| 3DS2 frictionless success | Visa `4200000000000091`, MC `5200000000000007` |
| 3DS2 challenge | Visa `4200000000000042`, MC `5200000000000015` |
| Not enrolled | Visa `4012001037141112` |
| Technical error | Visa `4012001037461114` |

Cards outside the list return `000.400.109 Card is not enrolled for 3DS version 2`. Capitec Pay sandbox uses ID `1111111111214`. PayShap requires `customParameters[enableTestMode]=true`. <https://developer.peachpayments.com/docs/reference-test-and-go-live>

---

## 5. Gaps to close

Everything here can be written and unit-tested against `MockPaymentProvider` before credentials arrive. The order is roughly dependency order.

### 5.1 Configuration

Add `PEACH_SECRET_TOKEN` and `PEACH_REFUND_BASE_URL` to `.env.sample` and to the `PeachConfiguration` construction in `lib/providers/contracts.ts:37-41`.

### 5.2 Dead capability flags

`lib/providers/peach-payment.ts:59` hardcodes `{refunds: false, savedCards: false}`. `PEACH_REFUNDS_ENABLED` and `PEACH_SAVED_CARDS_ENABLED` are threaded into config and then ignored, so both features are unreachable regardless of account state. Wire the capability object to the config flags.

### 5.3 Success-code regex

`lib/providers/peach-payment.ts:28` tests for `000.000.`, `000.100.1`, `000.3` and `000.6`, and omits the documented `000.400.1[12]0` success range. Extend it and add cases to `peach-payment.test.ts`.

### 5.4 Token lifetime

`peach-payment.ts:70` hardcodes a five minute cache. Read `expires_in` from the token response instead.

### 5.5 Refunds

Implement the HMAC signing helper described in 3.6 and the `refund()` method at `peach-payment.ts:124`. This is a separate authentication path from every other call - keep the signing helper isolated and unit-test it against the worked example string in the docs.

### 5.6 Saved cards need a schema change first

`supabase/migrations/0003_cfa_platform_foundation.sql:328-332`:

```sql
create table public.payment_method_references (
  id uuid primary key default gen_random_uuid(), payer_id uuid not null references public.profiles(id),
  provider text not null, provider_customer_id text not null, provider_method_id text not null,
  display_label text, created_at timestamptz not null default now(), unique(payer_id,provider)
);
```

`unique(payer_id, provider)` permits **one saved card per payer**, and there is no last-four, brand, expiry or default-card column. The sponsor proposal promises members can see their last four digits and remove cards at any time. A forward migration is required before saved cards can be built. Store only the `registrationId` and display metadata - never a card number.

### 5.7 Provider refunds do not reverse the ledger

`supabase/migrations/0018_shop_refunds.sql:268-281` - `complete_provider_refund` updates `refund_requests` and, on failure, inserts a `payment_exceptions` row. It never writes a negative `payment_allocations` entry and never changes charge or invoice status. **After a successful card refund the ledger still reads "paid".**

This is a correctness bug in committed code and is independent of Peach access. Fix it with a forward migration before wiring real refunds, and cover it with a pgTAP test.

### 5.8 Payment Links double-notification

`provider_events` (`0003:318-327`) deduplicates on `unique(provider, provider_event_id)`, which handles retries of the *same* event. It does not handle two *different* events describing one payment. Add payment-level idempotency keyed on `merchantTransactionId` so a Links notification and a Checkout notification cannot double-allocate, and so a late `pending` cannot roll a settled payment back. `nextPaymentState` in `payment-types.ts:62-66` already makes `succeeded` absorbing - extend that guarantee into the RPC.

### 5.9 Status-lookup event id collision

`peach-payment.ts:108` builds the dedup key from the provider reference and `raw.timestamp`, falling back to the literal string `"current"`. If Peach omits `timestamp`, every reconciliation pass for that attempt produces an identical event id, so a genuine later state change is silently swallowed as a duplicate. Derive the key from the attempt id plus a monotonic counter or the observed result code.

### 5.10 VAT

No tax columns exist on `invoices`, `invoice_lines`, `shop_orders` or `receipts`. Blocked on the sponsor's VAT registration answer. Do not guess a rate or assume zero-rating; the specification explicitly refuses to claim tax compliance.

### 5.11 Stale domain types

`types/domain.ts:203-260` types money as rand `number`, carries no `*_cents` fields, and omits `'cancelled'` and `'uncertain'` from `PaymentAttempt.status`. It has been stale since migration 0014. Align it before building on top.

### 5.12 Mixed money units

Migration 0014 moved the ledger to integer cents but left numeric-rand compatibility columns in place, synced by the `sync_ledger_cents` trigger. `membership_types.price` and `lesson_slots.price` remain rand `numeric(10,2)` and were never converted. Cents are authoritative after 0014. Read the `*_cents` columns, use `lib/money.ts` for every conversion, and never use floats.

---

## 6. Product rules the integration must honour

From `docs/CFA_Project_Specification_Reconciled.md`, which is authoritative.

- **Shop orders are always pay-now** and must never reach a monthly invoice. This is enforced as a rule, not a convention.
- **Lessons are pay-now or pay-later per booking.** Pay-now holds the slot pending payment and releases it on expiry; a held slot cannot be sold twice. Pay-later confirms immediately.
- **The 25th run** invoices finalised uninvoiced charges through the 24th in `Africa/Johannesburg`, including older missed charges, plus current-period membership dues. Reruns and concurrent runs must not duplicate anything.
- **Issued invoices are immutable**, including paid ones. Corrections are adjustments and credits, never rewrites. Payment state may change without altering the document.
- **Six-month membership carries a confirmed 10% discount.** Note that the seeded price is R3050 against R2970 for 10% off six times R550, and a public component hardcodes "7.5%". That discrepancy is unresolved - do not silently pick one.
- **Account credit is the provisional refund default**; approved card refunds must also be supported.
- **Dependents receive no financial information** - no prices, balances, invoices, receipts, payment details or credits, in UI, in server responses, or through direct database access. Hiding navigation is explicitly insufficient.
- **All staff may perform financial operations**, but personal and guardian scope must stay distinct from staff scope.
- Settlement is derived from the ledger. **A shopper redirect is never proof of payment.**

Deferred and out of scope: manual EFT reconciliation, recurring auto-charged membership, bank feeds, and physical card terminals.

---

## 7. Test requirements

`AGENTS.md` requires tests covering success, validation, permissions and isolation, colocated as `*.test.ts`. Database and security changes require executable migration, RLS and RPC tests exercised as anonymous, guest, dependent, payer, coach and admin, including staff acting personally and as guardians. SQL text assertions are not runtime RLS evidence.

Cases this integration specifically needs:

1. Webhook signature accepted for a valid HMAC, and rejected for a tampered body, a wrong URL, and a wrong secret.
2. First webhook parsed as JSON, subsequent webhooks as form-urlencoded.
3. A duplicate `x-webhook-id` settles exactly once.
4. A Payment Links notification and a Checkout notification for one payment allocate exactly once.
5. A late `pending` after a `succeeded` does not regress state.
6. An amount or currency mismatch between notification and attempt is rejected before any ledger effect.
7. Reconciliation of an abandoned checkout reaches a terminal state without double-allocating.
8. A dependent querying invoices, receipts, payment attempts and charges directly through PostgREST receives nothing.
9. A refund reverses the ledger, and a failed provider refund raises a `payment_exceptions` row without reversing.
10. `merchantTransactionId` generation always lands within 8 to 16 characters.

Commands: `npm test -- --run`, `npm run lint`, `npx tsc --noEmit`, `npm run build`, `npm run test:db-workflows`. Note that `npm run lint` does not type-check; run `tsc` separately.

---

## 8. Suggested order

1. Schema fixes that need no credentials: 5.6, 5.7, 5.11, 5.12.
2. Adapter correctness: 5.1 through 5.4, plus 5.8 and 5.9, all against the mock provider.
3. Obtain sandbox credentials and a public tunnel hostname. Allowlist it.
4. Run `GET /v2/channels/{entityId}/payment-methods?currency=ZAR` as the first live call - it is read-only and proves the credentials work.
5. End-to-end sandbox checkout with `4200000000000000`, then webhook, then reconciliation.
6. Refunds (5.5), once the secret token is in hand.
7. Saved cards, only if tokenisation is activated and the R200 per month is accepted.
8. Live channel, separate from the Wix channel, with the production domain allowlisted.

Do not commit or push without an explicit request, and never to `main`.
