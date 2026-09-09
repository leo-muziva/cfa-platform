from docx import Document
from docx.enum.section import WD_SECTION
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT, WD_CELL_VERTICAL_ALIGNMENT
from docx.shared import Inches, Pt, RGBColor
from docx.oxml import OxmlElement
from docx.oxml.ns import qn


OUT = "CFA-platform-system-overview-prompt.docx"


def shade(cell, fill):
    tc_pr = cell._tc.get_or_add_tcPr()
    shd = OxmlElement("w:shd")
    shd.set(qn("w:fill"), fill)
    tc_pr.append(shd)


def set_cell_margins(cell, top=100, start=120, bottom=100, end=120):
    tc = cell._tc
    tc_pr = tc.get_or_add_tcPr()
    tc_mar = tc_pr.first_child_found_in("w:tcMar")
    if tc_mar is None:
        tc_mar = OxmlElement("w:tcMar")
        tc_pr.append(tc_mar)
    for m, v in (("top", top), ("start", start), ("bottom", bottom), ("end", end)):
        node = tc_mar.find(qn(f"w:{m}"))
        if node is None:
            node = OxmlElement(f"w:{m}")
            tc_mar.append(node)
        node.set(qn("w:w"), str(v))
        node.set(qn("w:type"), "dxa")


def set_cell_text(cell, text, bold=False, color="1F2937", size=9.5):
    cell.text = ""
    p = cell.paragraphs[0]
    p.paragraph_format.space_after = Pt(0)
    run = p.add_run(text)
    run.bold = bold
    run.font.name = "Aptos"
    run.font.size = Pt(size)
    run.font.color.rgb = RGBColor.from_string(color)
    cell.vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.CENTER
    set_cell_margins(cell)


def add_bullet(doc, text):
    p = doc.add_paragraph(style="List Bullet")
    p.paragraph_format.space_after = Pt(3)
    p.add_run(text)
    return p


def add_number(doc, text):
    p = doc.add_paragraph(style="List Number")
    p.paragraph_format.space_after = Pt(4)
    p.add_run(text)
    return p


doc = Document()
section = doc.sections[0]
section.top_margin = Inches(0.8)
section.bottom_margin = Inches(0.75)
section.left_margin = Inches(0.85)
section.right_margin = Inches(0.85)

styles = doc.styles
normal = styles["Normal"]
normal.font.name = "Aptos"
normal.font.size = Pt(10.5)
normal.font.color.rgb = RGBColor(31, 41, 55)
normal.paragraph_format.space_after = Pt(7)
normal.paragraph_format.line_spacing = 1.08
for name, size, color in (("Title", 25, "12304A"), ("Heading 1", 16, "12304A"), ("Heading 2", 12, "007C83")):
    style = styles[name]
    style.font.name = "Aptos Display" if name != "Heading 2" else "Aptos"
    style.font.size = Pt(size)
    style.font.bold = True
    style.font.color.rgb = RGBColor.from_string(color)
    style.paragraph_format.space_before = Pt(12 if name != "Title" else 0)
    style.paragraph_format.space_after = Pt(6)

title = doc.add_paragraph(style="Title")
title.add_run("CFA Platform System Overview Prompt")
title.alignment = WD_ALIGN_PARAGRAPH.LEFT
sub = doc.add_paragraph()
sub.paragraph_format.space_after = Pt(16)
r = sub.add_run("Reusable instructions for another AI to explain the project in plain language")
r.italic = True
r.font.color.rgb = RGBColor(0, 124, 131)

callout = doc.add_table(rows=1, cols=1)
callout.alignment = WD_TABLE_ALIGNMENT.LEFT
cell = callout.cell(0, 0)
shade(cell, "E8F3F3")
set_cell_text(cell, "Goal: produce a business-level explanation of how the CFA platform works, what it is intended to do, what is implemented, what is verified, and what remains incomplete. Do not lead with the technology stack or file structure.", bold=True, color="12304A", size=10)

doc.add_heading("Copy and paste this prompt", level=1)
prompt = (
    "You are reviewing the Cape Fencing Academy (CFA) platform. Explain the whole system to a non-technical stakeholder who understands the club's operations but struggles to see how the pieces fit together.\n\n"
    "Start with a short one-paragraph summary of what the platform is for. Then explain the system as a set of connected journeys: public visitor, account holder, member applicant, guardian/dependent family, lesson participant, payer, and administrator. For each journey, explain what the person is trying to do, what the platform records or decides, and how the journey connects to the next one.\n\n"
    "Describe the intended operating model in plain language. Make clear that each person has a separate account; a guardian-dependent link connects accounts without merging them; the person attending a lesson is the participant whose eligibility matters; and the person responsible for charges may be different from the person booking or attending. Explain why those distinctions matter for privacy, membership access, booking rules, and billing.\n\n"
    "Use the project's scope specification, project audit/guide, route inventory, service/action code, database migrations, seed data, QA reports, and open sponsor questions as evidence. Reconcile contradictions instead of silently choosing one source. Distinguish carefully between: (1) intended by the scope, (2) present in the code, (3) previously verified by QA, (4) currently verified, and (5) placeholder or blocked by an open decision. Never call a feature complete merely because a page or function exists.\n\n"
    "Include a section titled 'What the system does today' and another titled 'What the system is supposed to do overall'. Then include a practical scope audit with three groups: 'Already present and evidenced', 'Present in code but still needing a fresh end-to-end check', and 'Not complete, placeholder, or awaiting a decision'. Mention the evidence date where relevant.\n\n"
    "Cover at least these business areas: public information and contact; authentication and account creation; personal profiles and onboarding; membership applications and staff review; family account linking; lesson creation and booking; participant-based eligibility; household billing; invoices, payments, and receipts; privacy boundaries; and administrator operations.\n\n"
    "Call out important gaps plainly, including real payment-provider integration, final privacy and terms wording, notification decisions, membership lifecycle rules, the requirement that dependents create their own accounts before a guardian can request a link, sponsor confirmation of prices/content, and any unresolved QA issue. State which gaps are implementation work versus decisions that CFA must make first.\n\n"
    "End with a concise 'How to explain it in one minute' summary and a short list of the next decisions or verification activities needed before the platform can be called complete. Keep the tone calm, clear, and useful. Avoid jargon, code-level detail, and unsupported assumptions."
)
for block in prompt.split("\n\n"):
    p = doc.add_paragraph()
    p.paragraph_format.left_indent = Inches(0.15)
    p.paragraph_format.right_indent = Inches(0.15)
    p.paragraph_format.space_after = Pt(6)
    p.add_run(block)

doc.add_heading("Required output structure", level=1)
for item in [
    "Executive summary: what the CFA platform is and why it exists.",
    "How the system works as connected user journeys.",
    "What the system does today.",
    "What the system is supposed to do overall.",
    "What is present and evidenced.",
    "What is implemented but needs fresh verification.",
    "What is incomplete, placeholder, or waiting for a CFA decision.",
    "One-minute explanation for a non-technical stakeholder.",
    "Recommended next decisions and verification steps.",
]:
    add_number(doc, item)

doc.add_heading("Status language to use", level=1)
table = doc.add_table(rows=1, cols=2)
table.alignment = WD_TABLE_ALIGNMENT.LEFT
table.autofit = False
table.columns[0].width = Inches(2.0)
table.columns[1].width = Inches(4.8)
for i, h in enumerate(("Status", "Meaning")):
    set_cell_text(table.rows[0].cells[i], h, bold=True, color="FFFFFF", size=9.5)
    shade(table.rows[0].cells[i], "12304A")
for status, meaning in [
    ("Intended", "Required by the agreed business scope, whether or not it is built yet."),
    ("Implemented", "A route, workflow, or supporting logic exists in the project."),
    ("Previously verified", "A real QA run passed it on an earlier date; it has not necessarily been retested after later changes."),
    ("Currently verified", "A recent test or live check passed it against the current project state."),
    ("Needs verification", "The code appears to support it, but current end-to-end evidence is missing."),
    ("Placeholder/open decision", "It is intentionally incomplete or cannot be finalized until CFA supplies policy, content, or provider choices."),
]:
    cells = table.add_row().cells
    set_cell_text(cells[0], status, bold=True, color="007C83")
    set_cell_text(cells[1], meaning)
    if len(table.rows) % 2 == 0:
        shade(cells[0], "F2F7F7")
        shade(cells[1], "F2F7F7")

doc.add_heading("Evidence rules", level=1)
for item in [
    "Prefer the formal scope specification for intended behavior and the QA records for verified behavior.",
    "Treat source-code presence as implementation evidence, not proof that the full user journey works.",
    "Separate technical defects from missing business decisions.",
    "Identify privacy and billing boundaries explicitly, especially for dependents and guardians.",
    "Use dates when describing QA evidence and say when a fresh browser pass was not possible.",
    "Do not inspect, quote, or expose secret environment files.",
]:
    add_bullet(doc, item)

doc.add_heading("Reference files in this repository", level=1)
for item in [
    "docs/spec update/CFA_Platform_Account_Membership_Family_Billing_Specification.md - intended business scope and acceptance criteria.",
    "docs/CFA_PROJECT_AUDIT_AND_BEGINNER_GUIDE.md - current route inventory, implementation summary, and evidence caveats.",
    "PROJECT-EXPLAINER.md - broader project context and rationale.",
    "docs/qa/ - manual test plans, QA runs, and bug reports.",
    "SPONSOR-QUESTIONS.md - decisions that CFA has not yet finalized.",
]:
    add_bullet(doc, item)

footer = section.footer.paragraphs[0]
footer.alignment = WD_ALIGN_PARAGRAPH.CENTER
fr = footer.add_run("CFA Platform | Reusable explanation prompt")
fr.font.name = "Aptos"
fr.font.size = Pt(8)
fr.font.color.rgb = RGBColor(100, 116, 139)

doc.save(OUT)
print(OUT)
