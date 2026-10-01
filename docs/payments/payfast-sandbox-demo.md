# PayFast sandbox setup and payment demo

This integration exercises CFA's shared payment lifecycle through PayFast's sandbox. A future Peach adapter must implement the same checkout and verified-event contract. Changing credentials alone cannot switch payment providers. The booking, invoice, shop order and settlement rules belong to CFA and should be reused when that adapter is added.

This guide is a setup and acceptance checklist, not evidence of a successful deployment or payment. Use synthetic staging accounts and sandbox funds only.

## Staging setup

1. Deploy the application changes and apply `0025_provider_neutral_payments.sql` after `0024_peach_sandbox_checkout.sql` to the staging database. For shop checkout, also apply `0029_shop_order_payments.sql` after `0028_order_handedness.sql`. It adds the `pending_payment` and `paid` order states, links shop charges and payment attempts to orders and replaces the shared checkout, status and settlement routines. For refunds, apply `0030_enable_rls_ledger_lesson_tables.sql` and then `0031_refunds.sql` after 0029. 0030 enables row level security on the remaining ledger and lesson tables; 0031 adds refund requests, the refund routines, the `refunded` order state, a read policy for payment allocations and closes anonymous reads of bulk orders. Deployment and hosted migration are separate operational steps; do not reset the hosted database.
2. Keep the existing Supabase public configuration and server-only `SUPABASE_SECRET_KEY` configured for the same staging project. Settlement needs the privileged server client. Never expose that key through a `NEXT_PUBLIC_` variable.
3. In PayFast's sandbox Account Information screen, set a Salt Passphrase. Copy the sandbox merchant ID, merchant key and passphrase directly into the hosting platform's environment settings. Do not paste credentials into chat, source files, screenshots or logs.
4. Configure the values below and redeploy so the server receives them. `PAYMENT_PUBLIC_ORIGIN` must be the public HTTPS staging origin, with no route, query or fragment.

```text
PAYMENT_PROVIDER=payfast_sandbox
PAYFAST_SANDBOX_ENABLED=true
PAYMENT_PUBLIC_ORIGIN=https://your-staging-host.example
PAYFAST_MERCHANT_ID=<sandbox merchant ID>
PAYFAST_MERCHANT_KEY=<sandbox merchant key>
PAYFAST_PASSPHRASE=<sandbox Salt Passphrase>
# Optional, off by default. Enables the unverified PayFast refund API path.
PAYFAST_REFUNDS_ENABLED=false
```

The safe `.env.sample` lists configuration names, not real credentials. The former `CFA_PAYMENT_PROVIDER=mock` selector does not select this checkout implementation. Incomplete or disabled sandbox configuration must leave online checkout unavailable.

PayFast's hosted form protocol includes the merchant key in the submitted browser form. It is not the passphrase. The passphrase stays on the server and is used to create and verify signatures. Do not add it to form fields or browser code. Refer to the [official PayFast integration documentation](https://developers.payfast.co.za/) for the protocol and sandbox instructions.

## Public URLs and payment confirmation

For the configured staging origin, the routes are:

| Purpose | Path |
| --- | --- |
| Authenticated checkout | `/api/payments/checkout?attempt=<CFA payment-attempt ID>` |
| Public PayFast ITN callback | `/api/payments/payfast/webhook` |
| Authenticated payment result | `/protected/payments/<CFA payment-attempt ID>` |
| Shop cart (starts shop checkout) | `/protected/shop/cart` |
| Shop order history | `/protected/shop/orders` |
| Payer refunds (list and request) | `/protected/refunds` |
| Staff refund queue | `/protected/admin/refunds` |

CFA supplies the notification and return URLs when constructing checkout. An ITN is PayFast's server-to-server payment notification. The webhook must accept PayFast's requests without a CFA login, hosting preview password or access challenge. Confirm that both the application proxy and hosting access protection allow this exact callback path. Keep payer checkout and result pages authenticated.

Only a verified notification followed by successful shared settlement can mark a payment paid. Returning from checkout, refreshing the result page or opening a success-looking URL does not prove payment. A pending result can mean the ITN is still arriving; inspect PayFast's ITNs screen and staging server diagnostics without logging credentials or personal data.

## Demonstrate the payment flows

### Held lesson, pay now

1. Sign in as the authorized payer using synthetic data. Choose an available lesson and the pay-now option.
2. Continue through the generated CFA checkout attempt to PayFast sandbox. Complete the sandbox wallet payment; never enter real card details or use a live merchant account.
3. Return to CFA. Confirm the attempt becomes paid and the held lesson becomes confirmed only after the validated ITN is processed.
4. In PayFast's Transactions and ITNs screens, compare the transaction/reference with CFA's result. Record sanitized evidence and timestamps.
5. Check that the charge/payment is recorded once. A payment arriving after hold expiry must follow the implemented late-payment credit rules rather than silently restoring the expired slot.

### Outstanding issued invoice

1. Sign in as the invoice's authorized payer. Use an issued invoice with an outstanding, fully payable balance.
2. Start payment from CFA and complete PayFast's sandbox wallet checkout.
3. After the validated ITN, confirm the payment allocation and reduced outstanding balance. Issued invoice contents must remain immutable.
4. Confirm the payment is recorded once and that another account cannot open the payer's attempt or start checkout for that invoice.

### Shop order, pay now

1. Sign in as an adult account that is its own payer, using synthetic data. A dependent billed to a guardian cannot pay for a shop order. Add one or more active products to the cart.
2. Start checkout from the cart. CFA re-prices the cart from the current catalogue, locks it as awaiting payment and creates a provisional shop charge and a payment attempt. The cart cannot be edited while it waits for payment; returning it to the cart voids the provisional charge and fails the open attempt.
3. Complete PayFast's sandbox wallet checkout. Return to CFA and confirm the order shows as paid only after the validated ITN is processed.
4. Confirm the paid order has joined the collecting bulk order and that the shop's bulk order progress includes its total. An unpaid or awaiting-payment order must not count towards the bulk order.
5. Confirm the charge/payment is recorded once, with one receipt, and that the shop charge does not appear on a monthly invoice. A payment that arrives after the cart was reopened must be kept as account credit, not used to mark the changed order paid.

### Refund a payment

Refunds are recorded against the settled payment attempt. The charges it paid stay settled and issued invoices do not change; the net amount paid is the payment minus processed refunds. The refundable balance is the payment minus refunds that are requested, approved, processing or processed, minus any account credit already issued for the same money.

1. Request. Sign in as the payer who made the payment and open the refunds page, or start from a receipt on the billing page. Choose a settled payment, enter an amount up to its refundable balance and a reason. A dependent billed to a guardian cannot request or see refunds, and a payer can only refund their own payments. Staff may raise a request on a payer's behalf. The requested amount is reserved immediately, so a second request can only use what remains.
2. Decide. Sign in as any active staff member and open the staff refund queue. Approve the request with a method, optionally lowering (never raising) the amount, or reject it. A rejection needs a note, which the payer sees, and releases the reserved amount.
3. Process manually. For an approved bank-transfer refund, pay the money back outside CFA, then record the bank reference in the queue. The request becomes processed. Recording it twice changes nothing. A payment recorded manually by staff (for example an invoice paid by EFT) can only be refunded this way.
4. Process through PayFast. Only a payment made through PayFast, with a PayFast payment ID, can be approved for the provider method. Sending it requires `PAYFAST_REFUNDS_ENABLED=true`; when the flag is off the approved refund stays approved so it can be refunded by bank transfer instead. Sending first claims the request (status processing), so a second click cannot send it twice, then calls PayFast's Refunds API from the server. A definite rejection marks the request failed and releases the amount so a new request can be raised. An uncertain answer, such as a timeout, leaves the request processing until it is reconciled against the PayFast dashboard.
5. Shop orders. When processed refunds cover the whole order payment, the order becomes refunded. If its bulk order is still collecting, the order leaves the bulk order and no longer counts towards its progress. A partial refund leaves the order paid.
6. Bulk-order cancellation. Staff can cancel a bulk order that has not been distributed. CFA raises one full refund request for the remaining refundable balance of every paid order in it, then opens a fresh collecting bulk order when the cancelled one was collecting. Each raised request still needs a staff decision and processing.

PayFast does not support refunds in sandbox: its own PHP SDK refuses refund calls in test mode. The PayFast refund API path is therefore unverified against PayFast; it has only been exercised with simulated responses in unit tests and the database routines in `refunds.test.sql`. Demonstrate refunds on staging with the manual bank-transfer method, and treat the PayFast path as unproven until it is tested against a live merchant account.

## Verification checklist

Record the commit, staging origin, applied migration, test time, synthetic account roles, results and sanitized evidence. Do not treat a check below as passed until it has been run.

- Run `npm test -- --run`, `npm run lint`, `npx tsc --noEmit` and `npm run build` against the finished change.
- Run the payment database tests against a suitable local database as well as relevant existing workflow/security tests. `npm run test:db-payments` lists `provider-payments.test.sql`, `shop-order-payments.test.sql` and `refunds.test.sql` explicitly, and `npm run test:db-security` includes `rls-coverage.test.sql`, which checks that every public table has row level security and at least one policy. The `test:db-workflows` script lists only two files; none of these scripts discovers new test files automatically.
- Verify successful lesson, invoice and shop order settlement, shop cart re-pricing and reopening, permissions and payer isolation, invalid signature, unknown reference, amount mismatch, provider mismatch, duplicate and reordered notifications, browser return without an ITN, and late payment after hold expiry, and refund requests, decisions, manual processing, full shop order refunds and bulk-order cancellation.
- Verify missing configuration disables checkout and unauthenticated ITNs reach verification without redirecting to login.
- Run the three staged wallet transactions above. Retain PayFast transaction/ITN evidence and the corresponding CFA booking, invoice or shop order result.

The sandbox wallet success path does not prove live card processing, real bank declines, notification reordering or every failure state. Those failure and concurrency cases need automated adapter, service and executable database tests; record them separately from observed sandbox evidence.

## Peach handover and limits

The existing Peach code has not been verified as a working Hosted Checkout V2 adapter. Keep it disabled until a compatible adapter is implemented and tested with the actual Peach account/API. Preserve each attempt's recorded provider so an in-flight PayFast notification is still interpreted as PayFast after a future provider change.

Peach work should be limited to its authentication, hosted checkout request/response mapping, notification verification, configuration and provider-specific reconciliation. Run the same shared lifecycle tests and all three staged acceptance scenarios with Peach before enabling it. Any provider limitation found during that verification must be resolved explicitly; PayFast tests alone cannot certify Peach compatibility.

This slice covers one-time lesson, invoice and shop order checkout, and refunds of settled payments. Shop orders are pay-now only; CFA holds paid orders until the collecting bulk order is placed with the supplier, and this slice does not cover supplier ordering or shipping. Refunds are processed manually by bank transfer with a recorded reference; the PayFast refund API path is optional, off by default and unverified because PayFast does not support refunds in sandbox. Refunds do not reverse allocations, reopen charges or change issued invoices, and account credit is not paid out as a refund. It does not establish production readiness, recurring billing, saved cards, verified provider refunds, provider payment links, real-money operation or delivery of receipt or refund emails. Use the actual implementation and test results to report which financial records or receipt views are available.
