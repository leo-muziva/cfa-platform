# QA end-to-end pass 3 - 2026-10-07

Branch `qa/e2e-demo-pass` (from `main` at e91b99b). Purpose: make the demo journeys
work end to end and close the issues from manual test pass 2.

## Environment and evidence

- Local Supabase (Docker) with every migration through 0042 applied by `npx supabase db reset`,
  plus `npm run dev` against it. Seeded personas (`*@cfa.test`), a fresh account
  `quinn+qa3@example.com`, and `scripts/seed-demo-activity.mjs`.
- Browser steps were driven with Playwright MCP. Database effects were checked with `psql`
  in the local container.
- Local limits: no HTTPS `PAYMENT_PUBLIC_ORIGIN`, so PayFast checkout reports
  "unavailable"; no Resend key, so approval reports "Email not configured". Both are
  covered by automated tests here and still need the staging pass below.

| Gate | Result |
|---|---|
| `npm test -- --run` | 58 files, 485 tests passed |
| `npx tsc --noEmit` | clean |
| `npm run lint` | 0 errors, 1 pre-existing warning (`<img>` in shop page) |
| `npm run build` | passed |
| `npx supabase test db supabase/tests/database/` (clean reset) | 21 files, 551 tests passed |

Note: `refunds.test.sql` counts audit events across the whole database, so it fails
by one if `seed-demo-activity.mjs` has already run (its paid order joins the bulk
order). Run database tests on a clean reset.

## Results by journey

| ID | Case | Result | Evidence |
|---|---|---|---|
| AUTH-01 | Signup with a plus-addressed email, confirmation email, confirm link, login | PASS | Local Mailpit received "Confirm your CFA account"; login showed "Account confirmed". The success modal now says "check your email" only when confirmation is required. |
| AUTH-02 | Plus-addressed email (`quinn+qa3@example.com`) | PASS locally | The app and local Auth accept it. Hosted rejection is a hosted Auth or SMTP setting - recheck on staging. |
| AUTH-03 | Password reset | DEFERRED | Needs staging email; Resend only delivers to the account owner without a domain. |
| PRO-01 | Complete profile, including date picker, phone and consents | PASS | Success links to booking and the dashboard. |
| LES-02 | Incomplete profile is warned before booking | PASS (fixed) | Booking pages show "Finish your profile before booking" with a link. |
| MEM-01 | Apply → admin approves → payment due → EFT recorded → active | PASS | Member saw R550 + R350 = R900 due with the reviewer note. After EFT: membership `active`, profile `member`, receipt REC-001170 for R900. |
| MEM-02 | Approval without an email provider | PASS | Approval stands; admin sees "Email not configured" and a resend button. |
| MEM-03 | Self-cancel returns the profile to guest; can reapply | PASS (fixed) | pgTAP `membership-self-cancel`. |
| MEM-05 | Members-only hours: member books, guest refused, extra hours open | PASS (built) | pgTAP `members-only-availability`; coach toggle; calendar label. |
| FAM-02 | Incoming link request shows who sent it | PASS (fixed) | Quinn saw "George Guardian - guardian@cfa.test" with an explanation. Reject left the relationship `rejected`. |
| FAM-03 | Unlink request reaches staff with names; correct copy | PASS (fixed) | "Unlink requested. Staff will review it…". Admin → Family requests listed Fiona and George by name; the rejection note was saved. |
| FAM-04 | Dependent sees no money | PASS with P2 | No billing link and no amounts; a direct `/protected/billing` visit shows a plain 404 (BUG-016). |
| LES-01 | Member books a pay-later lesson | PASS | Booking created with a 12h booked cancellation window. |
| LES-05 | Cancel confirmation and fee bands | PASS (fixed) | Free band warned "No fee". With the lesson moved 8h out, the dialog warned "50% … will be charged" and the charge became R150 finalized. |
| LES-07 | Settings drive new bookings; invalid settings refused | PASS (fixed) | pgTAP `lesson-policy-settings`; the UI refused a reduced window longer than the free window. |
| LES-08 | Calendar horizon matches booking rules | PASS (fixed) | Calendar now lists about 3 calendar months; it previously stopped at 28 days. |
| LES-06 | Concurrent booking of one time | PASS (automated) | Coach advisory lock and in-transaction recheck; `slot_taken` mapping. Not re-run with two browsers. |
| COA-02 | Coach records outcomes | PASS | The agenda showed 1 outcome required; No-show finalized a R300 charge. |
| BIL-01 | Late cancellation appears on billing | PASS | Billing showed R150 outstanding plus the R900 receipt and a refund link. |
| BIL-02 | Admin runs invoices, records a manual payment | PASS | CFA-001171 R150 unpaid → paid. The list now shows payer and month. |
| BIL-03 | Catch-up of earlier unbilled charges; paid invoice reopened | PASS (fixed) | pgTAP `invoice-catch-up`. |
| SHP-01 | Required handedness, add to cart, cart totals | PASS | "Please choose right or left handed." Cart R913. |
| SHP-02 | PayFast checkout and confirmation email | DEFERRED to staging | Unit and pgTAP tests cover claim-once, release on failure and no email for a cancelled order. |
| BULK-01 | Supplier sheet, AI proof, Gmail draft | DEFERRED to staging | Needs Composio and AI keys. |
| X-01 | All portal and admin routes load for admin | PASS | 32 routes returned 200. |

## Bugs found and fixed in this pass

| Bug | Priority | Summary | Commit |
|---|---|---|---|
| BUG-006 | P1 | Incoming family link request did not name the requester (profiles RLS hid them) | f43352c |
| BUG-007 | P1 | Unlink and transfer requests had no admin review path; unlink showed transfer wording; Households "Attach dependent" called a revoked function | d81c299 |
| BUG-008 | P2 | Incomplete-profile booking block only appeared at submit, with no link | bf9e00d |
| BUG-009 | P1 | Lesson settings page edits had no effect; booking terms were hardcoded | d5e9e3b |
| BUG-010 | P2 | No warning or fee shown before cancelling a lesson | d5e9e3b |
| BUG-011 | P1 | Members-only availability did not exist in the booking model | f9d5231 |
| BUG-012 | P1 | Self-cancelled member kept member booking rights; the profile trigger blocked the downgrade | 9ee464b |
| BUG-013 | P1 | Charges finalized after a month's run were never invoiced; a paid invoice gaining lines stayed `paid` and unpayable; the billing Pay button ignored the public-origin requirement | 366aed8 |
| BUG-014 | P1 | Shop buyers received no confirmation | f8e3ede |
| BUG-015 | P2 | Signup always said "check your email" even when confirmation is off | 033addd |
| - | P2 | Admin invoices did not name the payer | 270b9f0 |
| - | P2 | Staff greeted as "Hello, Dr." | 8b60d65 |
| - | P2 | Guardians could not see link requests they had sent | d8a30a9 |
| - | P2 | Time-options horizon (28 days) disagreed with booking horizon (3 months) | f9d5231 |

## Still open (P2, not blocking)

- BUG-016: A dependent opening `/protected/billing` directly gets a bare 404 instead of a "your payer handles billing" message.
- Currency formatting differs between pages ("R913.00" on product pages, "R 913,00" in the cart).
- Issued invoices can still gain lines on a re-run in the same month, because there is one invoice per payer per month. Making them strictly immutable needs supplementary invoices.
- Membership type options show no joining fee or "10% off" hint in the apply dropdown.
- Lint: `<img>` in `app/protected/shop/page.tsx`.

## Staging pass still required

Run after the 0037-0042 migrations and this branch are deployed (needs approval):

1. Membership apply → approve → Resend email arrives at leomuziva@gmail.com → pay through PayFast sandbox → active.
2. Shop checkout through PayFast sandbox → confirmation email to the buyer.
3. Bulk order: generate sheet → AI proof → Gmail draft to the supplier address → send → placed.
4. Password reset to the Resend-deliverable address.
5. Plus-addressed signup on the hosted project.

## Verdict

**Local: YES for the demo journeys** that do not depend on external providers. No open
P0 or P1 bugs remain. Overall sign-off waits on the staging pass above.
