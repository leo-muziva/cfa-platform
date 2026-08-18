# CFA Lesson Booking Demo - Manual QA Plan

## Purpose

Validate the 30-minute, invoice-only private lesson workflow in Cape Town time. Run every journey at 375x812, 768x1024, and a desktop width of at least 1440 pixels. Record the account, time, viewport, result, and screenshot or video reference for each failure.

## Preconditions

- Apply migrations through `0011_lesson_booking_demo.sql` and load `supabase/seed.sql`.
- Confirm the seeded admin, coach, adult member, guardian, linked dependent, and guest accounts can sign in.
- Confirm the lesson price is R300 per participant, the cancellation window is 24 hours, and payment mode is invoice only.
- Use Africa/Johannesburg for all expected date and time comparisons.

## Journeys

### Adult member - single lesson

1. Open Book and confirm only active coaches and configured weapons appear.
2. Select a coach, weapon, date, one participant, and a free time.
3. Confirm the quote is R300 and no Pay now control exists.
4. Book and confirm the lesson appears under Upcoming with coach, weapon, participant, time, and cancellation deadline.
5. Confirm Billing shows R300 under Pending lessons but does not add it to Current balance.
6. Mark the completed lesson attended as the assigned coach. Confirm the finalized R300 enters the payer balance and becomes invoice eligible.

### Guardian - double lesson

1. Select the guardian plus a linked dependent, then repeat with two linked dependents.
2. Confirm no third participant can be selected and duplicate participants are impossible.
3. Confirm the quote is R600 and one atomic booking is created.
4. Confirm Billing shows two R300 pending lines with participant attribution.
5. Attempt a pair with different active payers as admin and confirm the booking is rejected.

### Dependent self-booking

1. Confirm only the dependent can be selected, even if stale household or family relationships exist.
2. Confirm availability contains no price and the confirmation displays only `Your payer will be billed`.
3. Inspect rendered props/network responses and confirm no price, amount, payer, payment, charge, invoice, or receipt field is returned.
4. Book a lesson and confirm the effective payer receives an in-app notification.
5. Confirm the dependent cannot open Billing or query raw bookings and financial tables.

### Registered guest

1. Complete the account profile without requesting membership approval.
2. Confirm active coaches and free times are available.
3. Book a lesson and confirm it uses invoice-only Pay later behavior.

### Cancellation and rescheduling

1. Cancel more than 24 hours before start and confirm the provisional charge is voided at no charge.
2. Cancel inside 24 hours and confirm the R300 participant charge is finalized.
3. Reschedule outside 24 hours and confirm the old charge is voided and the new lesson is provisional.
4. Reschedule inside 24 hours and confirm the old charge is finalized and the new lesson is provisional.
5. Attempt an occupied target time and confirm the original lesson remains unchanged.
6. In two sessions, select the same free time and submit together. Confirm exactly one succeeds; the loser clears the selection, refreshes availability, focuses the alert, and announces `That time has just been taken. Pick another available time.`

### Coach operations

1. Confirm the Coach link appears only for coaches and the agenda contains only assigned time, weapon, status, and participant names.
2. Confirm no price, payer, payment, charge, invoice, or receipt data appears in the UI or response.
3. After a lesson ends, mark it attended and no-show in separate cases; confirm each outcome can be recorded only once.
4. Confirm outcomes cannot be recorded before the lesson ends.
5. Add multiple weekly ranges and extra hours; confirm free times occur in exact 30-minute increments.
6. Add a block over an existing booking. Confirm affected bookings are previewed and cancellation requires explicit confirmation.

### Admin operations

1. Review the all-coach calendar, booking activity, and financially authorized waiver controls.
2. Activate a coach offering and configure foil, epee, and sabre combinations. Confirm deactivation prevents new bookings without deleting history or silently cancelling future bookings.
3. Use the explicit bulk-cancel action and confirm future coach bookings are cancelled at no charge.
4. Preview a closure date range. Confirm affected coaches and participant names appear before creation.
5. Create the closure with confirmation and confirm affected bookings are cancelled at no charge and payers are notified.
6. Waive an unpaid booking and confirm invoice lines and totals reconcile. Waive a settled booking and confirm the receipt and paid invoice remain unchanged while an offsetting credit is created.
7. Change an allowed lesson setting and confirm booking behavior reads the singleton value. Confirm locked invoice-only, 30-minute, and atomic-double settings cannot be changed.

## Responsive and accessibility checks

- Portal and admin navigation remain usable without horizontal clipping at every target width.
- Every input has a visible or programmatic label; fieldsets have legends.
- Date, weapon, participant, and time choices work with keyboard only and show focus.
- Status updates use live regions; errors use alerts; the stale-slot alert receives focus.
- Touch targets are at least 44 pixels high where practical.
- Text and controls retain readable contrast in the cinematic portal shell.

## Sign-off

Do not approve release until application tests, lint, TypeScript, and production build pass, both pgTAP files pass against a reset local database, and the real two-session contention case produces one booking plus one `slot_taken` result.
