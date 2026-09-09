# Member, Membership, Booking, and Cost Workflow QA

## Purpose

Use this guide to verify the current local workflow: create and confirm an account, apply for membership, approve it as an administrator, book with pay later, and inspect the resulting costs. Use a new email address for each run.

Mailpit captures local email instead of delivering it externally. The database workflow test rolls back its own fixtures.

## Start the local environment

1. Start Docker Desktop and run `npx supabase start`.
2. Start the site with `npm run dev:local`.
3. Open `http://localhost:3000`.
4. Open Mailpit at `http://127.0.0.1:15424`.
5. Keep Supabase Studio at `http://127.0.0.1:15423` available for read-only evidence checks.

The seeded administrator is `admin@cfa.test` with password `Test1234!`.

## Automated workflow baseline

Run the focused database workflow before manual testing:

```powershell
npm run test:db-workflows
```

The pgTAP test runs inside `BEGIN` and `ROLLBACK`. It proves the confirmation, membership, approval, pay-later booking, ledger, and invoicing contracts without retaining its test account or financial rows. It does not reset the local database.

Run the portal source contract with:

```powershell
npm test -- --run lib/member-portal-routing.test.ts
```

## Journey 1: create and confirm an account

1. From the landing page, choose **Create account**.
2. Register a unique address such as `manual-member-YYYYMMDD-HHMM@cfa.test`, a name, and a password.
3. Before confirming, check `auth.users` in Studio. The auth row should exist without a confirmation timestamp.
4. Check `public.profiles` and `public.households`. Neither should contain the new auth user yet.
5. Open the newest confirmation message in Mailpit and follow its link.
6. Log in if asked. Confirm that the portal opens on **Profile**, not a separate Overview page.
7. Confirm that the crest returns to the landing page and no protected page shows a Back control.
8. In Studio, verify exactly one profile, one payer household, and one payer household-member row for the account.

Pass: an unconfirmed identity cannot enter member workflows, while confirmation creates one profile and one payer household.

## Journey 2: apply for membership

1. Log in with the confirmed account and open **Profile**.
2. Complete required profile fields if prompted.
3. In Membership, choose **Month-to-month** and submit once.
4. Refresh and verify that the pending application is visible and a second open application cannot be submitted.
5. In Studio, verify one pending `public.membership_applications` row and one `membership.application_submitted` audit event.

Pass: the member sees one pending application and the database contains its matching audit event.

## Journey 3: approve as administrator

1. Log out, then log in as `admin@cfa.test`.
2. Open **Admin**, then **Requests**.
3. Find the new application. Enter a visible response and a private note, then choose **Approve**.
4. Verify that the request is approved and no longer offers approval controls.
5. In Studio, verify:
   - The application is `approved`.
   - The membership is `active` and the profile is a `member` with the selected type.
   - One membership charge and one joining-fee charge exist when the product has a joining fee.
   - A `membership.application_approved` audit event identifies the administrator as actor.
   - The note exists only in `public.membership_application_admin_notes`.
6. Log back in as the applicant. Verify that the visible response appears on Profile and the private note is absent from the page, network responses, and accessible database rows.

Pass: approval updates membership state atomically, creates initial costs, records an audit event, and does not disclose private notes.

## Journey 4: book without an online payment

1. As the approved member, open **Book**.
2. Select the member under **Who is this lesson for?**.
3. Choose an open lesson and **Pay later**, then submit once.
4. Verify success and confirm the lesson under **Lessons**.
5. Submit the same participant and slot again. Verify friendly duplicate feedback and no second booking.
6. In Studio, verify one booking with `payment_option = 'pay_later'` and one linked lesson charge.
7. Verify no receipt, payment attempt, or provider event was created.

Pass: pay later creates one booking and one unpaid lesson charge without payment-provider artifacts.

## Journey 5: inspect costs and generate an invoice

1. As the member, open **Billing**. Note that costs remain ledger charges until an administrator runs invoicing.
2. Add the membership price, joining fee, and lesson price. Compare this with the applicant's unpaid `public.charges` rows.
3. As administrator, open **Admin**, then **Invoicing**, and run the current month.
4. Verify one invoice with membership, joining-fee, and pay-later lesson lines. Every line must identify the participant.
5. Verify the invoice total equals the charge total and the sum of its lines.
6. Run the same month again. Verify no duplicate invoice or lines and no total change.
7. As the payer, confirm the invoice and line costs under **Billing**.

Pass: charges reconcile to one idempotent invoice and each line identifies who incurred the cost.

## Current payment limitations

- Use **Pay later** for this stage. No online payment provider is configured.
- **Pay now** is offered, but there is no provider handoff, payment attempt, provider event, or receipt workflow to complete it. Do not treat a pay-now booking as a successful payment test.
- Pay-now lesson charges are excluded from monthly pay-later invoicing, so the tested invoice flow cannot settle them.
- **Record manual payment** marks a whole existing invoice paid and creates a receipt. It does not verify a bank transfer, support partial payments, or settle an uninvoiced pay-now lesson charge.
- External email delivery and real provider webhooks remain out of scope until providers are selected and configured.

Record failures with the test email, role, URL, selected membership type or lesson slot, expected and actual totals, screenshots, and relevant row IDs. Never copy access tokens or secret configuration into evidence.
