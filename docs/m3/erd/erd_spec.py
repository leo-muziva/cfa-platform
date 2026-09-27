"""Single source of truth for the M3 ERD, data dictionary and class diagram brief.

Every attribute was checked against supabase/migrations 0001-0025 (final state).
The ERD (build_drawio.py), the Word data dictionary (build_docx.py) and the
class diagram brief (build_brief.py) are all generated from this file so they
cannot drift apart.
"""

# Attribute tuple: (key, column, sql_type, required, constraint, description)
# key is "PK", "FK", "PK, FK", "UK", "FK, UK" or "".

ENTITIES = {
    "profile": {
        "name": "Profile",
        "table": "profiles",
        "cluster": "people",
        "purpose": "One record per CFA account. Guests, members and coaches are all stored here and told apart by membership_status and staff fields.",
        "evidence": "MemberRepository.ts: getProfileById, updateProfile, completeProfile, adminUpdateProfile; MemberService.ts: deriveCapabilities; migrations 0001 and 0003.",
        "attrs": [
            ("PK, FK", "id", "uuid", "Required", "PK, FK -> auth.users.id", "Account identifier shared with Supabase Auth."),
            ("", "full_name", "text", "Optional", "-", "Person's full name."),
            ("", "email", "text", "Required", "-", "Contact and sign-in email address."),
            ("", "phone", "text", "Optional", "-", "Contact phone number."),
            ("", "date_of_birth", "date", "Optional", "-", "Used to tell adults from minors."),
            ("", "membership_status", "text", "Required", "guest or member; default guest", "Whether the person is a guest or a club member."),
            ("", "is_staff", "boolean", "Required", "Default false", "Whether the person is CFA staff."),
            ("", "staff_type", "text", "Optional", "admin or coach; required only when is_staff", "Kind of staff role."),
            ("", "is_active", "boolean", "Required", "Default true", "Whether the account can be used."),
        ],
    },
    "membership": {
        "name": "Membership",
        "table": "memberships",
        "cluster": "people",
        "purpose": "The club membership held by a member, with its lifecycle state.",
        "evidence": "PlatformRepository.ts: getMembership, changeMembershipStatus (change_membership_status RPC); migration 0005.",
        "attrs": [
            ("PK", "id", "uuid", "Required", "PK", "Unique membership identifier."),
            ("FK, UK", "profile_id", "uuid", "Required", "FK -> profiles.id, UK", "Member who holds the membership (at most one each)."),
            ("", "status", "text", "Required", "active, suspended, expired, cancelled", "Current membership state."),
            ("", "started_at", "timestamptz", "Required", "Default now()", "When the membership began."),
            ("", "cancelled_at", "timestamptz", "Optional", "-", "When the membership was cancelled."),
        ],
    },
    "family_link": {
        "name": "Family Link",
        "table": "family_links",
        "cluster": "family",
        "purpose": "A guardian-dependent relationship between two existing accounts, from invitation to end.",
        "evidence": "PlatformRepository.ts: listFamilyLinks, requestFamilyLink, respondFamilyLink, endFamilyLink; FamilyRepository.ts: requestFamilyChange; migrations 0005 and 0021.",
        "attrs": [
            ("PK", "id", "uuid", "Required", "PK", "Unique family link identifier."),
            ("FK", "guardian_id", "uuid", "Required", "FK -> profiles.id; differs from dependent_id", "Profile acting as guardian."),
            ("FK", "dependent_id", "uuid", "Required", "FK -> profiles.id", "Profile being looked after."),
            ("", "status", "text", "Required", "pending, active, rejected, ended; default pending", "Where the link is in its lifecycle."),
            ("", "requested_at", "timestamptz", "Required", "Default now()", "When the link was requested."),
            ("", "accepted_at", "timestamptz", "Optional", "-", "When the link was accepted."),
            ("", "ended_at", "timestamptz", "Optional", "-", "When the link ended."),
        ],
    },
    "household": {
        "name": "Household",
        "table": "households",
        "cluster": "family",
        "purpose": "A billing unit with exactly one payer. A trigger gives every new account its own household; billing between linked family accounts is resolved through family links.",
        "evidence": "MemberRepository.ts: getHouseholdMembership, getHouseholdMembers, attachDependent; PlatformRepository.ts: getBillingForPayer; migration 0003.",
        "attrs": [
            ("PK", "id", "uuid", "Required", "PK", "Unique household identifier."),
            ("FK, UK", "payer_id", "uuid", "Required", "FK -> profiles.id, UK", "The one profile that pays for the household."),
            ("", "membership_payment_method", "text", "Required", "manual or recurring_card; default manual", "How the household pays membership fees."),
        ],
    },
    "lesson_booking": {
        "name": "Lesson Booking",
        "table": "bookings",
        "cluster": "lessons",
        "purpose": "A private lesson with a coach at a set time, including the payment choice and the price captured when it was booked.",
        "evidence": "LessonBookingRepository.ts: insertLessonBooking (create_lesson_booking_v3 RPC), cancelLessonBookingRecord, rescheduleLessonBookingRecord; migrations 0011, 0022 and 0023.",
        "attrs": [
            ("PK", "id", "uuid", "Required", "PK", "Unique booking identifier."),
            ("FK", "booked_by_id", "uuid", "Required", "FK -> profiles.id", "Profile that made the booking."),
            ("FK", "coach_id", "uuid", "Optional", "FK -> profiles.id; unique with starts_at among live bookings", "Coach giving the lesson (set for every current booking)."),
            ("", "starts_at", "timestamptz", "Optional", "-", "Lesson start time (set for every current booking)."),
            ("", "ends_at", "timestamptz", "Optional", "-", "Lesson end time (set for every current booking)."),
            ("", "weapon", "text", "Optional", "foil, epee, sabre", "Weapon for the lesson."),
            ("", "payment_option", "text", "Required", "pay_now or pay_later", "Whether the lesson is paid upfront or invoiced later."),
            ("", "payment_state", "text", "Required", "unpaid, held, paid, expired; default unpaid", "Payment progress, including a held slot awaiting payment."),
            ("", "status", "text", "Required", "scheduled, attended, no_show, cancelled, rescheduled; default scheduled", "Lesson lifecycle state."),
            ("", "booked_unit_price_cents", "bigint", "Optional", "Set from the lesson product at booking time", "Lesson price in cents, locked when booked."),
            ("", "hold_expires_at", "timestamptz", "Optional", "-", "When an unpaid pay-now hold is released."),
        ],
    },
    "booking_participant": {
        "name": "Booking Participant",
        "table": "booking_participants",
        "cluster": "lessons",
        "purpose": "A fencer taking part in a lesson booking. The booking function requires one or two participants, and each has their own attendance.",
        "evidence": "LessonBookingRepository.ts: listAllLessonBookings participant join, recordLessonOutcomeRecord (record_lesson_participant_outcome RPC); migrations 0011 and 0022.",
        "attrs": [
            ("PK, FK", "booking_id", "uuid", "Required", "PK, FK -> bookings.id", "Booking the fencer is part of."),
            ("PK, FK", "participant_id", "uuid", "Required", "PK, FK -> profiles.id", "Fencer taking the lesson."),
            ("", "ordinal", "smallint", "Required", "1 or 2; unique per booking", "Position of the fencer in a single or shared lesson."),
            ("", "attendance_outcome", "text", "Optional", "attended or no_show", "Attendance recorded for this fencer."),
        ],
    },
    "payment": {
        "name": "Payment",
        "table": "payment_attempts",
        "cluster": "payments",
        "purpose": "One attempt by a payer to pay, for example for a held lesson booking, and its result.",
        "evidence": "payment-repository.ts: preparePayment, recordPaymentEvent; payment-service.ts: startPayment; migrations 0003, 0024 and 0025.",
        "attrs": [
            ("PK", "id", "uuid", "Required", "PK", "Unique payment attempt identifier."),
            ("FK", "payer_id", "uuid", "Required", "FK -> profiles.id", "Profile paying."),
            ("FK", "booking_id", "uuid", "Optional", "FK -> bookings.id", "Held lesson booking being paid for."),
            ("", "provider", "text", "Optional", "-", "Payment source, for example manual or a sandbox gateway."),
            ("", "provider_reference", "text", "Optional", "Unique per provider when present", "Reference used with the payment provider."),
            ("", "status", "text", "Required", "pending, succeeded, failed; default pending", "Outcome of the attempt."),
            ("", "amount", "numeric(10,2)", "Required", "-", "Amount in rand."),
            ("", "currency", "text", "Required", "Default ZAR", "Currency of the payment."),
            ("", "idempotency_key", "text", "Optional", "Unique when present", "Stops the same payment being started twice."),
            ("", "completed_at", "timestamptz", "Optional", "-", "When the attempt finished."),
        ],
    },
    "receipt": {
        "name": "Receipt",
        "table": "receipts",
        "cluster": "payments",
        "purpose": "Proof of a settled payment, issued to the payer.",
        "evidence": "PlatformRepository.ts: getBillingForPayer; issued by record_payment_event and record_manual_invoice_payment in migration 0025.",
        "attrs": [
            ("PK", "id", "uuid", "Required", "PK", "Unique receipt identifier."),
            ("FK", "payer_id", "uuid", "Required", "FK -> profiles.id", "Profile the receipt is issued to."),
            ("FK, UK", "payment_attempt_id", "uuid", "Optional", "FK -> payment_attempts.id, UK", "Payment that produced the receipt (empty for older receipts)."),
            ("UK", "receipt_number", "text", "Required", "UK; generated REC- number", "Human-readable receipt number."),
            ("", "amount", "numeric(10,2)", "Required", "-", "Amount received in rand."),
            ("", "issued_at", "timestamptz", "Required", "Default now()", "When the receipt was issued."),
        ],
    },
}

# Subtypes of Profile (no own table). rule = discriminator.
SUBTYPES = {
    "guest": {
        "name": "Guest",
        "rule": "membership_status = 'guest'",
        "description": "Someone with an account who is not (yet) a club member. Can book and pay for lessons.",
    },
    "member": {
        "name": "Member",
        "rule": "membership_status = 'member'",
        "description": "A profile whose membership_status is 'member'. It is set when an application is approved and returns to guest when an administrator ends the membership, so the Membership record itself is linked to Profile.",
    },
    "coach": {
        "name": "Coach",
        "rule": "is_staff AND staff_type = 'coach'",
        "description": "A staff coach who gives lessons. A coach can also be a member.",
    },
}
SUBTYPE_NOTE = "Overlapping: a coach may also be a guest or a member. Guest and Member are mutually exclusive."

# Relationships: (id, parent, parent_mult, child, child_mult, verb, via_fk, dashed)
# parent side is the "one" side. via_fk is child.column, or a note for
# relationships implemented by a link table.
RELATIONSHIPS = [
    ("r_holds", "profile", "1", "membership", "0..1", "holds", "memberships.profile_id", False),
    ("r_guardian", "profile", "1", "family_link", "0..*", "guardian in", "family_links.guardian_id", False),
    ("r_dependent", "profile", "1", "family_link", "0..*", "dependent in", "family_links.dependent_id", False),
    ("r_pays_for", "profile", "1", "household", "0..1", "pays for", "households.payer_id", False),
    ("r_belongs", "household", "1", "profile", "1..*", "has member", "via household_members", True),
    ("r_books", "profile", "1", "lesson_booking", "0..*", "books", "bookings.booked_by_id", False),
    ("r_coaches", "coach", "0..1", "lesson_booking", "0..*", "coaches", "bookings.coach_id", False),
    ("r_includes", "lesson_booking", "1", "booking_participant", "1..2", "includes", "booking_participants.booking_id", False),
    ("r_attends", "profile", "1", "booking_participant", "0..*", "attends as", "booking_participants.participant_id", False),
    ("r_makes", "profile", "1", "payment", "0..*", "makes", "payment_attempts.payer_id", False),
    ("r_secures", "lesson_booking", "0..1", "payment", "0..*", "paid by", "payment_attempts.booking_id", False),
    ("r_credited", "profile", "1", "receipt", "0..*", "receives", "receipts.payer_id", False),
    ("r_evidences", "payment", "0..1", "receipt", "0..1", "evidenced by", "receipts.payment_attempt_id", False),
]

# Structures deliberately left out of the principal model.
EXCLUDED = [
    ("membership_types", "Reference data",
     "Lists the membership products and prices. It is configuration rather than a real-world participant, so memberships.membership_type_id is also omitted from the concise model."),
    ("membership_applications, membership_application_admin_notes", "Workflow",
     "Hold the application and staff review steps that lead to a Membership. The ERD shows the resulting Membership instead of the workflow records."),
    ("membership_requests", "Legacy",
     "Replaced by membership_applications. Migration 0005 copied the historical rows across."),
    ("household_members", "Link table",
     "Records which household each profile belongs to and whether it is the payer or a dependent. It is shown on the ERD as the dashed Household 'has member' relationship rather than as a separate box. Its primary key is profile_id, so a profile is in at most one household, and a trigger places every new profile in its own household."),
    ("charges, invoices, invoice_lines", "Ledger detail",
     "Hold amounts owed, monthly invoices and their lines. They refine billing behind Payment and Receipt, so payment_attempts.invoice_id and receipts.invoice_id are also omitted from the concise model."),
    ("bookings.lesson_slot_id and bookings.fencer_id, lesson_slots", "Legacy columns",
     "Still NOT NULL and filled by the booking function through a hidden single-use slot, and fencer_id is still used inside some database triggers and row-level security policies. The current booking pages instead read participants from booking_participants, and times and coach from bookings.coach_id, starts_at and ends_at, so the ERD uses those."),
    ("Audit, snapshot and compatibility columns", "Omitted attributes",
     "For example created_at and updated_at, cancellation and outcome actor fields, the booked_* policy snapshot columns, booking_model, the amount_cents mirrors of rand amounts, payment_attempts.provider_payment_id, and the profile columns role (legacy), membership_type_id (cached summary), emergency contact, consent timestamps and reminder_preference. These exist in the schema but are left out of the concise dictionary."),
    ("dependent_billing_links, family_change_requests", "Supporting history",
     "Keep current and past billing responsibility and staff-reviewed family transfers beneath Family Link and Household."),
    ("coach_lesson_profiles, coach_lesson_weapons, coach_availability_rules, coach_availability_exceptions, lesson_booking_settings, lesson_products, lesson_entitlements, lesson_booking_allocations, club_closures, closure_affected_bookings", "Scheduling and pricing configuration",
     "Used to work out coach availability, prices, introductory entitlements, coach and club revenue splits and closures. They are operational settings beneath Lesson Booking."),
    ("ledger_credits, payment_allocations, credit_consumptions, invoice_adjustments", "Ledger support",
     "Used by settlement functions to allocate payments and credits. They refine the financial ledger rather than represent something a user deals with."),
    ("audit_events, lesson_notification_outbox, lesson_notifications, lesson_booking_staff_alerts", "Infrastructure",
     "Record operations, queue notifications and raise staff alerts. They are not business objects."),
    ("provider_events, payment_method_references", "Payment infrastructure",
     "Store provider callbacks for de-duplication and saved payment method references. They support Payment rather than represent something a user deals with."),
    ("shop_products, shop_orders and related shop tables", "Not user-facing yet",
     "Migrations exist, but the shop workflow is not complete, so Product and Order are outside the main design."),
]


def fk_attrs(entity_key):
    return [a for a in ENTITIES[entity_key]["attrs"] if "FK" in a[0] and "auth.users" not in a[4]]


if __name__ == "__main__":
    # Consistency check: every FK attribute is drawn by exactly one relationship.
    drawn = {r[6] for r in RELATIONSHIPS}
    for key, e in ENTITIES.items():
        for a in fk_attrs(key):
            ref = f'{e["table"]}.{a[1]}'
            assert ref in drawn, f"FK without relationship: {ref}"
    for r in RELATIONSHIPS:
        if not r[6].startswith("via"):
            table, col = r[6].split(".")
            ent = next(e for e in ENTITIES.values() if e["table"] == table)
            assert any(a[1] == col for a in ent["attrs"]), f"relationship on missing column {r[6]}"
    print("spec consistent:", len(ENTITIES), "entities,", len(SUBTYPES), "subtypes,", len(RELATIONSHIPS), "relationships")
