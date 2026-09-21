from pathlib import Path

from docx import Document
from docx.enum.section import WD_SECTION
from docx.enum.table import WD_CELL_VERTICAL_ALIGNMENT, WD_TABLE_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Inches, Pt, RGBColor


OUT = Path("docs/planning/CFA_Team_Delivery_Ticket_Plan.docx")

NAVY = "16324F"
BLUE = "246B9E"
TEAL = "2A7F7F"
GOLD = "D8A13A"
PALE_BLUE = "EAF2F8"
PALE_TEAL = "E8F4F3"
PALE_GOLD = "FBF4E5"
PALE_GRAY = "F3F5F7"
MID_GRAY = "667085"
WHITE = "FFFFFF"
BLACK = "111827"
RED = "9B1C1C"


def set_cell_shading(cell, fill):
    tc_pr = cell._tc.get_or_add_tcPr()
    shd = tc_pr.find(qn("w:shd"))
    if shd is None:
        shd = OxmlElement("w:shd")
        tc_pr.append(shd)
    shd.set(qn("w:fill"), fill)


def set_cell_margins(cell, top=100, start=140, bottom=100, end=140):
    tc = cell._tc
    tc_pr = tc.get_or_add_tcPr()
    tc_mar = tc_pr.first_child_found_in("w:tcMar")
    if tc_mar is None:
        tc_mar = OxmlElement("w:tcMar")
        tc_pr.append(tc_mar)
    for margin, value in (("top", top), ("start", start), ("bottom", bottom), ("end", end)):
        node = tc_mar.find(qn(f"w:{margin}"))
        if node is None:
            node = OxmlElement(f"w:{margin}")
            tc_mar.append(node)
        node.set(qn("w:w"), str(value))
        node.set(qn("w:type"), "dxa")


def set_table_borders(table, color="D0D5DD", size="6"):
    tbl_pr = table._tbl.tblPr
    borders = tbl_pr.find(qn("w:tblBorders"))
    if borders is None:
        borders = OxmlElement("w:tblBorders")
        tbl_pr.append(borders)
    for edge in ("top", "left", "bottom", "right", "insideH", "insideV"):
        el = borders.find(qn(f"w:{edge}"))
        if el is None:
            el = OxmlElement(f"w:{edge}")
            borders.append(el)
        el.set(qn("w:val"), "single")
        el.set(qn("w:sz"), size)
        el.set(qn("w:color"), color)


def set_repeat_table_header(row):
    tr_pr = row._tr.get_or_add_trPr()
    tbl_header = OxmlElement("w:tblHeader")
    tbl_header.set(qn("w:val"), "true")
    tr_pr.append(tbl_header)


def set_table_widths(table, widths_dxa):
    table.autofit = False
    tbl_pr = table._tbl.tblPr
    tbl_w = tbl_pr.find(qn("w:tblW"))
    if tbl_w is None:
        tbl_w = OxmlElement("w:tblW")
        tbl_pr.append(tbl_w)
    tbl_w.set(qn("w:w"), str(sum(widths_dxa)))
    tbl_w.set(qn("w:type"), "dxa")
    tbl_ind = tbl_pr.find(qn("w:tblInd"))
    if tbl_ind is None:
        tbl_ind = OxmlElement("w:tblInd")
        tbl_pr.append(tbl_ind)
    tbl_ind.set(qn("w:w"), "120")
    tbl_ind.set(qn("w:type"), "dxa")
    grid = table._tbl.tblGrid
    for child in list(grid):
        grid.remove(child)
    for width in widths_dxa:
        col = OxmlElement("w:gridCol")
        col.set(qn("w:w"), str(width))
        grid.append(col)
    for row in table.rows:
        for idx, cell in enumerate(row.cells):
            width = widths_dxa[idx]
            cell.width = Inches(width / 1440)
            tc_pr = cell._tc.get_or_add_tcPr()
            tc_w = tc_pr.find(qn("w:tcW"))
            if tc_w is None:
                tc_w = OxmlElement("w:tcW")
                tc_pr.append(tc_w)
            tc_w.set(qn("w:w"), str(width))
            tc_w.set(qn("w:type"), "dxa")
            set_cell_margins(cell)


def set_run(run, size=10.5, bold=False, color=BLACK, italic=False):
    run.font.name = "Calibri"
    run._element.get_or_add_rPr().rFonts.set(qn("w:ascii"), "Calibri")
    run._element.get_or_add_rPr().rFonts.set(qn("w:hAnsi"), "Calibri")
    run.font.size = Pt(size)
    run.font.bold = bold
    run.font.italic = italic
    run.font.color.rgb = RGBColor.from_string(color)


def set_text(cell, text, bold=False, color=BLACK, size=9.5, align=None):
    cell.text = ""
    p = cell.paragraphs[0]
    p.paragraph_format.space_before = Pt(0)
    p.paragraph_format.space_after = Pt(0)
    p.paragraph_format.line_spacing = 1.08
    if align is not None:
        p.alignment = align
    set_run(p.add_run(text), size=size, bold=bold, color=color)
    cell.vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.CENTER


def style_doc(doc):
    section = doc.sections[0]
    section.page_width = Inches(8.5)
    section.page_height = Inches(11)
    section.top_margin = Inches(0.78)
    section.bottom_margin = Inches(0.72)
    section.left_margin = Inches(0.86)
    section.right_margin = Inches(0.86)
    section.header_distance = Inches(0.35)
    section.footer_distance = Inches(0.35)

    normal = doc.styles["Normal"]
    normal.font.name = "Calibri"
    normal._element.rPr.rFonts.set(qn("w:ascii"), "Calibri")
    normal._element.rPr.rFonts.set(qn("w:hAnsi"), "Calibri")
    normal.font.size = Pt(10.5)
    normal.font.color.rgb = RGBColor.from_string(BLACK)
    normal.paragraph_format.space_after = Pt(6)
    normal.paragraph_format.line_spacing = 1.13

    for style_name, size, before, after, color in (
        ("Title", 27, 0, 5, NAVY),
        ("Subtitle", 12.5, 0, 16, MID_GRAY),
        ("Heading 1", 16, 16, 7, NAVY),
        ("Heading 2", 12.5, 11, 5, BLUE),
        ("Heading 3", 11, 8, 3, TEAL),
    ):
        style = doc.styles[style_name]
        style.font.name = "Calibri"
        style._element.rPr.rFonts.set(qn("w:ascii"), "Calibri")
        style._element.rPr.rFonts.set(qn("w:hAnsi"), "Calibri")
        style.font.size = Pt(size)
        style.font.bold = style_name != "Subtitle"
        style.font.color.rgb = RGBColor.from_string(color)
        style.paragraph_format.space_before = Pt(before)
        style.paragraph_format.space_after = Pt(after)
        style.paragraph_format.keep_with_next = True


def add_field(paragraph, instruction):
    run = paragraph.add_run()
    fld_char = OxmlElement("w:fldChar")
    fld_char.set(qn("w:fldCharType"), "begin")
    instr = OxmlElement("w:instrText")
    instr.set(qn("xml:space"), "preserve")
    instr.text = instruction
    separate = OxmlElement("w:fldChar")
    separate.set(qn("w:fldCharType"), "separate")
    text = OxmlElement("w:t")
    text.text = "1"
    end = OxmlElement("w:fldChar")
    end.set(qn("w:fldCharType"), "end")
    run._r.extend([fld_char, instr, separate, text, end])
    set_run(run, size=8.5, color=MID_GRAY)


def add_header_footer(doc):
    section = doc.sections[0]
    hp = section.header.paragraphs[0]
    hp.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    hp.paragraph_format.space_after = Pt(0)
    set_run(hp.add_run("CFA PLATFORM  |  TEAM DELIVERY PLAN"), size=8, bold=True, color=MID_GRAY)
    fp = section.footer.paragraphs[0]
    fp.alignment = WD_ALIGN_PARAGRAPH.CENTER
    fp.paragraph_format.space_before = Pt(0)
    set_run(fp.add_run("Internal working document  |  Page "), size=8.5, color=MID_GRAY)
    add_field(fp, "PAGE")


def add_tag_line(doc, items):
    table = doc.add_table(rows=1, cols=len(items))
    table.alignment = WD_TABLE_ALIGNMENT.LEFT
    widths = [int(9360 / len(items))] * len(items)
    widths[-1] += 9360 - sum(widths)
    for idx, (label, value, fill) in enumerate(items):
        set_cell_shading(table.cell(0, idx), fill)
        cell = table.cell(0, idx)
        cell.text = ""
        p = cell.paragraphs[0]
        p.paragraph_format.space_after = Pt(0)
        set_run(p.add_run(label.upper() + "\n"), size=7.5, bold=True, color=MID_GRAY)
        set_run(p.add_run(value), size=10.5, bold=True, color=NAVY)
    set_table_widths(table, widths)
    set_table_borders(table, color="FFFFFF", size="0")


def add_callout(doc, heading, text, fill=PALE_BLUE, accent=NAVY):
    table = doc.add_table(rows=1, cols=1)
    set_table_widths(table, [9360])
    set_table_borders(table, color=accent, size="10")
    set_cell_shading(table.cell(0, 0), fill)
    cell = table.cell(0, 0)
    cell.text = ""
    p = cell.paragraphs[0]
    p.paragraph_format.space_after = Pt(2)
    set_run(p.add_run(heading + "\n"), size=9, bold=True, color=accent)
    set_run(p.add_run(text), size=10, color=BLACK)


def add_ticket(doc, ticket):
    table = doc.add_table(rows=0, cols=2)
    table.alignment = WD_TABLE_ALIGNMENT.LEFT
    top = table.add_row().cells
    top[0].merge(top[1])
    set_cell_shading(top[0], ticket["fill"])
    top[0].text = ""
    p = top[0].paragraphs[0]
    p.paragraph_format.space_after = Pt(0)
    set_run(p.add_run(ticket["id"] + "  "), size=10, bold=True, color=ticket["accent"])
    set_run(p.add_run(ticket["title"]), size=10.5, bold=True, color=NAVY)
    for label, value in (
        ("Owner", ticket["owner"]),
        ("Branch", ticket["branch"]),
        ("Scope", ticket["scope"]),
        ("Done when", ticket["done"]),
        ("Depends on", ticket["depends"]),
    ):
        row = table.add_row().cells
        set_cell_shading(row[0], PALE_GRAY)
        set_text(row[0], label.upper(), bold=True, color=MID_GRAY, size=8)
        set_text(row[1], value, size=9.1)
    set_table_widths(table, [1510, 7850])
    set_table_borders(table)
    p = doc.add_paragraph()
    p.paragraph_format.space_after = Pt(1)


def add_owner_table(doc):
    rows = [
        ("Person A", "Lead developer and integration owner", "Payment gateway, finance domain, shared contracts, final integration", "Highest"),
        ("Person B", "Booking owner", "Jeremy feedback, booking UX, focused booking tests", "Medium"),
        ("Person C", "Shop feature owner", "Catalogue and cart UI, product management UI", "Medium"),
        ("Person D", "QA and delivery owner", "Acceptance tests, test data, release notes, regression coordination", "Low-code"),
    ]
    table = doc.add_table(rows=1, cols=4)
    for idx, text in enumerate(("Owner", "Role", "Primary boundary", "Complexity")):
        set_cell_shading(table.cell(0, idx), NAVY)
        set_text(table.cell(0, idx), text, bold=True, color=WHITE, size=8.5)
    set_repeat_table_header(table.rows[0])
    for owner, role, boundary, complexity in rows:
        cells = table.add_row().cells
        for idx, value in enumerate((owner, role, boundary, complexity)):
            set_text(cells[idx], value, bold=idx == 0, size=8.8)
        if owner == "Person A":
            for cell in cells:
                set_cell_shading(cell, PALE_GOLD)
    set_table_widths(table, [1200, 2250, 4360, 1550])
    set_table_borders(table)


def add_merge_sequence(doc):
    steps = [
        ("1", "Agree contracts", "Person A publishes gateway, invoice, order, and shared type interfaces before implementation branches diverge."),
        ("2", "Merge booking", "Person B lands the isolated booking changes after focused tests. Avoid finance and shop files."),
        ("3", "Merge shop UI", "Person C lands catalogue/cart work behind stable interfaces or mock adapters. Avoid payment implementation files."),
        ("4", "Merge finance core", "Person A lands migrations, invoice/payment logic, provider adapter, callbacks, and security rules."),
        ("5", "Connect checkout", "Person A connects shop and booking charges to the shared payment and invoicing flow."),
        ("6", "Release gate", "Person D runs the end-to-end matrix, records defects, and signs off only when required checks pass."),
    ]
    table = doc.add_table(rows=1, cols=3)
    for idx, text in enumerate(("Step", "Gate", "Action")):
        set_cell_shading(table.cell(0, idx), TEAL)
        set_text(table.cell(0, idx), text, bold=True, color=WHITE, size=8.5)
    set_repeat_table_header(table.rows[0])
    for number, gate, action in steps:
        cells = table.add_row().cells
        set_text(cells[0], number, bold=True, color=TEAL, align=WD_ALIGN_PARAGRAPH.CENTER)
        set_text(cells[1], gate, bold=True, size=9)
        set_text(cells[2], action, size=8.8)
    set_table_widths(table, [720, 1850, 6790])
    set_table_borders(table)


def main():
    OUT.parent.mkdir(parents=True, exist_ok=True)
    doc = Document()
    style_doc(doc)
    add_header_footer(doc)

    title = doc.add_paragraph(style="Title")
    title.paragraph_format.space_before = Pt(10)
    title.add_run("CFA Platform Team Delivery Plan")
    subtitle = doc.add_paragraph(style="Subtitle")
    subtitle.add_run("Ticket breakdown, branch ownership, dependencies, and merge strategy")

    add_tag_line(doc, [
        ("Team", "4 people", PALE_BLUE),
        ("Lead", "Person A", PALE_GOLD),
        ("Approach", "One feature branch each", PALE_TEAL),
        ("Status", "Ready for sizing", PALE_GRAY),
    ])
    doc.add_paragraph()
    add_callout(
        doc,
        "RECOMMENDED SPLIT",
        "Person A owns the hardest cross-cutting work: finance architecture, database changes, payment provider integration, security, and final integration. Persons B and C receive contained feature areas. Person D owns QA, test evidence, and release coordination.",
        fill=PALE_GOLD,
        accent=GOLD,
    )

    doc.add_heading("1. Ground rules", level=1)
    ground = [
        "One owner per branch. Open a draft pull request early so file overlap is visible.",
        "Person A is the only owner of shared financial database migrations, payment callbacks, provider credentials/configuration, and core finance contracts.",
        "Do not edit another person's files without agreeing first. If a shared file must change, make that a small separate commit.",
        "Rebase or merge the latest main branch before requesting final review. Resolve conflicts on the feature branch, not on main.",
        "No secrets in source control. Use safe configuration templates for key names and keep real credentials in the deployment platform.",
        "Every pull request includes tests, screenshots where the UI changes, migration notes where the database changes, and a short rollback note.",
    ]
    for item in ground:
        p = doc.add_paragraph(style="List Bullet")
        p.add_run(item)

    doc.add_heading("2. Ownership map", level=1)
    add_owner_table(doc)

    tickets = [
        {
            "id": "FIN-01", "title": "Define the finance and payment architecture", "owner": "Person A",
            "branch": "feature/finance-architecture", "fill": PALE_GOLD, "accent": GOLD,
            "scope": "Document the source of truth for charges, invoices, invoice lines, orders, payment attempts, provider events, receipts, refunds, and status transitions. Define the interfaces used by booking and shop code.",
            "done": "A reviewed decision record exists; state transitions and idempotency rules are explicit; shared TypeScript/domain contracts are merged; no provider-specific logic leaks into booking or shop UI.",
            "depends": "Jeremy's confirmed business rules for cancellations, refunds, taxes, invoice timing, and who pays for dependants.",
        },
        {
            "id": "PAY-01", "title": "Evaluate Peach Payments vs Payfast and select one provider", "owner": "Person A",
            "branch": "feature/payment-provider-decision", "fill": PALE_GOLD, "accent": GOLD,
            "scope": "Compare supported checkout flow, recurring or tokenized payments if required, webhook/callback model, sandbox support, settlement and reconciliation data, refunds, fees, and South African operational fit. Record the decision and fallback plan.",
            "done": "The team approves one provider; sandbox access and required credentials are identified; callback URLs and security requirements are documented; implementation can begin without reopening the choice.",
            "depends": "CFA payment requirements and merchant-account availability.",
        },
        {
            "id": "PAY-02", "title": "Implement the payment provider adapter and secure callbacks", "owner": "Person A",
            "branch": "feature/payment-gateway", "fill": PALE_GOLD, "accent": GOLD,
            "scope": "Create checkout initiation, signed return/cancel handling, server-to-server notification or webhook verification, idempotent provider-event storage, payment-attempt tracking, successful settlement, failure states, and safe retry handling.",
            "done": "Sandbox payments pass success, cancel, failure, duplicate callback, tampered callback, and retry scenarios; secrets remain server-side; logs contain references but no sensitive payment data.",
            "depends": "FIN-01 and PAY-01.",
        },
        {
            "id": "FIN-02", "title": "Complete invoicing, allocation, receipts, and reconciliation logic", "owner": "Person A",
            "branch": "feature/invoice-payment-lifecycle", "fill": PALE_GOLD, "accent": GOLD,
            "scope": "Extend the existing invoice-only workflow for online payments. Handle invoice numbering, totals, line ownership, partial or full settlement policy, payment allocation, receipt creation, reversals/refunds policy, reconciliation, and admin visibility without exposing guardian finances to dependants.",
            "done": "Invoice totals equal eligible charges; retries create no duplicates; payments and receipts reconcile; manual and online flows coexist; RLS/privacy tests pass; admin and payer views show consistent statuses.",
            "depends": "FIN-01, PAY-02, and confirmed business rules.",
        },
        {
            "id": "BOOK-01", "title": "Convert Jeremy's booking feedback into acceptance criteria", "owner": "Person B",
            "branch": "feature/booking-feedback", "fill": PALE_BLUE, "accent": BLUE,
            "scope": "Create a checklist from Jeremy's latest feedback. Link each requested change to the current member, dependant, coach, and admin booking journeys. Flag unclear rules for Person A or Jeremy before coding.",
            "done": "Every feedback item has an expected behaviour, affected screen, user role, priority, and test scenario; ambiguities are separated from confirmed work.",
            "depends": "Jeremy's feedback notes or a review session.",
        },
        {
            "id": "BOOK-02", "title": "Implement the approved booking UX and workflow changes", "owner": "Person B",
            "branch": "feature/booking-feedback", "fill": PALE_BLUE, "accent": BLUE,
            "scope": "Update booking pages and components only. Keep payment initiation behind the shared interface owned by Person A. Add focused unit/UI tests and screenshots for changed states.",
            "done": "Confirmed feedback is implemented; self and dependant booking journeys work; loading, empty, validation, unavailable-slot, success, and cancellation states are covered; existing booking tests remain green.",
            "depends": "BOOK-01. Use FIN-01 contracts if payment choice is displayed.",
        },
        {
            "id": "SHOP-01", "title": "Define the shop catalogue and order requirements", "owner": "Person C",
            "branch": "feature/shop-catalogue", "fill": PALE_TEAL, "accent": TEAL,
            "scope": "List products, variants/sizes, prices, images, stock behaviour, member visibility, fulfilment/collection, order statuses, and admin maintenance needs. Produce sample catalogue data and screen states.",
            "done": "The product and order fields are agreed; out-of-scope items are explicit; sample data covers normal, out-of-stock, and unavailable products; Person A approves financial boundaries.",
            "depends": "CFA shop requirements and product data.",
        },
        {
            "id": "SHOP-02", "title": "Build the catalogue, cart, and admin product UI", "owner": "Person C",
            "branch": "feature/shop-catalogue", "fill": PALE_TEAL, "accent": TEAL,
            "scope": "Build product browsing, product detail, cart quantity changes, totals display, empty/error/loading states, and basic admin product maintenance. Use a mock/stable checkout interface until Person A connects payments.",
            "done": "Responsive member and admin flows work with sample data; currency and totals display consistently; inaccessible/out-of-stock products cannot be ordered; UI tests and screenshots are included.",
            "depends": "SHOP-01 and the order/checkout contract from FIN-01.",
        },
        {
            "id": "INT-01", "title": "Connect shop and booking to the shared financial flow", "owner": "Person A",
            "branch": "feature/checkout-integration", "fill": PALE_GOLD, "accent": GOLD,
            "scope": "Wire shop checkout and any approved booking pay-now path into a single server-side payment initiation flow. Preserve invoice-only/pay-later behaviour where required. Prevent client-supplied price or payer manipulation.",
            "done": "Both sources create traceable financial records; amounts are calculated server-side; duplicate submissions are safe; payment result updates the correct invoice/order/booking; cross-user access is rejected.",
            "depends": "PAY-02, FIN-02, BOOK-02, and SHOP-02.",
        },
        {
            "id": "QA-01", "title": "Create and run the cross-feature acceptance matrix", "owner": "Person D",
            "branch": "test/end-to-end-commerce", "fill": PALE_GRAY, "accent": MID_GRAY,
            "scope": "Maintain test users/data and run happy-path and failure-path checks for booking, shop, invoices, manual payments, online payments, dependants, admin views, callbacks, and access control. File reproducible defects against the owning branch.",
            "done": "A test report shows pass/fail evidence for required journeys; all P0/P1 defects are closed; regression checks, lint, typecheck, database workflow tests, and production build pass before release.",
            "depends": "Incremental access to all branches; final sign-off depends on INT-01.",
        },
        {
            "id": "REL-01", "title": "Prepare release notes and rollout checklist", "owner": "Person D",
            "branch": "docs/release-commerce", "fill": PALE_GRAY, "accent": MID_GRAY,
            "scope": "Document configuration key names, migration order, sandbox-to-production switch, callback URL setup, smoke tests, rollback steps, known limitations, and support contacts. Do not include real secret values.",
            "done": "Another team member can follow the checklist; production-only choices are clearly marked; rollback and reconciliation checks are included; Person A verifies all technical steps.",
            "depends": "PAY-01 through INT-01.",
        },
    ]

    doc.add_page_break()
    doc.add_heading("3. Ticket backlog", level=1)
    p = doc.add_paragraph()
    set_run(p.add_run("Priority guide: "), bold=True, color=NAVY)
    p.add_run("start FIN-01, PAY-01, BOOK-01, and SHOP-01 in parallel. QA-01 starts immediately with draft cases and continues throughout delivery.")
    for ticket in tickets:
        add_ticket(doc, ticket)

    doc.add_heading("4. Dependency and merge sequence", level=1)
    add_merge_sequence(doc)

    doc.add_heading("5. File and ownership guardrails", level=1)
    guardrails = [
        ("Person A", "supabase/migrations for finance/shop schema; shared domain types; payment provider/server routes; finance services/repositories; billing and payment integration files."),
        ("Person B", "booking pages and booking components; focused booking UI helpers/tests. Avoid finance migrations and provider code."),
        ("Person C", "new shop pages/components and shop-only tests/fixtures. Ask Person A to add shared schema or finance contracts."),
        ("Person D", "QA plans, test reports, release docs, approved seed/test fixtures, and non-production test automation. Avoid application behaviour changes inside QA pull requests."),
    ]
    for owner, boundary in guardrails:
        p = doc.add_paragraph()
        p.paragraph_format.space_after = Pt(5)
        set_run(p.add_run(owner + ": "), bold=True, color=NAVY)
        set_run(p.add_run(boundary), color=BLACK)

    add_callout(
        doc,
        "SHARED-FILE RULE",
        "If two tickets need the same file, Person A defines the interface first. The feature owner then consumes that interface. Keep formatting-only changes and broad refactors out of feature branches because they create avoidable merge conflicts.",
        fill=PALE_BLUE,
        accent=BLUE,
    )

    doc.add_heading("6. Pull request checklist", level=1)
    checklist = [
        "Ticket ID and scope are in the pull request title/description.",
        "The branch changes only its agreed ownership area, or shared-file changes were pre-agreed.",
        "Tests cover the acceptance criteria and failure states.",
        "UI changes include desktop and mobile screenshots.",
        "Database changes include migration notes, RLS/security tests, and rollback considerations.",
        "No secrets, real credentials, or sensitive payment data are committed or logged.",
        "The latest main branch has been integrated and conflicts are already resolved.",
        "Person A reviews payment, invoice, security, and shared-contract changes.",
        "Person D records final test evidence and release status.",
    ]
    for item in checklist:
        p = doc.add_paragraph(style="List Bullet")
        set_run(p.add_run("[ ]  " + item), size=10)

    doc.add_heading("7. Decisions to confirm before implementation", level=1)
    decisions = [
        "Which provider will be used: Peach Payments or Payfast?",
        "Are payments collected per invoice, per shop order, per booking, or through a combined checkout?",
        "Are partial payments, refunds, credit notes, recurring payments, or saved payment methods required?",
        "When is a booking charge finalized and when is an invoice issued?",
        "How are cancellations, no-shows, stock changes, and failed payments handled?",
        "Is VAT applicable, and what information must appear on invoices and receipts?",
        "How are physical shop orders fulfilled: collection, delivery, or both?",
        "Who receives payment and order notifications, and which email service is approved?",
    ]
    for item in decisions:
        p = doc.add_paragraph(style="List Bullet")
        p.add_run(item)

    add_callout(
        doc,
        "DEFINITION OF RELEASE-READY",
        "All critical journeys pass; payment callbacks are verified and idempotent; invoices, payments, and receipts reconcile; dependant financial privacy remains enforced; no P0/P1 defects remain; the production configuration and rollback checklist have been reviewed by Person A and executed by someone other than the author.",
        fill=PALE_TEAL,
        accent=TEAL,
    )

    doc.core_properties.title = "CFA Platform Team Delivery Ticket Plan"
    doc.core_properties.subject = "Team work allocation, tickets, branch strategy, dependencies, and merge plan"
    doc.core_properties.keywords = "CFA, tickets, booking, shop, payments, invoicing, branches"
    doc.core_properties.author = ""
    doc.core_properties.last_modified_by = ""
    doc.save(OUT)
    print(OUT.resolve())


if __name__ == "__main__":
    main()
