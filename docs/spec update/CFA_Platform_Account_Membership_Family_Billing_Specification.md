# Cape Fencing Academy Platform

## Account, Membership, Family Billing and Booking Specification

| Document detail | Value |
|---|---|
| Document type | Build-ready functional specification |
| Version | 1.0 |
| Status | Proposed baseline |
| Scope basis | Requirements explicitly stated in the supplied CFA conversation |

## 1. Purpose and Scope

This specification defines the required account, membership, family-linking, billing, booking-access and administrative behaviour for the Cape Fencing Academy (CFA) platform. It is intended to be supplied to an implementation agent or development team.

> **Scope constraint:** This specification does not invent lesson types, prices, age thresholds, payment-provider rules, notification channels, membership categories, renewal rules or data-retention policies. Where implementation requires one of these choices, it is listed as an open decision.

## 2. Core Principles

- All informational pages remain public. Authentication is required only when a visitor attempts an account-required action.
- Every newly created account starts as a guest account.
- Membership belongs to an individual account. A family relationship never shares or automatically propagates membership.
- Parents or guardians and dependents each have separate login accounts.
- A dependent may book their own lessons but may not access the guardian's financial or private account data.
- A linked guardian is financially responsible for dependent charges, regardless of whether the guardian is a guest or a member.
- Booking eligibility is checked against the participant who will attend, not the account that initiated or pays for the booking.

## 3. Terminology

| Term | Definition |
|---|---|
| Account | A separate login identity used by one person. |
| Guest | The default account status before that person's membership is approved. |
| Member | An account whose individual membership has been approved and is active. |
| Guardian | An account linked to one or more dependent accounts and responsible for their billing. |
| Dependent | A separate account linked to a guardian account. It can log in and book independently. |
| Participant | The person who will attend the lesson. This determines booking eligibility. |
| Family link | An approved guardian-dependent relationship between two separate accounts. |
| Billing account | The guardian account to which a linked dependent's charges, invoices and payments are routed. |

## 4. Public Access and Authentication Redirects

All CFA pages are publicly viewable whether or not the visitor has an account. Pages must not require sign-in merely to browse content.

### 4.1 Account-Required Actions

When a logged-out visitor initiates an action requiring identity, the platform must redirect the visitor into authentication. Confirmed account-required actions include booking a lesson and applying for membership.

1. Capture the visitor's intended destination or action.
2. Present sign-in and sign-up routes.
3. After successful authentication, return the user to the captured destination or resume the intended action where technically safe.

The return destination must be validated as an internal CFA route to prevent open-redirect vulnerabilities.

## 5. Account Lifecycle and Guest Default

- Each person uses one continuing CFA account. Approval changes the existing account; it does not create a replacement account.
- Every account is created with guest status.
- A guest may use any guest-permitted booking capability configured by CFA.
- The account interface must show the person's current membership state and, when eligible, an action to apply for membership.

### 5.1 Membership States

| State | Meaning | Required behaviour |
|---|---|---|
| Not applied | No application has been submitted. | Account remains a guest and may start an application. |
| Pending | Application submitted and awaiting review. | Account remains a guest until approved. |
| Changes requested | Admin requires applicant updates. | Applicant may amend and resubmit. |
| Rejected | Application declined. | Account remains a guest. |
| Active | Application approved and membership active. | Member permissions become available. |
| Suspended | Membership temporarily inactive. | Member-only access is denied while suspended. |
| Expired | Membership period has ended. | Member-only access is denied while expired. |
| Cancelled | Membership is no longer active. | Member-only access is denied. |

> **Implementation boundary:** The conversation establishes these useful lifecycle states but does not define who may suspend, expire or cancel a membership, or the rules and dates that cause those transitions.

## 6. Independent Membership

Membership is evaluated and stored per individual account. A guardian's membership and each dependent's membership are independent.

- A guardian may be a guest while one or more dependents are members.
- A guardian may be a member while one or more dependents remain guests.
- Different dependents in the same linked family may have different statuses.
- Each person submits a separate membership application.
- Approving one application must not update any linked person's status.

### 6.1 Application Flow

1. The authenticated user selects **Apply for Membership** for their own account.
2. The platform collects the required application information. The exact fields are an open business decision.
3. Submission creates an application snapshot or version linked to that account and sets the application to `Pending`.
4. The applicant continues to operate as a guest while the application is pending.
5. An administrator reviews the application and chooses **Approve**, **Request changes** or **Reject**.
6. On approval, the platform activates membership on the same account and records the reviewer and review timestamp.

A guardian may assist with a dependent's application only if CFA later authorizes that permission. The supplied requirements do not establish that capability, so it must not be assumed.

## 7. Separate Guardian and Dependent Accounts

A guardian and every dependent have separate login accounts. The separation exists so dependents can book their own lessons without signing into the guardian's account or seeing guardian financial and private information.

| Capability | Guardian account | Dependent account |
|---|---|---|
| Sign in independently | Yes | Yes |
| Book for self | Yes, subject to own eligibility | Yes, subject to own eligibility |
| Apply for own membership | Yes | Yes |
| View own bookings | Yes | Yes |
| View guardian invoices or payment details | Own data only | No |
| Receive dependent charges | Yes, when linked as billing guardian | No |
| View another dependent's private data | Only explicitly permitted family-management data | No |

## 8. Family Account Linking

The account area must include a **Family Accounts** function for creating and managing approved guardian-dependent relationships. Both people must first have their own CFA accounts. A family link connects those existing accounts but does not merge them.

### 8.1 Link an Existing Account

1. The dependent creates their own CFA account first.
2. The guardian selects **Link an Existing Account**.
3. The guardian identifies the dependent account using the email address on that account.
4. The platform creates a pending link request without revealing whether the email is registered.
5. The dependent signs in and accepts or rejects the request.
6. Only acceptance activates the family link and family-billing relationship.

Additional requirements:

- A guardian may not unilaterally attach an existing account.
- A duplicate active link between the same two accounts must be prevented.
- A person may not be linked as their own dependent.
- A family link must have an explicit status such as `Pending`, `Active`, `Rejected` or `Ended`.

### 8.2 Changes to Links

Ending a link or changing billing responsibility must not delete either account, membership, booking or historical financial records.

Adding a second guardian, transferring billing responsibility and dependent financial independence were mentioned as future possibilities, but their authorization and conflict rules remain open decisions.

## 9. Linked Family Billing

All dependent invoices, payments and costs are routed to the linked guardian's billing account, regardless of whether the guardian is a guest, pending applicant, member, suspended member or expired member.

- A charge retains the dependent as the benefiting participant.
- The invoice recipient and payer are the linked billing guardian.
- Invoice lines must identify which participant each charge relates to.
- The dependent must not see the guardian's invoices, payment instruments, balances, payment history or charges belonging to other people.
- Guardian membership status must never be used as a condition for receiving or paying dependent charges.

> **Data separation rule:** Participant, booking actor and payer are distinct references. They may point to different accounts and must not be collapsed into a single `user_id` field.

## 10. Booking Authorization

Every booking records the participant who will attend. Eligibility, guest limits and member-only access are evaluated using that participant's account and membership status.

1. Determine the participant selected for the booking.
2. Load the participant's current account and membership state.
3. Evaluate the lesson's configured access rule against that participant.
4. If eligible, create the booking and route any resulting charge to the participant's billing account.
5. If ineligible, block the booking and explain the relevant access restriction without exposing private data.

| Scenario | Result |
|---|---|
| Guest guardian books a members-only lesson for an active-member dependent. | Allowed because the dependent is the participant. |
| Active-member guardian books a members-only lesson for a guest dependent. | Denied because the dependent is the participant. |
| Dependent books an eligible lesson while signed into their own account. | Allowed; any charge routes to the linked guardian. |
| Dependent attempts to open guardian billing information. | Denied. |

## 11. Roles and Permission Boundaries

Roles control application permissions. Membership state controls member-specific access. These concepts must remain separate.

| Actor | Permitted | Not permitted |
|---|---|---|
| Public visitor | View public pages; start sign-in or sign-up. | Complete account-required actions while logged out. |
| Guest account | Use authenticated guest features; book guest-eligible lessons; apply for own membership. | Use member-only access unless separately authorized. |
| Member account | Use authenticated member features while membership is active. | Inherit another person's membership or financial access. |
| Dependent account | Sign in; manage permitted own profile data; book for self; view own bookings; apply for own membership. | View guardian financial or private data or another dependent's data. |
| Guardian account | Manage approved family links; receive and pay linked-dependent charges; view permitted linked-dependent booking information. | Become or make a dependent a member automatically; access data beyond the granted family-management scope. |
| Administrator | Review applications; approve, request changes or reject; inspect necessary account and link data; record review actions. | Bypass audit recording or expose financial data to dependents. |

## 12. Administrative Membership Review

- Provide an administrative queue of submitted membership applications.
- Display the applicant, submission date, requested membership information and submitted application data.
- Allow **Approve**, **Request changes** and **Reject** actions.
- Require an administrator identity and timestamp for each review action.
- Allow internal notes that are not exposed to the applicant.
- On approval, atomically mark the application approved, create or activate the person's membership and unlock member permissions.
- On **Request changes** or **Reject**, keep the account as a guest and make the applicable status visible to the applicant.

Generating a membership number and sending notifications are sensible extensions mentioned in the conversation, but are not treated as mandatory here because their formats and delivery rules were not confirmed.

## 13. Required Data Model

Names are illustrative. Equivalent structures are acceptable if they preserve the relationships and constraints below.

### 13.1 `accounts`

- `id`
- Login identifier
- Credential or authentication-provider reference
- `account_status`
- `role`
- `created_at`
- `updated_at`

### 13.2 `profiles`

- `account_id`
- Name and other approved profile fields
- Date of birth, if CFA requires it

### 13.3 `family_links`

- `id`
- `guardian_account_id`
- `dependent_account_id`
- `status`
- `requested_by`
- `accepted_by`
- `requested_at`
- `accepted_at`
- `ended_at`

### 13.4 `billing_accounts`

- `id`
- `responsible_account_id`
- `status`

### 13.5 `dependent_billing_links`

- `dependent_account_id`
- `billing_account_id`
- `effective_from`
- `effective_to`

### 13.6 `membership_applications`

- `id`
- `applicant_account_id`
- `status`
- Application data or versioned fields
- `submitted_at`
- `reviewed_at`
- `reviewed_by`
- Applicant-visible response
- Internal notes

### 13.7 `memberships`

- `id`
- `account_id`
- `status`
- `membership_type`, if used
- `start_date`
- `expiry_date`
- `approved_by`
- `approved_at`
- `membership_number`, if used

### 13.8 `lessons`

- `id`
- Schedule data
- `booking_access_rule`

### 13.9 `bookings`

- `id`
- `participant_account_id`
- `booked_by_account_id`
- `lesson_id`
- `status`
- `billing_account_id`
- `created_at`

### 13.10 `invoices`

- `id`
- `billing_account_id`
- `recipient_account_id`
- `status`
- `total`
- `due_date`

### 13.11 `invoice_items`

- `id`
- `invoice_id`
- `participant_account_id`
- `booking_id` or another source reference
- `description`
- `amount`

### 13.12 `payments`

- `id`
- `billing_account_id`
- `invoice_id`
- `amount`
- `status`
- Payment reference
- Timestamps

### 13.13 `audit_events`

- `id`
- `actor_account_id`
- `action`
- `target_type`
- `target_id`
- Timestamp
- Change metadata

### 13.14 Required Constraints

- `guardian_account_id` and `dependent_account_id` must reference different accounts.
- Only one active guardian-dependent link may exist for the same pair.
- Membership application and membership records belong to exactly one individual account.
- A family link must not copy membership status between accounts.
- Bookings must always identify a participant.
- Dependent charges must retain both participant and billing-account references.
- Financial records must remain historically attributable after a family link ends.
- Administrative review and relationship changes must be auditable.

## 14. Functional Acceptance Criteria

### AC-01: Public browsing

A logged-out visitor can view all public pages without being forced to authenticate.

### AC-02: Authentication redirect

A logged-out visitor who starts booking or membership application is offered sign-in or sign-up and returns to the intended internal flow after authentication.

### AC-03: Guest default

Every new account is created as a guest.

### AC-04: Independent approval

Approving one person's membership changes only that person's existing account and membership.

### AC-05: Separate credentials

Guardian and dependent can sign in with separate credentials.

### AC-06: Dependent self-booking

A dependent can create an eligible self-booking without entering the guardian account.

### AC-07: Financial privacy

A dependent cannot access guardian invoices, balances, payment methods, payment history or private profile information.

### AC-08: Linked billing

A linked dependent's charge is invoiced to the guardian even when the guardian is not a member.

### AC-09: Participant attribution

An invoice item identifies the dependent or participant to whom the charge relates.

### AC-10: Participant-based eligibility

A members-only booking is allowed or denied using the participant's status, not the booker's or payer's status.

### AC-11: Existing-account family link

A dependent creates their own separate CFA account first. A guardian can request a link using the dependent account's email, but the relationship remains pending until the dependent signs in and approves it. It does not create only a profile inside the guardian login.

### AC-12: Existing-account approval

Linking an existing account remains pending until the target account approves it.

### AC-13: Rejected link

Rejecting a link request grants no family or financial access.

### AC-14: Administrative decisions

An administrator can approve, request changes or reject an application, with reviewer identity and timestamp recorded.

### AC-15: Guest while unapproved

An applicant remains a guest while their application is pending, changes requested or rejected.

### AC-16: Historical preservation

Ending a family link does not delete accounts, memberships, bookings, invoices, payments or audit history.

### AC-17: Invalid links

The platform prevents self-linking and duplicate active family links.

### AC-18: Server-side authorization

Authorization is enforced server-side for every protected operation, not only by hiding interface elements.

## 15. Edge Cases and Expected Handling

| Edge case | Expected handling |
|---|---|
| Dependent already has a CFA account. | Use **Link an Existing Account**; do not create a duplicate account. |
| Target rejects or ignores a link request. | The link remains inactive and grants no access or billing authority. |
| Guardian and dependent have different membership states. | Preserve both states independently. |
| Guardian membership expires or is suspended. | Dependent billing continues to route to the guardian; dependent eligibility remains based on the dependent. |
| Dependent membership expires or is suspended. | Member-only booking is denied for that dependent even if the guardian is active. |
| Guardian books for dependent. | Check the dependent as participant and route the charge to the linked billing account. |
| Dependent books for self. | Check dependent eligibility and route charges to the linked guardian without revealing financial details. |
| Family link ends with unpaid invoices. | Preserve the original debtor or billing account and all historical financial references. |
| Two requests attempt to create the same link. | Enforce uniqueness and return the existing pending or active relationship. |
| Approval and booking occur concurrently. | Use transactional or strongly consistent status checks so the booking sees a valid current membership state. |
| User manipulates participant or billing identifiers. | Authorize every referenced account and derive billing responsibility server-side. |
| Return URL is external or malformed. | Ignore it and return to a safe CFA page. |

## 16. Concise Implementation Notes

- Use server-side authorization policies for all account, family, membership, booking and finance endpoints.
- Keep role, account status, membership status, family-link status and billing responsibility as separate fields or entities.
- Perform membership approval atomically so application status and member access cannot diverge.
- Resolve the billing account from the active family-billing relationship rather than accepting a payer identifier from the client.
- Use authenticated account access for family-link approval; both accounts already exist before a link is requested.
- Minimize information shown in a link request until the target authenticates.
- Record audit events for application review, membership changes, family-link acceptance or ending and billing-responsibility changes.
- Design queries and authorization tests around the participant, booker and payer separation.
- Do not encode CFA business choices that remain undecided as permanent application constants.

## 17. Open Decisions Requiring CFA Confirmation

- Exact membership application fields, membership types and validation rules.
- Which guest lessons or limits apply and how lesson access rules are configured.
- Whether guardians may submit or edit a dependent's membership application.
- Whether more than one guardian may be linked, and which guardian is the billing guardian.
- Rules for transferring billing responsibility, ending links and a dependent becoming financially independent.
- Notification channels and required messages for family-link requests and membership reviews.
- Membership number format, membership dates, renewal, suspension, expiry and cancellation rules.
- Which linked-dependent booking or profile information a guardian may view beyond billing.
- Payment provider, invoice schedule, refunds, cancellations, taxes and data-retention requirements.

## 18. Definition of Done

The feature is complete when:

- All acceptance criteria pass.
- Automated authorization tests cover cross-account privacy and participant-based booking checks.
- Family linking and membership approval are auditable.
- Dependent charges consistently route to the linked guardian.
- No unresolved open decision has been silently hard-coded.
