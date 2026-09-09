from docx import Document
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT, WD_CELL_VERTICAL_ALIGNMENT
from docx.shared import Inches, Pt, RGBColor
from docx.oxml import OxmlElement
from docx.oxml.ns import qn


OUT = "docs/qa/CFA-platform-manual-role-based-qa-test-plan-updated.docx"


def shade(cell, fill):
    tc_pr = cell._tc.get_or_add_tcPr()
    node = OxmlElement("w:shd")
    node.set(qn("w:fill"), fill)
    tc_pr.append(node)


def cell_margins(cell, top=90, start=120, bottom=90, end=120):
    tc_pr = cell._tc.get_or_add_tcPr()
    tc_mar = tc_pr.first_child_found_in("w:tcMar")
    if tc_mar is None:
        tc_mar = OxmlElement("w:tcMar")
        tc_pr.append(tc_mar)
    for name, value in (("top", top), ("start", start), ("bottom", bottom), ("end", end)):
        node = tc_mar.find(qn(f"w:{name}"))
        if node is None:
            node = OxmlElement(f"w:{name}")
            tc_mar.append(node)
        node.set(qn("w:w"), str(value))
        node.set(qn("w:type"), "dxa")


def set_cell(cell, text, bold=False, color="243447", size=9):
    cell.text = ""
    p = cell.paragraphs[0]
    p.paragraph_format.space_after = Pt(0)
    run = p.add_run(text)
    run.bold = bold
    run.font.name = "Aptos"
    run.font.size = Pt(size)
    run.font.color.rgb = RGBColor.from_string(color)
    cell.vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.CENTER
    cell_margins(cell)


def add_bullet(doc, text):
    p = doc.add_paragraph(style="List Bullet")
    p.paragraph_format.space_after = Pt(2)
    p.add_run(text)


def add_number(doc, text):
    p = doc.add_paragraph(style="List Number")
    p.paragraph_format.space_after = Pt(2)
    p.add_run(text)


def add_phase(doc, number, title, role, prerequisites, steps, expected, notes=None):
    doc.add_heading(f"Phase {number}: {title}", level=1)
    p = doc.add_paragraph()
    p.paragraph_format.space_after = Pt(4)
    r = p.add_run("Role: ")
    r.bold = True
    p.add_run(role)
    p = doc.add_paragraph()
    p.paragraph_format.space_after = Pt(6)
    r = p.add_run("Prerequisites: ")
    r.bold = True
    p.add_run(prerequisites)
    doc.add_heading("Steps", level=2)
    for step in steps:
        add_number(doc, step)
    doc.add_heading("Expected result", level=2)
    p = doc.add_paragraph()
    p.paragraph_format.left_indent = Inches(0.15)
    p.add_run(expected)
    doc.add_heading("Record evidence", level=2)
    table = doc.add_table(rows=3, cols=2)
    table.alignment = WD_TABLE_ALIGNMENT.LEFT
    table.autofit = False
    labels = ["Result", "Evidence / screenshot", "Notes / defect ID"]
    for row, label in zip(table.rows, labels):
        set_cell(row.cells[0], label, bold=True, color="007C83", size=9)
        set_cell(row.cells[1], "[ ] PASS    [ ] FAIL    [ ] BLOCKED\n\n", size=9)
    if notes:
        p = doc.add_paragraph()
        p.paragraph_format.space_after = Pt(6)
        r = p.add_run("Important note: ")
        r.bold = True
        p.add_run(notes)


doc = Document()
section = doc.sections[0]
section.top_margin = Inches(0.7)
section.bottom_margin = Inches(0.7)
section.left_margin = Inches(0.75)
section.right_margin = Inches(0.75)

styles = doc.styles
normal = styles["Normal"]
normal.font.name = "Aptos"
normal.font.size = Pt(9.5)
normal.font.color.rgb = RGBColor(36, 52, 71)
normal.paragraph_format.space_after = Pt(5)
normal.paragraph_format.line_spacing = 1.05
for name, size, color in (("Title", 25, "12304A"), ("Heading 1", 15, "12304A"), ("Heading 2", 11.5, "007C83"), ("Heading 3", 10.5, "12304A")):
    style = styles[name]
    style.font.name = "Aptos Display" if name in ("Title", "Heading 1") else "Aptos"
    style.font.size = Pt(size)
    style.font.bold = True
    style.font.color.rgb = RGBColor.from_string(color)
    style.paragraph_format.space_before = Pt(10 if name != "Title" else 0)
    style.paragraph_format.space_after = Pt(4)

title = doc.add_paragraph(style="Title")
title.add_run("CFA Platform\nManual Role-Based QA Test Plan")
subtitle = doc.add_paragraph()
subtitle.paragraph_format.space_after = Pt(14)
r = subtitle.add_run("A sequential hands-on test run for local Docker and Supabase")
r.italic = True
r.font.color.rgb = RGBColor(0, 124, 131)

callout = doc.add_table(rows=1, cols=1)
callout.alignment = WD_TABLE_ALIGNMENT.LEFT
cell = callout.cell(0, 0)
shade(cell, "E8F3F3")
set_cell(cell, "This is a manual test plan. The tester runs the browser steps. Do not treat a page that merely loads as a passing business workflow: record the actual result and evidence for every phase.", bold=True, color="12304A", size=10)

doc.add_heading("How to use this document", level=1)
for item in [
    "Follow the phases in order. Later phases depend on accounts, memberships, family links, lessons, bookings, and invoices created earlier.",
    "Use a new run identifier for every complete run. Do not reuse the fixed seeded emails as scenario personas.",
    "Keep the run worksheet open and record each account email, password, role, and created record.",
    "Use a separate browser profile or clear cookies when switching personas.",
    "When a step fails, stop that phase, record the evidence, and continue only if the next phase does not depend on the failed result.",
    "The administrator invitation workflow is for staff/member onboarding. Dependents must create their own accounts and use the existing-account family-link flow.",
]:
    add_bullet(doc, item)

doc.add_heading("What changed in this revision", level=1)
for item in [
    "Public navigation is now intentionally focused on Book plus authentication. The former About, Classes, Membership, and Contact pages redirect to sections on the homepage.",
    "The public Book page now shows an interactive date-and-time calendar, Cape Town times, prices, remaining capacity, and guest/member access rules before login.",
    "Login, sign-up, email confirmation, and OAuth flows preserve a safe internal return path so users can resume booking, Family Accounts, or Membership Portal tasks.",
    "Public, authentication, protected, and administrator screens now include contextual Back behavior that must be checked with both navigation history and direct-entry fallbacks.",
]:
    add_bullet(doc, item)

doc.add_heading("Status labels", level=1)
for item in [
    "PASS: actual behavior matches the expected result.",
    "FAIL: the behavior is wrong or a required action is unavailable.",
    "BLOCKED: the test could not be run because a prerequisite or environment service failed.",
    "NOT APPLICABLE: the condition needed for the case did not exist; explain why.",
]:
    add_bullet(doc, item)

doc.add_heading("Run worksheet", level=1)
doc.add_paragraph("You do not need to create real Gmail, Outlook, or other email accounts for this local test. Use the fixed fake addresses below. Local Supabase accepts them, and Inbucket shows any messages sent to them at http://localhost:54324. Use real email addresses only when testing a hosted environment with real email delivery.")
doc.add_paragraph("If you run npx supabase db reset before testing, you can reuse these exact addresses. If you do not reset the database, add a suffix such as -2 to the address so it is unique.")
table = doc.add_table(rows=1, cols=4)
table.alignment = WD_TABLE_ALIGNMENT.LEFT
table.autofit = False
for i, h in enumerate(("Persona", "Unique email", "Password", "Created / role notes")):
    set_cell(table.rows[0].cells[i], h, bold=True, color="FFFFFF", size=8.5)
    shade(table.rows[0].cells[i], "12304A")
fixed_accounts = [
    ("Fresh public / guest", "cfa.public@example.test"),
    ("Fresh member", "cfa.member@example.test"),
    ("Second applicant", "cfa.applicant2@example.test"),
    ("Guardian", "cfa.guardian@example.test"),
    ("Dependent", "cfa.dependent@example.test"),
    ("Second guardian", "cfa.guardian2@example.test"),
    ("Second dependent", "cfa.dependent2@example.test"),
    ("Coach", "cfa.coach@example.test"),
    ("New administrator", "cfa.admin@example.test"),
]
for persona, email in fixed_accounts:
    cells = table.add_row().cells
    set_cell(cells[0], persona, bold=True, color="007C83", size=8.5)
    set_cell(cells[1], email, size=8.5)
    set_cell(cells[2], "CfaLocal2026!", size=8.5)
    set_cell(cells[3], "", size=8.5)

doc.add_heading("Local environment setup", level=1)
for step in [
    "Start Docker Desktop and wait until its Linux engine is responsive.",
    "Open PowerShell in the repository folder: C:\\3003\\CFA_Website\\cfa-platform.",
    "Start the local Supabase services with `npx supabase start`.",
    "Reset the local database with `npx supabase db reset`. This reapplies migrations and local seed data. It changes local data, so do not use it against a hosted project.",
    "Start the app with `npm run dev:local`.",
    "Open `http://localhost:3000` in the browser.",
    "Open `http://localhost:54324` for local Inbucket email messages.",
    "Create and record the run identifier before creating any scenario accounts.",
]:
    add_number(doc, step)
doc.add_heading("Environment checks", level=2)
for item in [
    "[ ] Docker Desktop is running.",
    "[ ] Supabase reports a running local stack.",
    "[ ] The application opens at http://localhost:3000.",
    "[ ] Inbucket opens at http://localhost:54324.",
    "[ ] The browser has no old CFA cookies or local storage for this run.",
]:
    add_bullet(doc, item)

doc.add_heading("Important administrator bootstrap", level=1)
doc.add_paragraph("A normal sign-up account starts as a guest and cannot promote itself to administrator. Use the local seeded administrator only to bootstrap a new run-specific administrator, then stop using the seeded account for the scenario tests.")
for step in [
    "Use the local setup credentials supplied for the seeded administrator.",
    "Sign in and open the administrator member area.",
    "Create or invite the run-specific administrator email from the worksheet.",
    "Open Inbucket and complete the new administrator account setup.",
    "Sign in as the new administrator and confirm the admin dashboard works.",
    "Use the new administrator for all later administrator phases.",
]:
    add_number(doc, step)

phases = [
    ("1", "Public visitor, consolidated routes, and responsive pages", "Logged-out visitor", "Local app running; no account required", [
        "Open the homepage and verify the CFA introduction, landing-page sections, Book link, Log in action, and Sign up action.",
        "At desktop width, confirm the fixed public navigation shows Cape Fencing, Book, and the authentication actions without covering the hero content.",
        "At phone and tablet widths, open the menu, confirm Book and authentication actions are usable, navigate to Book, and confirm the menu closes after the route change.",
        "Open /about and /classes and confirm each permanently redirects to /#about.",
        "Open /membership and confirm it permanently redirects to /#membership. Open /contact and confirm it permanently redirects to /#contact.",
        "Open /book, /privacy, and /terms and confirm each remains a real public page with the shared navigation, Back control, and footer.",
        "Use the Back control on each real public page and confirm it returns to the homepage rather than an external or stale browser-history entry.",
        "Check the homepage, public Book page, Privacy, and Terms at 375 x 812, 768 x 1024, and 1280 x 800.",
        "Record any overflow, obscured content, missing navigation, broken redirect, inaccessible menu state, or placeholder content.",
    ], "A logged-out visitor can browse the consolidated public experience, legacy routes land on the correct homepage section, and the responsive navigation works without forcing authentication.", "The standalone contact form no longer exists: /contact redirects to the homepage contact section. Privacy, terms, WhatsApp details, and some public content may still be placeholders."),
    ("2", "Create a fresh account and preserve the intended destination", "New public user", "Phase 1 passed; unique run email recorded; at least one public lesson is available", [
        "On /book, select an available guest-allowed lesson and choose Log in to continue.",
        "Confirm the login URL contains a safe next value for the selected /book?slot=... destination.",
        "Choose Create a guest account and confirm the sign-up URL retains the same next destination.",
        "Complete the four sign-up steps: full name, email, password, and password confirmation. Verify the screen consistently describes this as a guest account.",
        "Submit the form and record the result. Confirm the pending state prevents duplicate submission.",
        "If a confirmation message is sent, open Inbucket and follow the link.",
        "Sign in with the new account.",
        "Confirm the user returns to the original /book?slot=... destination and the selected lesson is still selected when it remains available.",
        "Confirm the account begins as a guest and reaches the protected dashboard.",
        "Refresh the dashboard and confirm the session survives.",
        "Log out, open a protected URL, and confirm redirection to login.",
    ], "A new guest account can be created, confirmed when required, authenticated, and returned to the intended internal task without losing the selected lesson."),
    ("3", "Profile completion and profile editing", "Fresh guest", "Fresh account created and signed in", [
        "Open the dashboard and note whether profile completion is required.",
        "Open Complete Profile.",
        "Enter contact information, date of birth, emergency contact, and any required training information.",
        "Accept the terms and privacy notice.",
        "Submit and refresh the page.",
        "Confirm the saved information persists.",
        "Open Profile, edit permitted fields, save, refresh, and confirm persistence.",
        "Attempt to change role, staff status, or membership status as the ordinary user.",
    ], "Users can manage their own permitted information but cannot assign themselves roles or membership access."),
    ("4", "Membership Portal entry and application", "Fresh guest", "Profile is usable; membership types are available", [
        "While logged out, open /membership-portal and confirm redirect to login with a next value for /protected/membership-request.",
        "Sign in and confirm the flow lands on Membership Request rather than the generic dashboard.",
        "While signed in, open /membership-portal directly and confirm it redirects to /protected/membership-request.",
        "Confirm Membership Portal is present in protected navigation and opens the same destination.",
        "Review the available membership types and prices shown.",
        "Select a membership type and submit the application.",
        "Confirm the application becomes pending.",
        "Confirm the account remains a guest while pending.",
        "Refresh and confirm the application remains visible.",
        "Record the application details for the administrator phase.",
    ], "The Membership Portal entry preserves the requested destination through authentication, and a user can apply without becoming a member automatically."),
    ("5", "Fresh administrator dashboard and member list", "New administrator", "Administrator bootstrap completed", [
        "Open the admin dashboard.",
        "Open the member list and confirm seeded and newly created records are visible.",
        "Search for the fresh guest.",
        "Apply member filters.",
        "Test pagination if enough records exist.",
        "Open the fresh guest’s member detail page.",
        "Record the visible counts and any mismatch.",
    ], "The new administrator can view and search administrative member information while ordinary users cannot."),
    ("6", "Administrator membership review", "Administrator and applicant", "Phase 4 application is pending", [
        "Open Membership Requests as the administrator.",
        "Find the fresh applicant and review the submitted information.",
        "Approve the application.",
        "Sign in as the applicant and confirm the member status and membership type.",
        "Create a second fresh account and submit another application.",
        "Have the administrator request changes with a visible response and private note.",
        "Sign in as the second applicant, confirm the response, update the information, and resubmit.",
        "Have the administrator reject or approve the resubmitted application.",
        "Confirm the final status and access.",
    ], "Administrators control membership decisions; applicants cannot approve themselves. Approval affects only the individual applicant."),
    ("7", "Guardian and dependent account creation", "Guardian and dependent", "Two unique fresh accounts are available", [
        "While logged out, open /family and confirm redirect to login with a next value for /protected/family.",
        "Create a fresh guardian account through normal sign-up.",
        "Create a fresh dependent account through normal sign-up.",
        "Confirm both accounts have separate credentials.",
        "Sign in to each account separately.",
        "Confirm neither account is automatically a dependent before linking.",
        "Complete enough profile information for both accounts to use protected workflows.",
        "While signed in, open /family and confirm it redirects to /protected/family. Confirm Family Accounts is also present in protected navigation.",
    ], "Both people exist as independent accounts before any family relationship is created, and the Family Accounts entry preserves its destination through authentication."),
    ("8", "Request and approve a family link", "Guardian and dependent", "Both accounts exist and are usable", [
        "Sign in as the guardian and open Family Accounts.",
        "Choose Link Existing Dependent Account.",
        "Enter the dependent’s unique account email and submit.",
        "Confirm the response does not disclose unnecessary account existence information.",
        "Sign in as the dependent and open Family Accounts.",
        "Confirm the incoming request is visible and identifies the guardian appropriately.",
        "Accept the request and refresh.",
        "Sign in as the guardian, open Family Accounts, and confirm the relationship is active.",
        "Open Dependents and confirm the dependent appears.",
    ], "The family link becomes active only after the existing dependent account approves it."),
    ("9", "Reject a family-link request", "Second guardian-dependent pair", "A pending family-link request exists", [
        "Sign in as the dependent.",
        "Open Family Accounts and reject the incoming request.",
        "Confirm the request is rejected or inactive.",
        "Sign in as the guardian and confirm booking for that dependent is unavailable.",
        "Confirm no dependent billing relationship was created.",
        "Confirm the dependent cannot see guardian financial information.",
    ], "Rejecting a request grants no family access and no billing authority."),
    ("10", "End an active family link", "Active guardian-dependent pair", "Phase 8 relationship is active", [
        "Open Family Accounts as an authorised party.",
        "End the active relationship.",
        "Confirm the relationship becomes ended.",
        "Confirm future linked-dependent actions are unavailable.",
        "Confirm existing accounts, bookings, invoices, payments, and history remain.",
    ], "Ending a relationship removes future access without deleting historical records."),
    ("11", "Create a fresh coach account", "Administrator and new coach", "Administrator account is active; unique coach email recorded", [
        "Open Add Member as the administrator.",
        "Create or invite the run-specific coach account.",
        "Open Inbucket and complete the coach setup.",
        "Sign in as the coach and open ordinary protected pages.",
        "Attempt to open administrator routes directly.",
        "Confirm the coach is rejected or redirected.",
        "Return as administrator and confirm the account is staff with coach type.",
    ], "A coach is staff but is not an administrator."),
    ("12", "Administrator authorization matrix", "All role accounts", "Administrator, guest, member, guardian, dependent, and coach accounts exist", [
        "As administrator, open dashboard, members, member detail, households, membership requests, lessons, invoicing, and payments.",
        "As guest, member, guardian, dependent, and coach, attempt to open every administrator route directly.",
        "Confirm each non-admin role is redirected or denied.",
        "Confirm no admin data is exposed in the denied response.",
        "Confirm the result is enforced even when the navigation link is not used.",
    ], "Only administrators can use administrator workflows."),
    ("13", "Create lesson slots and publish availability", "Administrator", "Administrator account is active; coach may exist", [
        "Open Admin Lessons.",
        "Create one future guest-allowed lesson with start time, end time, price, capacity, and coach.",
        "Create one future active-members-only lesson on a different date.",
        "Save both lessons.",
        "Open /book while logged out and confirm both appear on the correct date in Cape Town time with the configured price, access rule, and remaining-capacity text.",
        "Confirm /protected/book redirects to the same public calendar and retains a supplied slot query parameter.",
    ], "Administrators control lesson availability, pricing, capacity, coach, and access rule, and public-safe availability is published without exposing participant details."),
    ("14", "Public calendar and guest booking", "Logged-out visitor and fresh guest", "A guest-allowed lesson exists; seeded lessons are available after a local reset", [
        "Open /book while logged out and confirm only open future lessons are shown.",
        "Confirm the date control, available-date chips, selected date, time cards, and selection summary stay synchronized.",
        "Confirm every time card shows Cape Town time, price, remaining capacity or Places available, and either Guests welcome or Active members only.",
        "If a full lesson exists, confirm it is labelled Full, cannot be selected, and does not become the initial selection.",
        "Open /book?slot=<invalid-or-unavailable-id> and confirm a clear unavailable message appears and another available lesson is selected when possible.",
        "Select the guest-allowed lesson and choose Log in to continue.",
        "Confirm authentication is required and the intended /book?slot=... destination is retained through login.",
        "Sign in as the fresh guest.",
        "Select the guest as participant and confirm the guest payment rule.",
        "Submit the booking.",
        "Confirm a success status is announced, the booking appears in Lesson History, and public remaining capacity updates without exposing the participant.",
        "Repeat against a members-only lesson and confirm the guest is rejected.",
    ], "The public calendar exposes safe aggregate availability, preserves the selected lesson through authentication, and enforces the lesson access rule when booking."),
    ("15", "Active member booking", "Fresh member", "Membership was approved; members-only lesson exists", [
        "Open Book as the active member.",
        "Select a members-only lesson and the member as participant.",
        "Confirm the member is eligible.",
        "Submit the booking.",
        "Confirm the booking appears in history and the charge has the correct payer.",
    ], "Active membership allows member-only participation where configured."),
    ("16", "Dependent self-booking", "Dependent", "Family link is active; eligible lesson exists", [
        "Open Book as the dependent.",
        "Confirm only the dependent can be selected.",
        "Attempt to select another household person.",
        "Book an eligible lesson.",
        "Confirm payment follows the guardian-handled rule.",
        "Confirm the booking appears in dependent history.",
        "Confirm guardian booking visibility is permitted while dependent billing remains private.",
    ], "A dependent can book for themselves but cannot book for another person or view guardian finances."),
    ("17", "Guardian booking for dependent", "Guardian", "Family link is active; dependent is eligible", [
        "Open Book or Dependents as the guardian.",
        "Select the linked dependent and a lesson.",
        "Confirm the dependent is the participant and the guardian is the booking actor.",
        "Submit the booking.",
        "Confirm it appears in dependent lesson history.",
        "Confirm the resulting charge routes to the guardian.",
        "Repeat with a guest dependent against a members-only lesson and confirm the dependent is rejected even if the guardian is a member.",
    ], "The dependent’s eligibility controls the booking; the guardian’s membership does not bypass it."),
    ("18", "Cross-household security", "Guardian or payer", "At least one unrelated account exists", [
        "Attempt to manipulate the participant identifier to reference an unrelated account.",
        "Attempt to book for a person outside the active family link.",
        "Attempt to view unrelated household information.",
        "Attempt to access unrelated billing records.",
    ], "Every cross-household request is rejected server-side."),
    ("19", "Lesson history", "Guest, member, guardian, dependent", "At least one booking exists for each applicable persona", [
        "Open Lesson History for each role.",
        "Confirm past and upcoming bookings appear where permitted.",
        "Confirm participant attribution is correct.",
        "Confirm ordinary lesson history does not expose household financial details.",
        "Confirm guardians see only permitted linked-dependent information.",
    ], "Lesson history follows the participant and respects family privacy."),
    ("20", "Invoice generation and replay", "Administrator", "Unpaid eligible charges exist", [
        "Open Invoicing and generate invoices for the current test period.",
        "Confirm invoice lines identify the participant.",
        "Record the invoice reference.",
        "Run invoice generation a second time.",
        "Confirm duplicate invoices or duplicate recurring charges are not created.",
        "Open the invoice detail view.",
    ], "Invoice generation is repeatable without duplicating the same period’s charges."),
    ("21", "Payer billing and dependent isolation", "Guardian and dependent", "Dependent charges or invoice lines exist", [
        "Open Billing as the guardian.",
        "Confirm dependent charges and participant-attributed invoice lines are visible.",
        "Confirm receipts are visible after settlement.",
        "Open Billing as the dependent.",
        "Attempt navigation access and direct URL access.",
        "Confirm guardian balances, invoices, payment methods, and payment history are unavailable.",
    ], "Payers can view authorised household finances; dependents cannot view guardian finances."),
    ("22", "Manual payment and receipt", "Administrator and payer", "An outstanding invoice exists", [
        "Open Payments as the administrator.",
        "Find the outstanding invoice.",
        "Record a manual payment.",
        "Confirm the invoice and relevant charge settle.",
        "Confirm exactly one receipt is created.",
        "Sign in as payer and confirm the receipt appears.",
    ], "Manual payment creates one consistent settlement and one receipt."),
    ("23", "Password recovery", "Fresh scenario user", "Account exists; Inbucket is available", [
        "Log out and open Forgot Password.",
        "Enter the scenario account email.",
        "Open the reset message in Inbucket.",
        "Set a new password.",
        "Sign in with the new password.",
        "Confirm the account still has the correct profile and role.",
    ], "A user can recover access without losing their profile, membership, family, or staff association."),
    ("24", "Navigation history, Back fallbacks, and safe return paths", "Logged-out visitor and signed-in role accounts", "Public, protected, and administrator routes are available", [
        "Navigate homepage to Book, then use the public Back control. Confirm it always returns to / instead of following an external or stale history entry.",
        "Open login and sign-up directly and confirm their fixed Back controls return to /.",
        "Sign in and navigate Dashboard to Profile to Membership Portal. Use Back on each protected screen and confirm it follows the most recent internal CFA route without bouncing between two pages.",
        "Open a protected page in a fresh tab with no CFA navigation history and confirm Back falls back to /protected. On /protected itself, confirm Back falls back to /.",
        "Open an administrator subpage directly in a fresh tab and confirm Back falls back to /protected/admin.",
        "Open /auth?next=%2Fbook%3Fslot%3D<valid-slot-id> and confirm it redirects to login while preserving the safe internal destination.",
        "Try external, protocol-relative, encoded external, and backslash-containing next values. Confirm each is rejected and the post-login destination falls back to /protected.",
        "Confirm login-to-sign-up, sign-up-to-login, email confirmation, and Google OAuth entry links preserve only valid internal next values.",
        "Repeat the navigation checks with keyboard focus and confirm every Back, menu, and authentication control has a visible focus indicator.",
    ], "Navigation is predictable for direct entry and normal browsing, authentication resumes valid internal tasks, and crafted return paths cannot redirect off-site."),
    ("25", "Final role and evidence review", "Tester", "All phases attempted", [
        "Complete the pass/fail summary for public navigation, authentication return paths, profile, membership, family, booking calendar, billing, coach, admin, and security tests.",
        "List every failed or blocked test with the URL, role, exact action, expected result, actual result, and screenshot.",
        "Record whether the issue is a defect, missing configuration, missing business decision, or unavailable test data.",
        "Do not mark the run signed off if critical family, booking, billing, or authorization tests are blocked.",
    ], "The final report clearly separates passed behavior, failed behavior, blocked tests, known issues, and untested scope."),
]

for phase in phases:
    add_phase(doc, *phase)

doc.add_heading("Final role capability matrix", level=1)
matrix = doc.add_table(rows=1, cols=8)
matrix.alignment = WD_TABLE_ALIGNMENT.LEFT
matrix.autofit = False
headers = ["Capability", "Public", "Guest", "Member", "Guardian", "Dependent", "Coach", "Admin"]
for i, h in enumerate(headers):
    set_cell(matrix.rows[0].cells[i], h, bold=True, color="FFFFFF", size=7.5)
    shade(matrix.rows[0].cells[i], "12304A")
rows = [
    ("Browse public pages", "Yes", "Yes", "Yes", "Yes", "Yes", "Yes", "Yes"),
    ("Apply for own membership", "Action starts auth", "Yes", "Own status", "Yes", "Yes", "Yes", "Yes"),
    ("View own profile", "No", "Yes", "Yes", "Yes", "Yes", "Yes", "Yes"),
    ("Book for self", "No", "If eligible", "If eligible", "If eligible", "Yes", "If eligible", "Yes"),
    ("Book for dependent", "No", "No", "No", "If linked", "No", "No", "Yes"),
    ("View household billing", "No", "If payer", "If payer", "If payer", "No", "No", "Yes"),
    ("Review applications", "No", "No", "No", "No", "No", "No", "Yes"),
    ("Create lessons", "No", "No", "No", "No", "No", "No", "Yes"),
    ("Generate invoices", "No", "No", "No", "No", "No", "No", "Yes"),
    ("Access admin area", "No", "No", "No", "No", "No", "No", "Yes"),
]
for values in rows:
    cells = matrix.add_row().cells
    for i, value in enumerate(values):
        set_cell(cells[i], value, bold=i == 0, color="007C83" if i == 0 else "243447", size=7.5)

doc.add_heading("Known limitations to record, not silently ignore", level=1)
for item in [
    "The final CFA Privacy / POPIA wording is not complete.",
    "The final Terms and Conditions are not complete.",
    "Google authentication requires provider configuration.",
    "Real payment-provider checkout is not implemented.",
    "Refunds, VAT, partial payments, debit orders, and arrears rules are not complete.",
    "Notification channels and some membership lifecycle rules remain open decisions.",
    "The current working tree needs a fresh browser pass after local Supabase is available.",
]:
    add_bullet(doc, item)

footer = section.footer.paragraphs[0]
footer.alignment = WD_ALIGN_PARAGRAPH.CENTER
r = footer.add_run("CFA Platform | Manual Role-Based QA Test Plan")
r.font.name = "Aptos"
r.font.size = Pt(8)
r.font.color.rgb = RGBColor(100, 116, 139)

doc.save(OUT)
print(OUT)
