# PayFast sandbox setup and payment demo

This integration exercises CFA's shared payment lifecycle through PayFast's sandbox. A future Peach adapter must implement the same checkout and verified-event contract. Changing credentials alone cannot switch payment providers. The booking, invoice and settlement rules belong to CFA and should be reused when that adapter is added.

This guide is a setup and acceptance checklist, not evidence of a successful deployment or payment. Use synthetic staging accounts and sandbox funds only.

## Staging setup

1. Deploy the application changes and apply `0025_provider_neutral_payments.sql` after `0024_peach_sandbox_checkout.sql` to the staging database. Deployment and hosted migration are separate operational steps; do not reset the hosted database.
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

CFA supplies the notification and return URLs when constructing checkout. An ITN is PayFast's server-to-server payment notification. The webhook must accept PayFast's requests without a CFA login, hosting preview password or access challenge. Confirm that both the application proxy and hosting access protection allow this exact callback path. Keep payer checkout and result pages authenticated.

Only a verified notification followed by successful shared settlement can mark a payment paid. Returning from checkout, refreshing the result page or opening a success-looking URL does not prove payment. A pending result can mean the ITN is still arriving; inspect PayFast's ITNs screen and staging server diagnostics without logging credentials or personal data.

## Demonstrate both flows

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

## Verification checklist

Record the commit, staging origin, applied migration, test time, synthetic account roles, results and sanitized evidence. Do not treat a check below as passed until it has been run.

- Run `npm test -- --run`, `npm run lint`, `npx tsc --noEmit` and `npm run build` against the finished change.
- Run the added payment database tests against a suitable local database as well as relevant existing workflow/security tests. The existing `test:db-workflows` script lists only two files; it does not automatically discover a new payment test file.
- Verify successful lesson and invoice settlement, permissions and payer isolation, invalid signature, unknown reference, amount mismatch, provider mismatch, duplicate and reordered notifications, browser return without an ITN, and late payment after hold expiry.
- Verify missing configuration disables checkout and unauthenticated ITNs reach verification without redirecting to login.
- Run the two staged wallet transactions above. Retain PayFast transaction/ITN evidence and the corresponding CFA booking or invoice result.

The sandbox wallet success path does not prove live card processing, real bank declines, notification reordering or every failure state. Those failure and concurrency cases need automated adapter, service and executable database tests; record them separately from observed sandbox evidence.

## Peach handover and limits

The existing Peach code has not been verified as a working Hosted Checkout V2 adapter. Keep it disabled until a compatible adapter is implemented and tested with the actual Peach account/API. Preserve each attempt's recorded provider so an in-flight PayFast notification is still interpreted as PayFast after a future provider change.

Peach work should be limited to its authentication, hosted checkout request/response mapping, notification verification, configuration and provider-specific reconciliation. Run the same shared lifecycle tests and both staged acceptance scenarios with Peach before enabling it. Any provider limitation found during that verification must be resolved explicitly; PayFast tests alone cannot certify Peach compatibility.

This slice covers one-time lesson and invoice checkout. It does not establish production readiness, recurring billing, saved cards, refunds, provider payment links, real-money operation or delivery of receipt emails. Use the actual implementation and test results to report which financial records or receipt views are available.
