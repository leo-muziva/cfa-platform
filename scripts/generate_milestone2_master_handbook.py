from __future__ import annotations

import math
import os
import textwrap
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont
from docx import Document
from docx.enum.section import WD_ORIENT, WD_SECTION_START
from docx.enum.table import WD_CELL_VERTICAL_ALIGNMENT, WD_TABLE_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Cm, Inches, Pt, RGBColor


ROOT = Path(__file__).resolve().parents[1]
BUILD_DIR = ROOT / "tmp" / "milestone2-handbook"
DIAGRAM_DIR = BUILD_DIR / "diagrams"
OUT = BUILD_DIR / "CFA_Milestone_2_Group_Master_Handbook.docx"

NAVY = "25145C"
PURPLE = "2D176B"
TEAL = "007C83"
GOLD = "D2A800"
YELLOW = "FFD21C"
INK = "243447"
MUTED = "625B73"
PALE = "F4F1FA"
PALE_TEAL = "E8F3F3"
PALE_GOLD = "FFF8E0"
WHITE = "FFFFFF"
RED = "B42318"
GREEN = "18794E"
BLUE = "2E74B5"

PAGE_WIDTH_DXA = 9600
LANDSCAPE_WIDTH_DXA = 14400


def rgb(hex_value: str) -> RGBColor:
    return RGBColor.from_string(hex_value)


def font_path(bold: bool = False) -> str:
    candidates = [
        r"C:\Windows\Fonts\arialbd.ttf" if bold else r"C:\Windows\Fonts\arial.ttf",
        r"C:\Windows\Fonts\calibrib.ttf" if bold else r"C:\Windows\Fonts\calibri.ttf",
    ]
    for candidate in candidates:
        if Path(candidate).exists():
            return candidate
    raise FileNotFoundError("No suitable diagram font found")


def img_font(size: int, bold: bool = False):
    return ImageFont.truetype(font_path(bold), size=size)


def set_run_font(run, name="Calibri", size=None, color=None, bold=None, italic=None):
    run.font.name = name
    run._element.get_or_add_rPr().get_or_add_rFonts().set(qn("w:ascii"), name)
    run._element.get_or_add_rPr().get_or_add_rFonts().set(qn("w:hAnsi"), name)
    if size is not None:
        run.font.size = Pt(size)
    if color is not None:
        run.font.color.rgb = rgb(color)
    if bold is not None:
        run.bold = bold
    if italic is not None:
        run.italic = italic


def shade_cell(cell, fill: str):
    tc_pr = cell._tc.get_or_add_tcPr()
    shd = tc_pr.find(qn("w:shd"))
    if shd is None:
        shd = OxmlElement("w:shd")
        tc_pr.append(shd)
    shd.set(qn("w:fill"), fill)


def set_cell_margins(cell, top=80, start=120, bottom=80, end=120):
    tc_pr = cell._tc.get_or_add_tcPr()
    tc_mar = tc_pr.find(qn("w:tcMar"))
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


def set_table_geometry(table, widths_dxa, total_dxa=None, indent_dxa=120):
    total_dxa = total_dxa or sum(widths_dxa)
    table.autofit = False
    tbl_pr = table._tbl.tblPr
    tbl_w = tbl_pr.find(qn("w:tblW"))
    if tbl_w is None:
        tbl_w = OxmlElement("w:tblW")
        tbl_pr.append(tbl_w)
    tbl_w.set(qn("w:w"), str(total_dxa))
    tbl_w.set(qn("w:type"), "dxa")
    tbl_ind = tbl_pr.find(qn("w:tblInd"))
    if tbl_ind is None:
        tbl_ind = OxmlElement("w:tblInd")
        tbl_pr.append(tbl_ind)
    tbl_ind.set(qn("w:w"), str(indent_dxa))
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
            width = widths_dxa[min(idx, len(widths_dxa) - 1)]
            tc_pr = cell._tc.get_or_add_tcPr()
            tc_w = tc_pr.find(qn("w:tcW"))
            if tc_w is None:
                tc_w = OxmlElement("w:tcW")
                tc_pr.append(tc_w)
            tc_w.set(qn("w:w"), str(width))
            tc_w.set(qn("w:type"), "dxa")
            set_cell_margins(cell)
            cell.vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.CENTER


def set_repeat_table_header(row):
    tr_pr = row._tr.get_or_add_trPr()
    tbl_header = OxmlElement("w:tblHeader")
    tbl_header.set(qn("w:val"), "true")
    tr_pr.append(tbl_header)


def set_cell_text(cell, text, bold=False, color=INK, size=8.5, align=WD_ALIGN_PARAGRAPH.LEFT):
    cell.text = ""
    p = cell.paragraphs[0]
    p.alignment = align
    p.paragraph_format.space_before = Pt(0)
    p.paragraph_format.space_after = Pt(0)
    p.paragraph_format.line_spacing = 1.05
    r = p.add_run(str(text))
    set_run_font(r, size=size, color=color, bold=bold)


def add_table(doc, headers, rows, widths, font_size=8.3, header_fill=NAVY, landscape=False):
    table = doc.add_table(rows=1, cols=len(headers))
    table.alignment = WD_TABLE_ALIGNMENT.LEFT
    total = LANDSCAPE_WIDTH_DXA if landscape else PAGE_WIDTH_DXA
    set_table_geometry(table, widths, total_dxa=total)
    set_repeat_table_header(table.rows[0])
    for i, header in enumerate(headers):
        set_cell_text(table.rows[0].cells[i], header, bold=True, color=WHITE, size=font_size)
        shade_cell(table.rows[0].cells[i], header_fill)
    for row_index, values in enumerate(rows):
        cells = table.add_row().cells
        for i, value in enumerate(values):
            set_cell_text(cells[i], value, bold=(i == 0), color=INK, size=font_size)
            if row_index % 2:
                shade_cell(cells[i], "F8F9FB")
    doc.add_paragraph().paragraph_format.space_after = Pt(1)
    return table


def add_bullet(doc, text, level=0):
    style = "List Bullet" if level == 0 else "List Bullet 2"
    p = doc.add_paragraph(style=style)
    p.paragraph_format.space_after = Pt(4)
    p.paragraph_format.line_spacing = 1.25
    p.add_run(text)
    return p


def add_number(doc, text, level=0):
    style = "List Number" if level == 0 else "List Number 2"
    p = doc.add_paragraph(style=style)
    p.paragraph_format.space_after = Pt(4)
    p.paragraph_format.line_spacing = 1.25
    p.add_run(text)
    return p


def add_para(doc, text="", bold_prefix=None, italic=False, color=INK, align=None, after=6):
    p = doc.add_paragraph()
    p.paragraph_format.space_after = Pt(after)
    p.paragraph_format.line_spacing = 1.25
    if align is not None:
        p.alignment = align
    if bold_prefix and text.startswith(bold_prefix):
        r = p.add_run(bold_prefix)
        r.bold = True
        p.add_run(text[len(bold_prefix):])
    else:
        r = p.add_run(text)
        r.italic = italic
        r.font.color.rgb = rgb(color)
    return p


def add_callout(doc, title, body, fill=PALE_TEAL, accent=TEAL):
    table = doc.add_table(rows=1, cols=1)
    table.alignment = WD_TABLE_ALIGNMENT.LEFT
    set_table_geometry(table, [PAGE_WIDTH_DXA], total_dxa=PAGE_WIDTH_DXA)
    cell = table.cell(0, 0)
    shade_cell(cell, fill)
    set_cell_margins(cell, top=140, start=180, bottom=140, end=180)
    cell.text = ""
    p = cell.paragraphs[0]
    p.paragraph_format.space_after = Pt(3)
    r = p.add_run(title)
    set_run_font(r, size=10.5, color=accent, bold=True)
    p2 = cell.add_paragraph()
    p2.paragraph_format.space_after = Pt(0)
    p2.paragraph_format.line_spacing = 1.18
    r2 = p2.add_run(body)
    set_run_font(r2, size=9.5, color=INK)
    doc.add_paragraph().paragraph_format.space_after = Pt(1)
    return table


def add_caption(doc, number, title):
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.paragraph_format.space_before = Pt(4)
    p.paragraph_format.space_after = Pt(8)
    r = p.add_run(f"Figure {number}: {title}")
    set_run_font(r, size=9, color=MUTED, italic=True)
    return p


def add_diagram(doc, path, number, title, width=Inches(6.45)):
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.paragraph_format.keep_with_next = True
    p.add_run().add_picture(str(path), width=width)
    add_caption(doc, number, title)


def add_code_block(doc, text):
    table = doc.add_table(rows=1, cols=1)
    table.alignment = WD_TABLE_ALIGNMENT.LEFT
    set_table_geometry(table, [PAGE_WIDTH_DXA], total_dxa=PAGE_WIDTH_DXA)
    cell = table.cell(0, 0)
    shade_cell(cell, "F3F4F6")
    set_cell_margins(cell, top=110, start=140, bottom=110, end=140)
    cell.text = ""
    p = cell.paragraphs[0]
    p.paragraph_format.space_after = Pt(0)
    p.paragraph_format.line_spacing = 1.0
    r = p.add_run(text)
    set_run_font(r, name="Consolas", size=7.2, color=INK)
    doc.add_paragraph().paragraph_format.space_after = Pt(1)


def add_toc(doc):
    p = doc.add_paragraph()
    run = p.add_run()
    fld_char = OxmlElement("w:fldChar")
    fld_char.set(qn("w:fldCharType"), "begin")
    instr = OxmlElement("w:instrText")
    instr.set(qn("xml:space"), "preserve")
    instr.text = ' TOC \\o "1-3" \\h \\z \\u '
    separate = OxmlElement("w:fldChar")
    separate.set(qn("w:fldCharType"), "separate")
    placeholder = OxmlElement("w:t")
    placeholder.text = "Right-click and choose Update Field if the contents list is not populated."
    end = OxmlElement("w:fldChar")
    end.set(qn("w:fldCharType"), "end")
    run._r.extend([fld_char, instr, separate, placeholder, end])


def add_page_field(paragraph):
    run = paragraph.add_run()
    begin = OxmlElement("w:fldChar")
    begin.set(qn("w:fldCharType"), "begin")
    instr = OxmlElement("w:instrText")
    instr.set(qn("xml:space"), "preserve")
    instr.text = " PAGE "
    end = OxmlElement("w:fldChar")
    end.set(qn("w:fldCharType"), "end")
    run._r.extend([begin, instr, end])


def add_landscape_section(doc):
    section = doc.add_section(WD_SECTION_START.NEW_PAGE)
    section.orientation = WD_ORIENT.LANDSCAPE
    section.page_width, section.page_height = Cm(29.7), Cm(21.0)
    section.left_margin = Cm(1.5)
    section.right_margin = Cm(1.5)
    section.top_margin = Cm(1.6)
    section.bottom_margin = Cm(1.6)
    return section


def add_portrait_section(doc):
    section = doc.add_section(WD_SECTION_START.NEW_PAGE)
    section.orientation = WD_ORIENT.PORTRAIT
    section.page_width, section.page_height = Cm(21.0), Cm(29.7)
    section.left_margin = Cm(1.8)
    section.right_margin = Cm(1.8)
    section.top_margin = Cm(1.8)
    section.bottom_margin = Cm(1.8)
    return section


def wrap_lines(text: str, width: int):
    return textwrap.wrap(text, width=width, break_long_words=False) or [""]


def draw_text_center(draw, box, text, font, fill="#243447", line_gap=6):
    x1, y1, x2, y2 = box
    lines = wrap_lines(text, max(12, int((x2 - x1) / max(12, font.size * 0.58))))
    heights = []
    for line in lines:
        bb = draw.textbbox((0, 0), line, font=font)
        heights.append(bb[3] - bb[1])
    total = sum(heights) + line_gap * (len(lines) - 1)
    y = y1 + (y2 - y1 - total) / 2
    for line, height in zip(lines, heights):
        bb = draw.textbbox((0, 0), line, font=font)
        width_px = bb[2] - bb[0]
        draw.text((x1 + (x2 - x1 - width_px) / 2, y), line, font=font, fill=fill)
        y += height + line_gap


def arrow(draw, start, end, color="#625B73", width=5, dashed=False):
    x1, y1 = start
    x2, y2 = end
    if dashed:
        pieces = 14
        for i in range(0, pieces, 2):
            a = i / pieces
            b = min((i + 1) / pieces, 1)
            draw.line((x1 + (x2 - x1) * a, y1 + (y2 - y1) * a, x1 + (x2 - x1) * b, y1 + (y2 - y1) * b), fill=color, width=width)
    else:
        draw.line((x1, y1, x2, y2), fill=color, width=width)
    angle = math.atan2(y2 - y1, x2 - x1)
    head = 18
    pts = [
        (x2, y2),
        (x2 - head * math.cos(angle - 0.5), y2 - head * math.sin(angle - 0.5)),
        (x2 - head * math.cos(angle + 0.5), y2 - head * math.sin(angle + 0.5)),
    ]
    draw.polygon(pts, fill=color)


def new_canvas(title, subtitle="", width=2000, height=1200):
    im = Image.new("RGB", (width, height), "white")
    draw = ImageDraw.Draw(im)
    draw.rectangle((0, 0, width, 110), fill="#25145C")
    draw.text((55, 24), title, font=img_font(52, True), fill="white")
    if subtitle:
        draw.text((58, 82), subtitle, font=img_font(23), fill="#F5D95B")
    return im, draw


def box(draw, xy, text, fill="#F4F1FA", outline="#2D176B", font_size=28, radius=18, bold=False):
    draw.rounded_rectangle(xy, radius=radius, fill=fill, outline=outline, width=4)
    draw_text_center(draw, xy, text, img_font(font_size, bold), fill="#243447")


def save_image(im, name):
    path = DIAGRAM_DIR / f"{name}.png"
    im.save(path, dpi=(180, 180))
    return path


def draw_capability_axes():
    im, d = new_canvas("One account, four independent dimensions", "Do not model these as one mutually exclusive role list")
    rows = [
        ("Identity", "Public visitor  ->  Authenticated account", "Can the system identify the person?"),
        ("Membership", "Guest  ->  Active / Suspended / Expired / Cancelled", "What membership access does this person have?"),
        ("Household", "Independent  |  Guardian / Payer  |  Dependent", "Whose family and billing relationship applies?"),
        ("Staff", "Non-staff  |  Coach  |  Administrator", "What operational authority does this person have?"),
    ]
    y = 175
    for label, values, question in rows:
        box(d, (80, y, 400, y + 175), label, fill="#25145C", outline="#25145C", font_size=34, bold=True)
        draw_text_center(d, (80, y, 400, y + 175), label, img_font(34, True), fill="white")
        box(d, (445, y, 1310, y + 175), values, fill="#F4F1FA", font_size=30)
        box(d, (1350, y, 1915, y + 175), question, fill="#FFF8E0", outline="#D2A800", font_size=25)
        y += 225
    return save_image(im, "01-capability-axes")


def draw_package_diagram():
    im, d = new_canvas("CFA medium-level package diagram", "Logical subsystems and external dependencies")
    packages = {
        "Public Experience": (80, 180, 510, 340),
        "Identity & Profile": (620, 180, 1050, 340),
        "Membership": (1160, 180, 1590, 340),
        "Family & Household": (80, 500, 510, 660),
        "Lesson Scheduling & Booking": (620, 500, 1050, 660),
        "Billing & Payments": (1160, 500, 1590, 660),
        "Administration & Audit": (620, 805, 1050, 965),
    }
    for name, xy in packages.items():
        box(d, xy, name, fill="#F4F1FA", font_size=31, bold=True)
        d.rectangle((xy[0], xy[1], xy[0] + 105, xy[1] + 28), fill="#D2A800")
    centers = {k: ((v[0] + v[2]) // 2, (v[1] + v[3]) // 2) for k, v in packages.items()}
    deps = [
        ("Public Experience", "Identity & Profile"),
        ("Membership", "Identity & Profile"),
        ("Family & Household", "Identity & Profile"),
        ("Lesson Scheduling & Booking", "Membership"),
        ("Lesson Scheduling & Booking", "Family & Household"),
        ("Billing & Payments", "Lesson Scheduling & Booking"),
        ("Billing & Payments", "Membership"),
        ("Administration & Audit", "Membership"),
        ("Administration & Audit", "Family & Household"),
        ("Administration & Audit", "Lesson Scheduling & Booking"),
        ("Administration & Audit", "Billing & Payments"),
    ]
    for source, target in deps:
        arrow(d, centers[source], centers[target], color="#8B7CA8", width=3, dashed=True)
    ext = [
        ("Supabase Auth", (1660, 160, 1940, 285)),
        ("PostgreSQL Database", (1660, 330, 1940, 455)),
        ("Email / Inbucket", (1660, 500, 1940, 625)),
        ("Google OAuth", (1660, 670, 1940, 795)),
        ("Payment Provider\n(planned)", (1660, 840, 1940, 965)),
    ]
    for name, xy in ext:
        box(d, xy, name, fill="#E8F3F3", outline="#007C83", font_size=24)
    arrow(d, (1050, 250), (1660, 220), color="#007C83", width=4)
    arrow(d, (1590, 260), (1660, 392), color="#007C83", width=4)
    arrow(d, (1050, 260), (1660, 562), color="#007C83", width=4)
    arrow(d, (1050, 260), (1660, 732), color="#007C83", width=4)
    arrow(d, (1590, 580), (1660, 902), color="#007C83", width=4, dashed=True)
    return save_image(im, "02-package-diagram")


def draw_activity_diagram():
    im, d = new_canvas("Whole-platform To-Be activity diagram", "Business process only; technical layers are intentionally omitted", width=2400, height=1550)
    lanes = ["Visitor / Account", "Guardian / Dependent", "CFA Admin / Coach", "CFA Platform", "External Services"]
    lane_w = 460
    for i, lane in enumerate(lanes):
        x1 = 50 + i * lane_w
        d.rectangle((x1, 135, x1 + lane_w, 1495), outline="#B5ADC5", width=3, fill="#FFFFFF" if i % 2 == 0 else "#FAF9FD")
        d.rectangle((x1, 135, x1 + lane_w, 200), fill="#2D176B")
        draw_text_center(d, (x1, 135, x1 + lane_w, 200), lane, img_font(24, True), fill="white")
    nodes = {
        "start": (80, 245, 420, 330, "Browse CFA information and lesson availability"),
        "authq": (105, 385, 395, 500, "Account-required action?"),
        "auth": (80, 565, 420, 650, "Create account or sign in"),
        "profile": (80, 720, 420, 805, "Complete or update profile"),
        "membership": (80, 875, 420, 960, "Apply for membership if desired"),
        "family": (540, 720, 880, 805, "Request or respond to family link"),
        "participant": (540, 1030, 880, 1115, "Choose self or linked dependent"),
        "slots": (1000, 245, 1340, 330, "Create future lesson slots"),
        "review": (1000, 875, 1340, 960, "Review membership application"),
        "book": (1460, 1030, 1800, 1115, "Validate participant eligibility and capacity"),
        "charge": (1460, 1190, 1800, 1275, "Create booking and route charge"),
        "invoice": (1000, 1340, 1340, 1425, "Generate invoice / record payment"),
        "external_auth": (1920, 565, 2260, 650, "Confirm identity / deliver email"),
        "external_pay": (1920, 1340, 2260, 1425, "Process payment when configured"),
    }
    for key, (x1, y1, x2, y2, text) in nodes.items():
        fill = "#FFF8E0" if key in {"authq"} else "#E8F3F3" if key.startswith("external") else "#F4F1FA"
        outline = "#D2A800" if key == "authq" else "#007C83" if key.startswith("external") else "#2D176B"
        box(d, (x1, y1, x2, y2), text, fill=fill, outline=outline, font_size=23)
    d.ellipse((215, 215, 285, 285), fill="#243447")
    d.ellipse((1125, 1460, 1195, 1530), fill="white", outline="#243447", width=5)
    d.ellipse((1140, 1475, 1180, 1515), fill="#243447")
    flows = [
        ((250, 285), (250, 385)), ((250, 500), (250, 565)), ((250, 650), (250, 720)),
        ((250, 805), (250, 875)), ((420, 762), (540, 762)), ((710, 805), (710, 1030)),
        ((1340, 287), (1630, 1030)), ((880, 1072), (1460, 1072)), ((1630, 1115), (1630, 1190)),
        ((1460, 1232), (1340, 1382)), ((1170, 1425), (1160, 1460)), ((420, 607), (1920, 607)),
        ((1340, 1382), (1920, 1382)), ((1170, 960), (1630, 1030)), ((250, 960), (710, 1030)),
    ]
    for start, end in flows:
        arrow(d, start, end, color="#625B73", width=4)
    d.text((405, 510), "Yes", font=img_font(22, True), fill="#B42318")
    d.text((400, 395), "No: continue browsing", font=img_font(21, True), fill="#18794E")
    d.text((1750, 990), "[eligible and space available]", font=img_font(19), fill="#18794E")
    d.text((1480, 1125), "[ineligible or full] block with reason", font=img_font(19), fill="#B42318")
    return save_image(im, "03-activity-diagram")


def draw_use_case_diagram(key, title, primary, secondary, cases, relations):
    im, d = new_canvas(title, "Primary actors left; secondary actors and external systems right")
    d.rounded_rectangle((420, 155, 1580, 1100), radius=25, outline="#2D176B", width=5, fill="#FAF9FD")
    d.text((455, 175), "CFA Platform", font=img_font(28, True), fill="#2D176B")
    actor_y = 300
    for actor in primary:
        box(d, (40, actor_y, 360, actor_y + 120), actor, fill="#E8F3F3", outline="#007C83", font_size=25)
        actor_y += 210
    actor_y = 300
    for actor in secondary:
        box(d, (1640, actor_y, 1960, actor_y + 120), actor, fill="#FFF8E0", outline="#D2A800", font_size=24)
        actor_y += 210
    case_positions = []
    cols = 2
    for idx, (uc_id, name) in enumerate(cases):
        col = idx % cols
        row = idx // cols
        x1 = 510 + col * 520
        y1 = 255 + row * 185
        xy = (x1, y1, x1 + 420, y1 + 110)
        d.ellipse(xy, fill="#FFFFFF", outline="#2D176B", width=4)
        draw_text_center(d, xy, f"{uc_id}\n{name}", img_font(23), fill="#243447")
        case_positions.append(((x1 + x1 + 420) // 2, (y1 + y1 + 110) // 2))
    for actor_idx, case_idx, side in relations:
        if side == "L":
            start = (360, 360 + actor_idx * 210)
        else:
            start = (1640, 360 + actor_idx * 210)
        end = case_positions[case_idx]
        arrow(d, start, end, color="#8B7CA8", width=3)
    return save_image(im, f"usecase-{key}")


def draw_sequence_diagram(key, title, participants, messages):
    height = max(1200, 250 + len(messages) * 95)
    im, d = new_canvas(title, "Messages follow the matching use-case narrative", width=2200, height=height)
    margin = 80
    usable = 2040
    gap = usable / max(1, len(participants) - 1)
    xs = []
    for idx, participant in enumerate(participants):
        x = margin + idx * gap
        xs.append(x)
        xy = (x - 125, 160, x + 125, 250)
        fill = "#E8F3F3" if "UI" in participant or "Actor" in participant else "#FFF8E0" if "External" in participant or "Database" in participant else "#F4F1FA"
        box(d, xy, participant, fill=fill, font_size=20, bold=True)
        d.line((x, 250, x, height - 80), fill="#9B93AA", width=3)
    y = 320
    for src, dst, label, dashed in messages:
        x1, x2 = xs[src], xs[dst]
        arrow(d, (x1, y), (x2, y), color="#2D176B" if not dashed else "#625B73", width=3, dashed=dashed)
        tx1, tx2 = sorted((x1, x2))
        draw_text_center(d, (tx1 + 8, y - 55, tx2 - 8, y - 5), label, img_font(18), fill="#243447", line_gap=2)
        y += 95
    return save_image(im, f"sequence-{key}")


def draw_state_diagram(key, title, states, transitions):
    im, d = new_canvas(title, "State names are conditions; arrows are event [guard] / action")
    count = len(states)
    xs = [260 + i * (1450 / max(1, count - 1)) for i in range(count)]
    y = 600
    d.ellipse((80, y - 32, 144, y + 32), fill="#243447")
    arrow(d, (145, y), (xs[0] - 140, y), width=4)
    for x, state in zip(xs, states):
        box(d, (x - 140, y - 70, x + 140, y + 70), state, fill="#F4F1FA", font_size=25, bold=True)
    for src, dst, label in transitions:
        x1, x2 = xs[src], xs[dst]
        if dst >= src:
            yy = y - 115 - 70 * ((src + dst) % 3)
        else:
            yy = y + 115 + 70 * ((src + dst) % 3)
        d.line((x1, y - 70 if yy < y else y + 70, x1, yy), fill="#625B73", width=3)
        d.line((x1, yy, x2, yy), fill="#625B73", width=3)
        arrow(d, (x2, yy), (x2, y - 70 if yy < y else y + 70), width=3)
        draw_text_center(d, (min(x1, x2) + 10, yy - 48, max(x1, x2) - 10, yy - 5 if yy < y else yy + 48), label, img_font(18), fill="#243447")
    d.ellipse((1840, y - 42, 1924, y + 42), fill="white", outline="#243447", width=5)
    d.ellipse((1855, y - 27, 1909, y + 27), fill="#243447")
    arrow(d, (xs[-1] + 140, y), (1840, y), width=4)
    return save_image(im, f"state-{key}")


def draw_navigation(key, title, nodes, edges, restricted=None):
    restricted = restricted or set()
    im, d = new_canvas(title, "Solid: direct navigation | Dashed: redirect or conditional access", width=2200, height=1400)
    positions = {}
    rows = {}
    for node_id, label, row in nodes:
        rows.setdefault(row, []).append((node_id, label))
    for row, items in rows.items():
        gap = 2050 / (len(items) + 1)
        y = 220 + row * 230
        for i, (node_id, label) in enumerate(items, start=1):
            x = i * gap
            positions[node_id] = (x, y)
            fill = "#FFF8E0" if node_id in restricted else "#E8F3F3" if row == 0 else "#F4F1FA"
            outline = "#D2A800" if node_id in restricted else "#2D176B"
            box(d, (x - 150, y - 55, x + 150, y + 55), label, fill=fill, outline=outline, font_size=20)
    for src, dst, dashed, label in edges:
        x1, y1 = positions[src]
        x2, y2 = positions[dst]
        arrow(d, (x1, y1 + 58), (x2, y2 - 58), color="#625B73", width=3, dashed=dashed)
        if label:
            draw_text_center(d, ((x1 + x2) / 2 - 130, (y1 + y2) / 2 - 35, (x1 + x2) / 2 + 130, (y1 + y2) / 2 + 25), label, img_font(16), fill="#625B73")
    return save_image(im, f"navigation-{key}")


def draw_class_diagram():
    im, d = new_canvas("CFA medium-level analysis class diagram", "Logical domain classes; no foreign keys, framework managers, or database tables", width=2600, height=1900)
    classes = [
        ("Profile", ["fullName", "email", "membershipStatus", "staffType", "isActive"], 90, 190),
        ("MembershipType", ["name", "price", "termMonths", "joiningFee"], 520, 190),
        ("Membership", ["status", "startedAt", "statusChangedAt"], 950, 190),
        ("MembershipApplication", ["version", "status", "submittedDetails", "visibleResponse"], 1380, 190),
        ("AuditEvent", ["eventType", "metadata", "createdAt"], 1810, 190),
        ("Household", ["paymentPreference", "createdAt"], 90, 750),
        ("HouseholdMember", ["householdRole", "payerConsentAt"], 520, 750),
        ("FamilyLink", ["status", "requestedAt", "acceptedAt", "endedAt"], 950, 750),
        ("DependentBillingLink", ["effectiveFrom", "effectiveTo"], 1380, 750),
        ("LessonSlot", ["startsAt", "endsAt", "capacity", "price", "accessRule"], 90, 1310),
        ("Booking", ["paymentOption", "status", "createdAt"], 520, 1310),
        ("Charge", ["type", "amount", "status", "period"], 950, 1310),
        ("Invoice", ["invoiceNumber", "period", "status", "total"], 1380, 1310),
        ("InvoiceLine", ["description", "amount"], 1810, 1310),
        ("Receipt", ["receiptNumber", "amount", "issuedAt"], 2240, 1310),
    ]
    centers = {}
    for name, attrs, x, y in classes:
        w, h = 330, 260
        d.rectangle((x, y, x + w, y + h), fill="#FFFFFF", outline="#2D176B", width=4)
        d.rectangle((x, y, x + w, y + 62), fill="#2D176B")
        draw_text_center(d, (x, y, x + w, y + 62), name, img_font(24, True), fill="white")
        yy = y + 78
        for attr in attrs:
            d.text((x + 20, yy), attr, font=img_font(19), fill="#243447")
            yy += 38
        centers[name] = (x + w / 2, y + h / 2)
    relationships = [
        ("Profile", "Membership", "1     0..1"), ("MembershipType", "Membership", "1     0..*"),
        ("Profile", "MembershipApplication", "1 submits 0..*"), ("MembershipType", "MembershipApplication", "1 requested by 0..*"),
        ("Profile", "HouseholdMember", "1     0..*"), ("Household", "HouseholdMember", "1 composes 1..*"),
        ("Profile", "FamilyLink", "guardian/dependent"), ("FamilyLink", "DependentBillingLink", "1 activates 0..1"),
        ("LessonSlot", "Booking", "1     0..*"), ("Profile", "Booking", "booker / participant"),
        ("Booking", "Charge", "1 creates 0..1"), ("Charge", "InvoiceLine", "1 billed as 0..1"),
        ("Invoice", "InvoiceLine", "1 composes 1..*"), ("Invoice", "Receipt", "1 settles 0..*"),
        ("Profile", "AuditEvent", "actor / subject"),
    ]
    for a, b, label in relationships:
        x1, y1 = centers[a]
        x2, y2 = centers[b]
        arrow(d, (x1, y1), (x2, y2), color="#9B93AA", width=2)
        mx, my = (x1 + x2) / 2, (y1 + y2) / 2
        d.rectangle((mx - 95, my - 18, mx + 95, my + 18), fill="white")
        draw_text_center(d, (mx - 95, my - 18, mx + 95, my + 18), label, img_font(14), fill="#625B73")
    return save_image(im, "class-diagram")


RUBRIC_ROWS = [
    ("Project Definition Statement", "5", "Executive description, objectives, priorities, terms, deadline, budget, assumptions, related projects, legal/ethical issues.", "Agree the project boundary before writing. Keep objectives testable and do not promise unconfirmed providers."),
    ("Risk Matrix", "10", "Context-specific risks, rank, probability, impact, category, cause, trigger, owner, mitigation, contingency and status.", "Use CFA-specific triggers. Generic risks alone will lose marks."),
    ("To-Be Activity Diagram", "10", "Sequential business process with one start, valid ends, guards, merges, swimlanes and narrative.", "Show the business flow, not Next.js layers or code execution."),
    ("Medium-level Package Diagram", "10", "Logical subsystems, contained functionality, external packages and dependency direction.", "The database is external. Packages are business capabilities, not folders."),
    ("Use Case Diagrams", "10", "One diagram per subsystem, numbered use cases, primary/secondary actors, system boundary and valid relationships.", "Use verb-object names. Do not model claims, pages or database operations as sea-level use cases."),
    ("Use Case Narratives", "10", "At least five major narratives using the required template, typical and alternative courses.", "Every step must alternate clearly between actor action and system response."),
    ("Class Diagram", "10", "Analysis classes, attributes, associations, multiplicities and justified whole-part relationships.", "Use singular problem-domain classes. No foreign keys or framework manager classes."),
    ("Sequence Diagrams", "10", "One per selected narrative with actors, boundary/controller/entity objects, lifelines, messages, returns and fragments.", "Reuse class names from the class diagram and operation names from the narrative."),
    ("State Machine Diagrams", "10", "States of important objects, transitions, events, guards and start/end pseudostates.", "States are conditions, not a re-labelled activity sequence."),
    ("Website Navigation", "10", "All pages and navigation connections, access restrictions, complex page behaviour and legend.", "Separate public, account and admin views so the diagram stays readable."),
    ("Updated Task Board", "5", "Current board plus explanation of completed, delayed, moved and assigned work.", "A screenshot without narrative is not enough."),
    ("Portfolio of Evidence", "10", "Traceable evidence of elicitation, decisions, collaboration, changes, testing and progress.", "Use dated, named evidence and explain what each item proves."),
]


RISK_ROWS = [
    ("R01", "1", "Household or financial data exposure", "A dependent or unrelated account sees another person's private or billing information.", "Medium", "Major", "Security / POPIA", "Incorrect RLS or authorization rule", "A cross-account test returns data instead of Forbidden/not found", "Security & DB lead", "Keep RLS tests for every role and derive payer/participant server-side.", "Disable affected route, preserve logs, correct policy and retest all personas.", "Yellow"),
    ("R02", "2", "Scope and model divergence", "Team artifacts use different actors, entities, names or business boundaries.", "High", "Major", "Requirements / People", "Parallel work starts before shared scope is approved", "Same concept appears under two names or diagram IDs do not cross-reference", "Requirements lead", "Freeze glossary, IDs and traceability matrix before division of work.", "Pause integration, reconcile to the master registry and redraw affected artifacts.", "Red"),
    ("R03", "3", "Unconfirmed sponsor rules", "Membership, family, payment or cancellation choices are presented as facts without CFA approval.", "High", "Major", "Requirements", "Open decisions are silently hard-coded into documents", "Contradictory answers or sponsor rejects a workflow", "Sponsor liaison", "Maintain an open-decision register and label assumptions explicitly.", "Remove disputed behaviour from committed scope and revise connected diagrams.", "Red"),
    ("R04", "4", "Migration or RLS regression", "A database change breaks integrity, access isolation or seeded test scenarios.", "Medium", "Major", "System / Data", "Schema changes are made without full policy and migration tests", "Reset fails or authorization tests start failing", "Database lead", "Review migrations, run SQL invariant tests and keep changes reversible.", "Restore from migration history, patch forward and rerun the complete authorization matrix.", "Yellow"),
    ("R05", "5", "Local environment unavailable", "Docker or local Supabase prevents integration and browser testing.", "Medium", "Major", "Environment", "Docker Desktop/WSL engine or ports are unavailable", "Supabase start stalls or Docker server cannot be reached", "Environment lead", "Run environment checks early and keep a documented restart/port checklist.", "Use another verified team machine for the shared test run and retain evidence.", "Yellow"),
    ("R06", "6", "External provider not configured", "Google OAuth, email or payment-provider journeys cannot be completed.", "High", "Moderate", "Integration", "Credentials, provider approval or sponsor decision is missing", "Provider disabled/error message or no delivery callback", "Integration lead", "Keep password/manual flows testable and label provider scope clearly.", "Demonstrate the supported fallback and record the blocked provider as future work.", "Yellow"),
    ("R07", "7", "Documentation drifts from code", "Routes, states or capabilities change after diagrams are prepared.", "Medium", "Major", "Project / Quality", "Diagrams are copied between people without code cross-check", "Build route list or domain types no longer match the URS", "Integration editor", "Use one registry and perform a final code-to-document traceability audit.", "Update affected diagrams and narratives, then rerun numbering and link checks.", "Yellow"),
    ("R08", "8", "Manual QA evidence is incomplete", "The team submits claims that were compiled but not exercised by a real user.", "Medium", "Major", "Quality", "Environment failure or test time is left until the end", "Critical journey remains Blocked or has no screenshot/result", "QA lead", "Schedule live QA before final formatting and use the role-based manual plan.", "Mark unverified claims honestly and prioritize security, booking and billing retests.", "Yellow"),
    ("R09", "9", "Schedule or integration conflict", "Parallel work misses the deadline or cannot be merged consistently.", "Medium", "Moderate", "Project / People", "Tasks have unclear owners and late review dependencies", "Work stays In Progress beyond its review date", "Project manager", "Use ownership, due dates, review columns and a 15 percent integration buffer.", "Reduce optional examples, pair contributors and reassign blocked work.", "Green"),
    ("R10", "10", "Seed or hosted-data mismatch", "Local personas and hosted records produce different behaviour.", "Medium", "Moderate", "Data / Environment", "Migrations or seed data are not applied consistently", "A flow passes after reset but fails against hosted configuration", "Database lead", "Version migrations and seed data; record which environment produced evidence.", "Recreate a clean environment and compare schema/configuration before retesting.", "Green"),
    ("R11", "11", "Responsive or accessibility regression", "A public/auth/calendar change becomes unusable on small screens or by keyboard.", "Medium", "Moderate", "UX / Quality", "Visual changes are reviewed only at desktop width", "Overflow, hidden focus or unreachable mobile-menu control", "UX lead", "Test 375, 768 and 1280 widths plus keyboard focus and reduced motion.", "Rollback or simplify the affected component and repeat accessibility checks.", "Green"),
    ("R12", "12", "Legal content remains provisional", "Privacy, consent or terms wording is mistaken for sponsor-approved legal text.", "High", "Moderate", "Legal / Ethical", "Placeholder content is not visibly identified", "Submission claims POPIA compliance based only on technical controls", "Sponsor liaison", "Separate technical safeguards from final legal wording and request approval.", "Replace claims with a limitation statement and obtain sponsor/legal review.", "Yellow"),
]


SUBSYSTEMS = [
    ("PUB", "Public Experience", "Public visitor", "Browse the academy, public schedule, membership information, contacts, legal pages and public lesson availability.", "Identity and Profile when an account-required action begins."),
    ("IAM", "Identity and Profile", "Visitor; account holder; Supabase Auth", "Create a guest account, confirm identity, sign in, recover access, maintain profile and preserve safe internal return paths.", "Supabase Auth, email delivery and optional Google OAuth."),
    ("MEM", "Membership", "Account holder; administrator", "Show membership types, submit/resubmit applications, review applications and manage the individual's membership lifecycle.", "Identity and Profile, Administration and Audit."),
    ("FAM", "Family and Household", "Guardian/payer; dependent; administrator", "Request, accept, reject and end links between existing accounts while keeping membership and privacy independent.", "Identity and Profile, Billing and Payments, Administration and Audit."),
    ("BOOK", "Lesson Scheduling and Booking", "Visitor; account holder; guardian; dependent; coach; administrator", "Publish safe availability, create lesson slots, select a participant, enforce eligibility/capacity, create bookings and show history.", "Membership, Family and Household, Billing and Payments."),
    ("BILL", "Billing and Payments", "Guardian/payer; administrator; payment provider", "Route charges to the responsible payer, generate idempotent invoices, show participant-attributed lines, record payments and issue receipts.", "Booking, Membership and the planned payment provider."),
    ("ADM", "Administration and Audit", "Administrator; coach where explicitly allowed", "Manage accounts and staff, review statistics, operate queues and record auditable decisions.", "All internal subsystems and PostgreSQL."),
]


USE_CASES = [
    ("PUB-1", "Browse public CFA information", "Public visitor", "Public Experience", "Sea", "Homepage sections and legal/contact information are accessible without authentication."),
    ("PUB-2", "Browse lesson availability", "Public visitor", "Public Experience", "Sea", "Only future open slots and safe aggregate capacity are shown."),
    ("IAM-1", "Create guest account", "Public visitor", "Identity and Profile", "Sea", "Creates a continuing individual account with guest status."),
    ("IAM-2", "Authenticate and resume task", "Account holder", "Identity and Profile", "Sea", "Valid internal destinations are preserved; unsafe destinations fall back to the dashboard."),
    ("IAM-3", "Recover password", "Account holder", "Identity and Profile", "Sea", "Email recovery changes credentials without losing domain records."),
    ("IAM-4", "Maintain profile", "Account holder", "Identity and Profile", "Sea", "Only permitted personal fields may be changed by the account holder."),
    ("MEM-1", "Submit membership application", "Account holder", "Membership", "Sea", "Applicant remains a guest until approval."),
    ("MEM-2", "Resubmit requested changes", "Applicant", "Membership", "Sea", "Creates a new application version for review."),
    ("MEM-3", "Review membership application", "Administrator", "Membership", "Sea", "Approve, request changes or reject with reviewer evidence."),
    ("MEM-4", "Change membership status", "Administrator / member", "Membership", "Sea", "Lifecycle status changes apply only to the individual account."),
    ("FAM-1", "Request family link", "Guardian/payer", "Family and Household", "Sea", "Targets an existing account without disclosing account existence."),
    ("FAM-2", "Respond to family-link request", "Dependent", "Family and Household", "Sea", "Acceptance activates the relationship; rejection grants no access."),
    ("FAM-3", "End active family link", "Authorized family party", "Family and Household", "Sea", "Future access ends while history remains."),
    ("BOOK-1", "Create lesson slot", "Administrator", "Lesson Scheduling and Booking", "Sea", "Defines time, capacity, price, coach and access rule."),
    ("BOOK-2", "Book lesson", "Account holder / guardian / dependent", "Lesson Scheduling and Booking", "Sea", "Eligibility follows the participant, not the booking actor or payer."),
    ("BOOK-3", "View lesson history", "Account holder / guardian", "Lesson Scheduling and Booking", "Sea", "Shows permitted participant history without leaking household finances."),
    ("BOOK-4", "Validate participant eligibility", "CFA Platform", "Lesson Scheduling and Booking", "Fish", "Always included by lesson booking."),
    ("BILL-1", "Generate monthly invoices", "Administrator", "Billing and Payments", "Sea", "Creates participant-attributed invoice lines without duplicate charges."),
    ("BILL-2", "View household billing", "Guardian/payer", "Billing and Payments", "Sea", "Dependents cannot view guardian financial data."),
    ("BILL-3", "Record manual payment", "Administrator", "Billing and Payments", "Sea", "Settles the invoice and produces exactly one receipt."),
    ("ADM-1", "Manage accounts and staff", "Administrator", "Administration and Audit", "Sea", "Search, invite, edit and deactivate within server-enforced permissions."),
    ("ADM-2", "Review operational dashboard", "Administrator", "Administration and Audit", "Sea", "Shows member statistics and operational queues."),
    ("ADM-3", "Record audit event", "CFA Platform", "Administration and Audit", "Fish", "Included by sensitive decisions and relationship changes."),
]


NARRATIVES = [
    {
        "id": "IAM-1", "name": "Create guest account", "level": "Sea level", "actors": "Primary: Public visitor. Secondary: Supabase Auth and email delivery.",
        "stakeholders": "Visitor wants a usable account; CFA needs one identity per person; administrators require an auditable account record.",
        "brief": "Create a continuing CFA account that begins as a guest and preserves a valid internal destination.",
        "pre": "Visitor is logged out and controls a unique email address.", "post": "An authenticated guest account and profile exist; confirmation is complete when required; no membership is granted.",
        "related": "IAM-2 Authenticate and resume task; MEM-1 Submit membership application.",
        "steps": [("1. Select Sign up.", "1.1 Display the four-step guest account flow."), ("2. Enter name, email and password confirmation.", "2.1 Validate format and password agreement."), ("3. Submit the form.", "3.1 Create the auth user and profile with guest status."), ("4. Follow the confirmation message when required.", "4.1 Confirm the session and validate the internal return path."), ("5. Continue.", "5.1 Open the intended CFA page or the protected dashboard.")],
        "alts": [("2a. Invalid or duplicate details", "Show a specific error and keep the visitor in the flow without duplicate creation."), ("4a. Confirmation link is invalid or expired", "Show the safe auth error page and offer a new login/sign-up path."), ("5a. Return path is external or malformed", "Ignore it and open /protected.")],
    },
    {
        "id": "MEM-1", "name": "Submit membership application", "level": "Sea level", "actors": "Primary: Authenticated account holder. Secondary: Administrator.",
        "stakeholders": "Applicant wants transparent progress; CFA needs complete, reviewable information and independent membership decisions.",
        "brief": "Submit an application for the applicant's own continuing account.",
        "pre": "The applicant is signed in, has a usable profile, and has no open application.", "post": "A pending versioned application exists; the account remains a guest.",
        "related": "MEM-2 Resubmit requested changes; MEM-3 Review membership application.",
        "steps": [("1. Open Membership Portal.", "1.1 Display current status and active membership types."), ("2. Select a membership type.", "2.1 Show price, term and joining-fee information."), ("3. Submit the application.", "3.1 Validate the request and create a Pending snapshot."), ("4. Review the result.", "4.1 Show the application history while preserving guest access.")],
        "alts": [("3a. Another application is pending", "Reject the duplicate and display the current application."), ("3b. Membership type is inactive or invalid", "Reject the request without changing account status.")],
    },
    {
        "id": "MEM-3", "name": "Review membership application", "level": "Sea level", "actors": "Primary: Administrator. Secondary: Applicant and audit service.",
        "stakeholders": "Applicant needs a fair visible decision; CFA needs controlled approval, private notes and audit evidence.",
        "brief": "Approve, request changes or reject a submitted application.",
        "pre": "Administrator is authenticated and a Pending application exists.", "post": "Decision, reviewer and timestamp are recorded; approval activates only the applicant's membership.",
        "related": "MEM-1 Submit membership application; MEM-2 Resubmit requested changes; ADM-3 Record audit event.",
        "steps": [("1. Open Membership Requests.", "1.1 Display pending applications and applicant details."), ("2. Open an application.", "2.1 Display submitted snapshot and review controls."), ("3. Enter visible response and optional private note.", "3.1 Validate the review input."), ("4. Choose Approve, Request changes or Reject.", "4.1 Atomically record the decision, reviewer and time."), ("5. Confirm the result.", "5.1 Update the applicant-visible status and write an audit event.")],
        "alts": [("4a. Approve", "Create or activate the applicant's membership only."), ("4b. Request changes", "Keep guest status and allow a versioned resubmission."), ("4c. Reject", "Keep guest status and make the response visible."), ("4d. Application was already reviewed", "Reject the stale action and reload current state.")],
    },
    {
        "id": "FAM-1", "name": "Request family link", "level": "Sea level", "actors": "Primary: Guardian/payer account. Secondary: Existing dependent account and audit service.",
        "stakeholders": "Guardian wants permitted family management; dependent retains consent and privacy; CFA avoids duplicate or coerced links.",
        "brief": "Request a guardian-dependent relationship between two existing accounts.",
        "pre": "Requester is authenticated; the target already has a CFA account; the pair is not actively linked.", "post": "A Pending link exists and grants no family or financial access until accepted.",
        "related": "FAM-2 Respond to family-link request; FAM-3 End active family link.",
        "steps": [("1. Open Family Accounts.", "1.1 Display active, incoming and outgoing links."), ("2. Choose Link Existing Account.", "2.1 Display the target-email form and privacy notice."), ("3. Enter the dependent account email.", "3.1 Normalize and validate the request without revealing account existence."), ("4. Submit the request.", "4.1 Create a Pending link when valid and record an audit event."), ("5. Review the neutral response.", "5.1 Confirm that a request was sent if the account is eligible.")],
        "alts": [("3a. Self-link attempt", "Reject the relationship."), ("3b. Duplicate Pending or Active pair", "Return the existing relationship instead of creating a duplicate."), ("3c. Email is unknown", "Return the same neutral response without creating a link.")],
    },
    {
        "id": "FAM-2", "name": "Respond to family-link request", "level": "Sea level", "actors": "Primary: Target dependent account. Secondary: Guardian/payer and audit service.",
        "stakeholders": "Dependent controls consent; guardian needs a clear outcome; CFA must activate billing only after acceptance.",
        "brief": "Accept or reject an incoming family-link request.",
        "pre": "The target account is authenticated and owns a Pending incoming request.", "post": "Acceptance activates family and billing links; rejection grants no access.",
        "related": "FAM-1 Request family link; BILL-2 View household billing.",
        "steps": [("1. Open Family Accounts.", "1.1 Display incoming Pending requests."), ("2. Review the requesting guardian.", "2.1 Show only information permitted for consent."), ("3. Choose Accept or Reject.", "3.1 Verify the current user is the target dependent."), ("4. Confirm the response.", "4.1 Change the link state and record an audit event."), ("5. Refresh Family Accounts.", "5.1 Show the active relationship or rejected history.")],
        "alts": [("3a. Accept", "Activate the family link and dependent billing link."), ("3b. Reject", "Set Rejected and create no billing authority."), ("3c. Request is no longer Pending", "Reject the stale response and display current state.")],
    },
    {
        "id": "BOOK-2", "name": "Book lesson", "level": "Sea level", "actors": "Primary: Account holder, guardian or dependent. Secondary: Membership, family and billing services.",
        "stakeholders": "Participant wants an eligible place; CFA needs capacity control; payer needs correct attribution; dependents require financial privacy.",
        "brief": "Create a booking for the authenticated person or an actively linked dependent.",
        "pre": "User is authenticated; the slot is future and open; selected participant is permitted.", "post": "Booking identifies actor and participant; charge is routed to the derived payer; capacity is updated.",
        "related": "BOOK-4 Validate participant eligibility; BILL-1 Generate monthly invoices.",
        "steps": [("1. Select a public lesson slot.", "1.1 Show date, Cape Town time, price, capacity and access rule."), ("2. Authenticate if required.", "2.1 Return to the selected slot using a safe internal destination."), ("3. Select the participant and payment option.", "3.1 Limit choices to self and actively linked dependents."), ("4. Confirm booking.", "4.1 Recheck capacity and participant membership eligibility."), ("5. Review confirmation.", "5.1 Create booking and charge with server-derived payer."), ("6. Open lesson history.", "6.1 Show the participant booking without unrelated financial data.")],
        "alts": [("4a. Slot is full or closed", "Reject and offer another available slot."), ("4b. Members-only slot and participant is not active", "Reject even if the booker or payer is a member."), ("4c. Participant is outside the active family link", "Reject server-side and expose no unrelated profile data."), ("5a. Dependent books for self", "Force pay-later and route the charge to the active billing guardian.")],
    },
    {
        "id": "BILL-1", "name": "Generate monthly invoices", "level": "Sea level", "actors": "Primary: Administrator. Secondary: Billing repository and PostgreSQL.",
        "stakeholders": "CFA needs repeatable invoicing; payers need accurate participant attribution; auditors need preserved history.",
        "brief": "Generate one invoice for eligible unpaid charges in a selected period without duplication.",
        "pre": "Administrator is authenticated; eligible unpaid charges exist for the period.", "post": "Invoices and participant-attributed lines exist; repeated execution does not duplicate the same charge.",
        "related": "BOOK-2 Book lesson; BILL-3 Record manual payment.",
        "steps": [("1. Open Invoicing.", "1.1 Display period control and existing invoices."), ("2. Select a billing period.", "2.1 Validate the period."), ("3. Run invoice generation.", "3.1 Group eligible charges by payer."), ("4. Wait for completion.", "4.1 Create invoices and lines atomically, preserving participant references."), ("5. Review results.", "5.1 Display invoice number, total, status and lines.")],
        "alts": [("3a. No eligible charges", "Return a successful no-op result."), ("4a. Charge was already invoiced", "Skip it through uniqueness/idempotency rules."), ("4b. Missing active billing relationship", "Keep the charge unresolved and report the data issue for administrator action.")],
    },
    {
        "id": "BILL-3", "name": "Record manual payment and receipt", "level": "Sea level", "actors": "Primary: Administrator. Secondary: Payer and billing repository.",
        "stakeholders": "Payer needs proof of settlement; CFA needs one consistent payment and receipt; auditors need traceability.",
        "brief": "Record settlement of an outstanding invoice and issue exactly one receipt.",
        "pre": "Administrator is authenticated and the invoice is Unpaid or Overdue.", "post": "Invoice and charges are Paid; one receipt is visible to the payer; audit evidence is retained.",
        "related": "BILL-1 Generate monthly invoices; BILL-2 View household billing.",
        "steps": [("1. Open Payments.", "1.1 Display outstanding invoices."), ("2. Select an invoice.", "2.1 Display payer, amount and participant-attributed lines."), ("3. Confirm manual payment.", "3.1 Verify administrator authority and current invoice status."), ("4. Submit settlement.", "4.1 Mark invoice and charges Paid and create one receipt atomically."), ("5. Confirm payer view.", "5.1 Display the receipt in authorized household billing.")],
        "alts": [("3a. Invoice is already paid", "Return the existing settlement and do not create another receipt."), ("4a. Transaction fails", "Rollback all changes and leave the invoice outstanding."), ("5a. Dependent opens billing", "Deny access to guardian financial information.")],
    },
]


SEQUENCE_SPECS = {
    "IAM-1": (["Visitor\nActor", "Sign-up UI", "Auth Controller", "Supabase Auth\nExternal", "Profile\nEntity", "Email\nExternal"], [(0,1,"enter details",False),(1,2,"createAccount(name,email,password,next)",False),(2,3,"signUp(credentials,metadata)",False),(3,4,"create guest profile",False),(3,5,"send confirmation",False),(5,0,"confirmation link",True),(0,3,"confirm token",False),(3,2,"authenticated session",True),(2,1,"open safe next route",True)]),
    "MEM-1": (["Applicant\nActor","Membership UI","Membership Controller","MembershipType\nEntity","Application\nEntity","Audit\nEntity"], [(0,1,"open portal",False),(1,2,"loadMembershipOptions()",False),(2,3,"getActiveTypes()",False),(3,2,"types",True),(0,1,"submit selected type",False),(1,2,"submitApplication(type)",False),(2,4,"create Pending snapshot",False),(4,5,"record submission",False),(2,1,"pending application",True)]),
    "MEM-3": (["Admin\nActor","Review UI","Membership Controller","Application\nEntity","Membership\nEntity","Audit\nEntity"], [(0,1,"open application",False),(1,2,"getApplication(id)",False),(2,3,"application snapshot",True),(0,1,"submit decision and notes",False),(1,2,"review(id,decision,response,notes)",False),(2,3,"record decision/reviewer/time",False),(2,4,"activate membership [approve]",False),(2,5,"record audit event",False),(2,1,"updated result",True)]),
    "FAM-1": (["Guardian\nActor","Family UI","Family Controller","Profile\nEntity","FamilyLink\nEntity","Audit\nEntity"], [(0,1,"enter dependent email",False),(1,2,"requestLink(email)",False),(2,3,"resolve target privately",False),(3,2,"eligible target or neutral result",True),(2,4,"create Pending link",False),(4,5,"record request event",False),(2,1,"neutral success message",True)]),
    "FAM-2": (["Dependent\nActor","Family UI","Family Controller","FamilyLink\nEntity","BillingLink\nEntity","Audit\nEntity"], [(0,1,"choose Accept or Reject",False),(1,2,"respond(linkId,response)",False),(2,3,"verify target and Pending state",False),(2,3,"set Active or Rejected",False),(2,4,"activate billing link [accept]",False),(2,5,"record response event",False),(2,1,"updated family state",True)]),
    "BOOK-2": (["Booker\nActor","Booking UI","Booking Controller","LessonSlot\nEntity","Profile/Membership\nEntity","Booking/Charge\nEntities"], [(0,1,"select slot and participant",False),(1,2,"book(slot,participant,payment)",False),(2,3,"recheck open capacity",False),(3,2,"availability",True),(2,4,"validate participant and family authority",False),(4,2,"eligibility and derived payer",True),(2,5,"create booking and charge",False),(5,2,"booking result",True),(2,1,"success or safe rejection",True)]),
    "BILL-1": (["Admin\nActor","Invoicing UI","Billing Controller","Charge\nEntity","Invoice\nEntity","PostgreSQL\nDatabase"], [(0,1,"select period",False),(1,2,"runInvoices(period)",False),(2,3,"find eligible unpaid charges",False),(3,2,"charges grouped by payer",True),(2,4,"create invoice and lines",False),(4,5,"commit atomically with uniqueness",False),(5,2,"invoice results",True),(2,1,"display generated/existing invoices",True)]),
    "BILL-3": (["Admin\nActor","Payments UI","Billing Controller","Invoice\nEntity","Charge\nEntity","Receipt\nEntity"], [(0,1,"select outstanding invoice",False),(1,2,"recordPayment(invoiceId)",False),(2,3,"verify Unpaid/Overdue",False),(3,2,"current invoice",True),(2,4,"mark linked charges Paid",False),(2,3,"mark invoice Paid",False),(2,5,"create receipt once",False),(5,2,"receipt",True),(2,1,"settlement result",True)]),
}


STATE_SPECS = {
    "membership-application": ("MembershipApplication lifecycle", ["Pending", "Changes Requested", "Approved", "Rejected"], [(0,1,"request changes / show response"),(1,0,"resubmit [valid] / increment version"),(0,2,"approve / activate membership"),(0,3,"reject / preserve guest")]),
    "membership": ("Membership lifecycle", ["Active", "Suspended", "Expired", "Cancelled"], [(0,1,"suspend"),(1,0,"reinstate"),(0,2,"term ends"),(0,3,"cancel"),(1,3,"cancel")]),
    "family-link": ("FamilyLink lifecycle", ["Pending", "Active", "Rejected", "Ended"], [(0,1,"accept / activate billing link"),(0,2,"reject"),(1,3,"end / close billing link")]),
    "booking": ("Booking lifecycle", ["Upcoming", "Attended", "Cancelled"], [(0,1,"lesson completed"),(0,2,"cancel [policy permits]")]),
    "invoice": ("Invoice lifecycle", ["Unpaid", "Overdue", "Paid"], [(0,1,"due date passes"),(0,2,"settle"),(1,2,"settle")]),
    "payment-attempt": ("PaymentAttempt lifecycle", ["Pending", "Succeeded", "Failed"], [(0,1,"provider confirms"),(0,2,"provider rejects or times out")]),
}


TRACE_ROWS = [
    ("Secure continuing identity", "IAM", "IAM-1", "IAM-1", "IAM-1", "Profile", "Profile active flag", "/auth/sign-up; /auth/confirm", "Auth flow screenshot + test result"),
    ("Independent membership", "MEM", "MEM-1", "MEM-1", "MEM-1", "MembershipApplication; Membership", "Application; Membership", "/membership-portal; /protected/membership-request", "Application and status screenshots"),
    ("Controlled approval", "MEM/ADM", "MEM-3", "MEM-3", "MEM-3", "MembershipApplication; AuditEvent", "Application", "/protected/admin/membership-requests", "Decision, reviewer and applicant view"),
    ("Consent-based family linking", "FAM", "FAM-1/FAM-2", "FAM-1/FAM-2", "FAM-1/FAM-2", "FamilyLink; DependentBillingLink", "FamilyLink", "/family; /protected/family", "Request, acceptance and rejection evidence"),
    ("Participant-based booking", "BOOK", "BOOK-2", "BOOK-2", "BOOK-2", "LessonSlot; Booking; Charge", "Booking", "/book; /protected/lessons", "Guest/member/dependent matrix"),
    ("Accurate household billing", "BILL", "BILL-1", "BILL-1", "BILL-1", "Charge; Invoice; InvoiceLine", "Invoice", "/protected/admin/invoicing; /protected/billing", "Idempotency and attribution evidence"),
    ("Consistent settlement", "BILL/ADM", "BILL-3", "BILL-3", "BILL-3", "Invoice; Receipt", "Invoice; PaymentAttempt", "/protected/admin/payments", "One payment and one receipt"),
]


USE_CASE_DIAGRAMS = {
    "public": ("Public Experience use cases", ["Visitor"], ["Supabase Auth"], [("PUB-1", "Browse public information"), ("PUB-2", "Browse lesson availability"), ("IAM-1", "Create guest account")], [(0, 0, "L"), (0, 1, "L"), (0, 2, "L"), (0, 2, "R")]),
    "identity": ("Identity and Profile use cases", ["Visitor", "Account holder"], ["Email service", "Google OAuth"], [("IAM-1", "Create guest account"), ("IAM-2", "Authenticate and resume task"), ("IAM-3", "Recover password"), ("IAM-4", "Maintain profile")], [(0, 0, "L"), (0, 1, "L"), (0, 2, "L"), (1, 3, "L"), (0, 2, "R"), (1, 1, "R")]),
    "membership": ("Membership use cases", ["Guest", "Member"], ["Administrator", "Audit service"], [("MEM-1", "Submit application"), ("MEM-2", "Resubmit changes"), ("MEM-3", "Review application"), ("MEM-4", "Change membership status")], [(0, 0, "L"), (0, 1, "L"), (1, 3, "L"), (0, 2, "R"), (0, 3, "R"), (1, 2, "R")]),
    "family": ("Family and Household use cases", ["Guardian / payer", "Dependent"], ["Audit service"], [("FAM-1", "Request family link"), ("FAM-2", "Respond to link"), ("FAM-3", "End active link")], [(0, 0, "L"), (0, 2, "L"), (1, 1, "L"), (0, 0, "R"), (0, 1, "R"), (0, 2, "R")]),
    "booking": ("Lesson Scheduling and Booking use cases", ["Account holder", "Coach"], ["Membership service", "Family service"], [("BOOK-1", "Create lesson slot"), ("BOOK-2", "Book lesson"), ("BOOK-3", "View lesson history"), ("BOOK-4", "Validate participant eligibility")], [(0, 1, "L"), (0, 2, "L"), (1, 0, "L"), (0, 3, "R"), (1, 3, "R")]),
    "billing": ("Billing and Payments use cases", ["Payer", "Administrator"], ["PostgreSQL", "Payment provider"], [("BILL-1", "Generate invoices"), ("BILL-2", "View household billing"), ("BILL-3", "Record manual payment")], [(0, 1, "L"), (1, 0, "L"), (1, 2, "L"), (0, 0, "R"), (1, 2, "R")]),
    "admin": ("Administration and Audit use cases", ["Administrator", "Coach"], ["Audit service"], [("ADM-1", "Manage accounts and staff"), ("ADM-2", "Review dashboard"), ("ADM-3", "Record audit event")], [(0, 0, "L"), (0, 1, "L"), (1, 1, "L"), (0, 2, "R")]),
}


NAVIGATION_SPECS = {
    "public": (
        "Public website navigation",
        [("home", "/ - Home", 0), ("book", "/book - Availability", 1), ("privacy", "/privacy", 1), ("terms", "/terms", 1), ("login", "/auth/login", 1), ("signup", "/auth/sign-up", 2), ("forgot", "/auth/forgot-password", 2), ("family", "/family", 2), ("portal", "/membership-portal", 2)],
        [("home", "book", False, "browse"), ("home", "privacy", False, "footer"), ("home", "terms", False, "footer"), ("home", "login", False, "sign in"), ("login", "signup", False, "create"), ("login", "forgot", False, "reset"), ("home", "family", False, "learn"), ("home", "portal", False, "apply"), ("family", "login", True, "action"), ("portal", "login", True, "action")],
        {"login", "signup", "forgot"},
    ),
    "authenticated": (
        "Authenticated account navigation",
        [("hub", "/protected - Account hub", 0), ("profile", "/protected/profile", 1), ("complete", "/complete-profile", 1), ("lessons", "/protected/lessons", 1), ("request", "/protected/membership-request", 1), ("family", "/protected/family", 2), ("dependents", "/protected/dependents", 2), ("billing", "/protected/billing", 2), ("book", "/book", 2)],
        [("hub", "profile", False, "manage"), ("hub", "lessons", False, "history"), ("hub", "request", False, "membership"), ("hub", "family", False, "links"), ("family", "dependents", False, "manage"), ("hub", "billing", False, "payer only"), ("lessons", "book", False, "book more"), ("hub", "complete", True, "if incomplete")],
        {"complete", "request", "family", "dependents", "billing"},
    ),
    "administrator": (
        "Administrator navigation",
        [("dash", "/protected/admin", 0), ("members", "/admin/members", 1), ("requests", "/admin/membership-requests", 1), ("lessons", "/admin/lessons", 1), ("households", "/admin/households", 2), ("invoicing", "/admin/invoicing", 2), ("payments", "/admin/payments", 2), ("detail", "/admin/members/[id]", 3), ("new", "/admin/members/new", 3)],
        [("dash", "members", False, "accounts"), ("dash", "requests", False, "review"), ("dash", "lessons", False, "schedule"), ("dash", "households", False, "families"), ("dash", "invoicing", False, "billing"), ("dash", "payments", False, "settle"), ("members", "detail", False, "open"), ("members", "new", False, "create")],
        {"dash", "members", "requests", "lessons", "households", "invoicing", "payments", "detail", "new"},
    ),
}


CLASS_ROWS = [
    ("Profile", "fullName, email, membershipStatus, staffType, isActive", "Account identity and capability dimensions."),
    ("MembershipType", "name, price, termMonths, joiningFee", "Sponsor-defined membership offering."),
    ("Membership", "status, startedAt, statusChangedAt", "An individual's current membership lifecycle."),
    ("MembershipApplication", "version, status, submittedDetails, visibleResponse", "Versioned request and review outcome."),
    ("FamilyLink", "status, requestedAt, acceptedAt, endedAt", "Consent-based guardian-dependent relationship."),
    ("Household / HouseholdMember", "paymentPreference; householdRole, payerConsentAt", "Billing group and its member roles."),
    ("DependentBillingLink", "effectiveFrom, effectiveTo", "Effective-dated financial authority created after consent."),
    ("LessonSlot", "startsAt, endsAt, capacity, price, accessRule", "A future lesson offering."),
    ("Booking", "paymentOption, status, createdAt", "Links actor, participant and slot."),
    ("Charge", "type, amount, status, period", "Billable consequence routed to a payer."),
    ("Invoice / InvoiceLine", "number, period, status, total; description, amount", "Payer statement preserving participant attribution."),
    ("Receipt", "receiptNumber, amount, issuedAt", "Evidence of settlement."),
    ("PaymentAttempt", "status, providerReference, attemptedAt", "Provider or manual settlement attempt."),
    ("AuditEvent", "eventType, metadata, createdAt", "Who did what, to which subject, and when."),
]


def add_table_caption(doc, number, title):
    p = doc.add_paragraph()
    p.paragraph_format.space_before = Pt(5)
    p.paragraph_format.space_after = Pt(4)
    r = p.add_run(f"Table {number}: {title}")
    set_run_font(r, size=9, color=MUTED, italic=True)


def heading(doc, text, level=1):
    p = doc.add_heading(text, level=level)
    p.paragraph_format.keep_with_next = True
    return p


def page_break(doc):
    doc.add_page_break()


def configure_document(doc):
    section = doc.sections[0]
    section.page_width, section.page_height = Cm(21.0), Cm(29.7)
    section.left_margin = section.right_margin = Cm(1.8)
    section.top_margin = section.bottom_margin = Cm(1.8)
    styles = doc.styles
    normal = styles["Normal"]
    normal.font.name = "Calibri"
    normal.font.size = Pt(10.5)
    normal.font.color.rgb = rgb(INK)
    normal.paragraph_format.space_after = Pt(6)
    normal.paragraph_format.line_spacing = 1.2
    for level, size, color, before, after in [(1, 16, BLUE, 18, 10), (2, 13, BLUE, 14, 7), (3, 11.5, "1F4D78", 10, 5)]:
        style = styles[f"Heading {level}"]
        style.font.name = "Calibri"
        style.font.size = Pt(size)
        style.font.bold = True
        style.font.color.rgb = rgb(color)
        style.paragraph_format.space_before = Pt(before)
        style.paragraph_format.space_after = Pt(after)
        style.paragraph_format.keep_with_next = True
    styles["Title"].font.name = "Calibri"
    styles["Title"].font.size = Pt(30)
    styles["Title"].font.bold = True
    styles["Title"].font.color.rgb = rgb(WHITE)
    styles["Subtitle"].font.name = "Calibri"
    styles["Subtitle"].font.size = Pt(14)
    styles["Subtitle"].font.color.rgb = rgb(PALE_GOLD)
    settings = doc.settings._element
    update = OxmlElement("w:updateFields")
    update.set(qn("w:val"), "true")
    settings.append(update)


def configure_headers(doc):
    # Later sections remain linked to the first section. Configure the shared
    # header/footer once to avoid appending duplicate text at every section break.
    section = doc.sections[0]
    for item in doc.sections:
        item.header_distance = Cm(0.8)
        item.footer_distance = Cm(0.8)
    hp = section.header.paragraphs[0]
    hp.text = "CFA  |  Milestone 2 Group Master Handbook"
    hp.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    for run in hp.runs:
        set_run_font(run, size=8, color=MUTED, bold=True)
    fp = section.footer.paragraphs[0]
    fp.text = ""
    fp.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = fp.add_run("Internal working guide  |  Page ")
    set_run_font(r, size=8, color=MUTED)
    add_page_field(fp)


def add_cover(doc):
    section = doc.sections[0]
    section.different_first_page_header_footer = True
    table = doc.add_table(rows=1, cols=1)
    set_table_geometry(table, [PAGE_WIDTH_DXA], total_dxa=PAGE_WIDTH_DXA, indent_dxa=0)
    cell = table.cell(0, 0)
    shade_cell(cell, NAVY)
    set_cell_margins(cell, top=720, start=420, bottom=720, end=420)
    cell.text = ""
    p = cell.paragraphs[0]
    p.style = doc.styles["Title"]
    p.add_run("CFA MILESTONE 2\nGROUP MASTER HANDBOOK")
    sp = cell.add_paragraph()
    sp.style = doc.styles["Subtitle"]
    sp.add_run("One shared system model, ready-to-use analysis content, and a submission control guide")
    ep = cell.add_paragraph()
    ep.paragraph_format.space_before = Pt(30)
    er = ep.add_run("INF3003W  |  Milestone 2  |  2026")
    set_run_font(er, size=12, color=YELLOW, bold=True)
    add_para(doc, "Cape Flitz Archery (CFA) Platform - working source of truth", align=WD_ALIGN_PARAGRAPH.CENTER, after=14)
    add_table_caption(doc, 1, "Team and submission metadata")
    rows = [
        ("Team name", "[TEAM TO COMPLETE]"), ("Team number", "[TEAM TO COMPLETE]"),
        ("Team members", "[TEAM TO COMPLETE]"), ("Group leader", "[TEAM TO COMPLETE]"),
        ("Sponsor / contact", "[TEAM TO COMPLETE]"), ("Submission deadline", "[TEAM TO COMPLETE]"),
        ("Handbook baseline", "05 August 2026 | v1.0"),
    ]
    add_table(doc, ["Field", "Value"], rows, [2600, 7000], font_size=9)
    add_callout(doc, "Purpose", "This is the group's internal master handbook. Copy approved content into the official URS and narrative templates, but keep this document as the consistency authority. Blue headings and plain body text are reusable content. Teal callouts are working guidance. Gold callouts identify decisions or evidence the team must supply.")
    add_para(doc, "Prepared from the current CFA codebase, Milestone 2 slides and marking sheet, the supplied templates, and the 2019/2020 exemplars. All supplied files remain unchanged.", italic=True, color=MUTED, align=WD_ALIGN_PARAGRAPH.CENTER)
    page_break(doc)


def add_front_matter(doc):
    heading(doc, "Contents", 1)
    add_toc(doc)
    add_callout(doc, "Updating the contents page", "Microsoft Word should update fields when this file opens. If page numbers remain stale, select the contents table and choose Update Field > Update entire table.", fill=PALE_GOLD, accent=GOLD)
    heading(doc, "How the group should use this handbook", 1)
    for text in [
        "Lock Sections 1 and 2 before dividing the work. No contributor should invent a different actor, package, entity, state or scope boundary.",
        "Give each artifact an owner and reviewer. The owner drafts; the reviewer checks traceability, rubric compliance, naming and evidence.",
        "When a sponsor answer changes a rule, update the decision register first, then every affected artifact shown in the traceability matrix.",
        "Treat diagrams as views of one model. A use case selected for a narrative must have one sequence diagram; every state transition must be reachable from a use case or administrator action.",
    ]:
        add_number(doc, text)
    add_callout(doc, "Verified implementation baseline", "As at 05 August 2026, the repository baseline passed 62 automated tests, lint and production build, and exposes 41 application routes. These checks support the As-Is evidence but do not replace live browser QA, sponsor validation or submission screenshots.")


def add_scope_section(doc, figs, tables):
    heading(doc, "1. Authoritative CFA Project Rundown", 1)
    heading(doc, "1.1 Project definition statement - draft for the official URS", 2)
    add_para(doc, "Cape Flitz Archery needs a secure web platform that turns an informal public website and fragmented administration process into a consistent, auditable member service. The To-Be platform lets visitors discover CFA and lesson availability; lets a person create one continuing account; keeps membership status independent from family and staff responsibilities; supports consent-based guardian-dependent relationships; validates the participant when lessons are booked; routes charges to the correct payer; and gives authorised staff controlled tools for membership, lessons, billing and audit.")
    add_para(doc, "The project succeeds when the same business vocabulary and rules are enforced in the user interface, services, database security, analysis models and QA evidence. It does not succeed merely because pages exist.")
    heading(doc, "1.2 Objectives", 2)
    objectives = [
        "Provide one continuing authenticated account and profile without automatically granting membership.",
        "Manage individual membership applications, visible review feedback and lifecycle states.",
        "Create guardian-dependent and payer relationships only between existing accounts and only after consent.",
        "Allow lesson discovery and participant-based booking while enforcing capacity and membership access rules server-side.",
        "Generate payer invoices that preserve participant attribution and record settlements without duplication.",
        "Give coaches and administrators only the operational authority needed for their duties and preserve auditable changes.",
        "Protect personal and financial information through server-side authorisation and database row-level security.",
    ]
    for item in objectives:
        add_bullet(doc, item)
    heading(doc, "1.3 One account, four independent dimensions", 2)
    add_para(doc, "A person is not assigned one all-purpose role. The platform evaluates four separate dimensions. For example, an administrator may also have an active membership and be a guardian. A dependent may be an authenticated guest who can book a public lesson while a guardian pays.")
    figs[0] += 1
    add_diagram(doc, draw_capability_axes(), figs[0], "Independent identity, membership, household and staff dimensions")
    tables[0] += 1
    add_table_caption(doc, tables[0], "Canonical actor and capability definitions")
    add_table(doc, ["Concept", "Canonical meaning", "Must not be confused with"], [
        ("Visitor", "Unauthenticated person browsing public content.", "Guest"),
        ("Authenticated account", "Confirmed identity with a Profile.", "Member"),
        ("Guest", "Authenticated person without an active membership.", "Visitor"),
        ("Member", "Person whose Membership is Active.", "Guardian or staff"),
        ("Guardian / payer", "Account authorised through an active family/billing relationship.", "Owner of the dependent account"),
        ("Dependent", "Account linked by consent; retains its own identity and privacy.", "A child record without an account"),
        ("Coach", "Staff capability for lessons and operational views.", "Administrator"),
        ("Administrator", "Privileged operational capability with auditable actions.", "Automatic access to every private datum"),
    ], [1900, 4400, 3300], font_size=8.4)
    heading(doc, "1.4 Confirmed To-Be scope", 2)
    tables[0] += 1
    add_table_caption(doc, tables[0], "Scope status and boundary")
    add_table(doc, ["Status", "Included items"], [
        ("Implemented / evidenced", "Public site and booking calendar; email/password account flows; profiles; membership request/review; family links; lesson administration and history; household billing, invoicing and manual settlement; admin routes; service/repository boundaries; RLS-aware data model."),
        ("To-Be within Milestone 2 model", "Production OAuth and email delivery; payment provider checkout and provider callbacks; final sponsor policies; complete live-browser and hosted-environment evidence."),
        ("Explicitly excluded unless sponsor approves", "Native mobile app; equipment inventory; tournament management; payroll; accounting-ledger replacement; medical diagnosis; social network; unrestricted dependent financial access."),
        ("Open sponsor decisions", "Final membership products and lifecycle; lesson cancellation/no-show/trial/capacity rules; refunds, VAT, credit notes, debit orders, partial payments and arrears; multi-guardian and billing transfer rules; payment provider; WhatsApp; final Privacy and Terms wording."),
    ], [2300, 7300], font_size=8.5)
    add_callout(doc, "Scope guardrail", "Do not present an open sponsor decision as an implemented fact. Mark it as a decision dependency in the official URS and keep the model provider-neutral until confirmed.", fill=PALE_GOLD, accent=GOLD)
    heading(doc, "1.5 External dependencies and assumptions", 2)
    for item in [
        "Supabase Auth provides account identity and session handling; Google OAuth is a planned provider until configured and verified.",
        "PostgreSQL stores business records and enforces row-level security. The database is external to the logical package model.",
        "Email delivery is required for confirmation and recovery; local Inbucket is test evidence, not the production service.",
        "A payment provider is a replaceable external dependency. No provider-specific contract should be assumed before sponsor selection.",
        "Cape Town local time is the business display context; persisted timestamps should remain unambiguous.",
        "Every person managed through family features has a separate account. Consent is not inferred from shared contact details.",
    ]:
        add_bullet(doc, item)
    heading(doc, "1.6 Project-definition completion fields", 2)
    tables[0] += 1
    add_table_caption(doc, tables[0], "Information the group must confirm before submission")
    add_table(doc, ["Required field", "Working position", "Owner / evidence"], [
        ("Objective priorities", "Security and data isolation; consistent domain model; complete booking/billing flow; usability; provider integrations.", "[TEAM TO COMPLETE]"),
        ("Terms of reference", "Deliver the Milestone 2 analysis portfolio and an evidence-backed To-Be specification for the CFA platform.", "Group approval"),
        ("Deadline", "[TEAM TO COMPLETE]", "Mark sheet / Vula"),
        ("Budget", "[TEAM TO COMPLETE]", "Sponsor or course assumption"),
        ("Related projects", "Current CFA web implementation and subsequent milestone implementation/QA work.", "Repository and milestone plan"),
        ("Legal / ethical", "POPIA-aware minimisation, consent, access control, financial privacy, accessibility, truthful provisional policies.", "Sponsor/legal review"),
    ], [2400, 4700, 2500], font_size=8.3)


def add_rubric_section(doc, tables):
    heading(doc, "2. Rubric Crosswalk and Marking Strategy", 1)
    add_callout(doc, "Marking-sheet inconsistency", "The listed sections total 110 marks (5 + 10 + 10 + 10 + 10 + 10 + 10 + 10 + 10 + 10 + 5 + 10), although the sheet displays /100. Do not silently renormalise. Confirm the intended weighting with the lecturer and prepare every listed artifact.", fill=PALE_GOLD, accent=GOLD)
    tables[0] += 1
    add_table_caption(doc, tables[0], "Milestone 2 rubric crosswalk")
    add_table(doc, ["Artifact", "Marks", "Completion standard", "Practical CFA tip"], RUBRIC_ROWS, [2400, 700, 3200, 3300], font_size=7.8)
    heading(doc, "2.1 Lessons from the supplied exemplars", 2)
    for item in [
        "The 2020 exemplar is the stronger structural model: it numbers figures, introduces diagrams in prose, explains them afterwards, and pairs six narratives with six sequences.",
        "The exemplars demonstrate presentation, not CFA facts. Reuse their discipline, not their domains, actors or entities.",
        "A diagram earns marks when a reader can understand its purpose, notation and relationship to the rest of the URS. Add a short introduction, caption and interpretation.",
        "Use the official templates for the submitted artifact where required, but retain the extra rubric fields included in this handbook, especially narrative level, stakeholders/interests and brief description.",
    ]:
        add_bullet(doc, item)


def add_workplan_section(doc, tables):
    heading(doc, "3. Group Workflow, Allocation and Scope Control", 1)
    heading(doc, "3.1 Recommended order of work", 2)
    for item in [
        "Scope lock: approve the project statement, exclusions, four capability dimensions and seven packages.",
        "Model lock: approve actor glossary, use-case registry, class names, key associations and six state lifecycles.",
        "Parallel drafting: allocate one package owner plus cross-cutting owners for risk, navigation, traceability and evidence.",
        "Integration review: narrative owners and sequence owners reconcile every message, precondition and alternative flow.",
        "Evidence pass: capture screenshots and results only after the artifact is stable; label each file with its trace ID.",
        "Submission pass: run the rubric checklist, update contents and figure/table references, export PDF, and inspect every page.",
    ]:
        add_number(doc, item)
    tables[0] += 1
    add_table_caption(doc, tables[0], "Suggested allocation worksheet")
    add_table(doc, ["Workstream", "Primary deliverable", "Owner", "Reviewer", "Done when"], [
        ("Scope and PDS", "Sections 1-2", "[TEAM TO COMPLETE]", "[TEAM TO COMPLETE]", "Sponsor assumptions and exclusions are explicit."),
        ("Risk", "Risk register and matrix", "[TEAM TO COMPLETE]", "[TEAM TO COMPLETE]", "Every risk has owner, trigger, mitigation and contingency."),
        ("Process/package", "Activity + package", "[TEAM TO COMPLETE]", "[TEAM TO COMPLETE]", "All seven subsystems and externals align."),
        ("Use cases", "Seven diagrams + registry", "[TEAM TO COMPLETE]", "[TEAM TO COMPLETE]", "IDs and actors match narratives."),
        ("Narratives/sequences", "Eight matched pairs", "[TEAM TO COMPLETE]", "[TEAM TO COMPLETE]", "Count and steps/messages match."),
        ("Class/state", "Analysis class + six states", "[TEAM TO COMPLETE]", "[TEAM TO COMPLETE]", "Multiplicity and transition coverage checked."),
        ("Navigation", "Three access views", "[TEAM TO COMPLETE]", "[TEAM TO COMPLETE]", "All routes and restrictions represented."),
        ("Integration/evidence", "Traceability + POE", "[TEAM TO COMPLETE]", "[TEAM TO COMPLETE]", "Every mark has artifact and evidence."),
    ], [1700, 1900, 1600, 1600, 2800], font_size=7.8)
    heading(doc, "3.2 Decision and change rule", 2)
    add_para(doc, "Create one task-board item for each sponsor decision. Record the decision, date, source and affected IDs. A change to participant eligibility, for example, requires updates to BOOK-2, BOOK-4, the sequence, Booking/Charge associations, booking states, route evidence and the traceability row.")
    add_callout(doc, "Definition of done", "An artifact is not done when it merely looks complete. It is done when its owner and reviewer can trace every name and rule to the shared model, every rubric criterion has been checked, and the required evidence has been attached.")


def add_package_activity(doc, figs, tables):
    heading(doc, "4. Logical Subsystems and Package Model", 1)
    add_para(doc, "The package diagram groups business responsibilities rather than mirroring folders or database schemas. Dependencies point toward the capability being used. External identity, database, email and payment services remain outside the CFA package boundary.")
    tables[0] += 1
    add_table_caption(doc, tables[0], "Seven canonical CFA subsystems")
    add_table(doc, ["ID / subsystem", "Primary responsibility", "Actors", "Key dependencies"], [(f"{code} - {name}", responsibility, actors, deps) for code, name, actors, responsibility, deps in SUBSYSTEMS], [2300, 3300, 1900, 2100], font_size=7.8)
    figs[0] += 1
    add_diagram(doc, draw_package_diagram(), figs[0], "CFA medium-level package diagram")
    add_para(doc, "Interpretation: Identity and Profile is foundational. Membership and Family provide eligibility and authority used by Booking. Booking creates the billable consequence used by Billing. Administration coordinates those packages but does not own their domain rules.")
    heading(doc, "5. Whole-System To-Be Activity Model", 1)
    add_para(doc, "This activity view models the end-to-end business flow across human and system swimlanes. It intentionally avoids page components, repositories and database calls because those belong in other views.")
    figs[0] += 1
    add_diagram(doc, draw_activity_diagram(), figs[0], "Whole-platform To-Be activity diagram", width=Inches(6.55))
    add_para(doc, "The decisive rules occur at account-required actions, participant eligibility, link consent, capacity rechecking and payer derivation. These must be enforced by the platform rather than left to navigation visibility.")


def add_use_case_section(doc, figs, tables):
    heading(doc, "6. Subsystem Use-Case Model", 1)
    add_para(doc, "Use-case IDs are stable trace keys. Sea-level use cases express a user goal; fish-level use cases support another use case and should not be selected as standalone narratives unless the lecturer requests it.")
    tables[0] += 1
    add_table_caption(doc, tables[0], "Canonical use-case registry")
    registry_rows = [(uc_id, subsystem, name, actor, f"{level} - {note}") for uc_id, name, actor, subsystem, level, note in USE_CASES]
    add_table(doc, ["ID", "Subsystem", "Use case", "Primary actor", "Level / note"], registry_rows, [900, 1900, 2600, 1900, 2300], font_size=7.8)
    figure_titles = [
        ("public", "Public Experience"), ("identity", "Identity and Profile"), ("membership", "Membership"),
        ("family", "Family and Household"), ("booking", "Lesson Scheduling and Booking"),
        ("billing", "Billing and Payments"), ("admin", "Administration and Audit"),
    ]
    for key, subsystem in figure_titles:
        title, primary, secondary, cases, relations = USE_CASE_DIAGRAMS[key]
        heading(doc, f"6.{figure_titles.index((key, subsystem)) + 1} {subsystem}", 2)
        add_para(doc, f"This diagram defines the externally visible goals for the {subsystem} subsystem. Actor associations show participation, not data ownership.")
        figs[0] += 1
        add_diagram(doc, draw_use_case_diagram(key, title, primary, secondary, cases, relations), figs[0], title)
    add_callout(doc, "Use-case review", "Check that every narrative ID appears in the registry and subsystem diagram. Do not add Create/Read/Update/Delete use cases merely to fill space; use business-goal names.")


def add_narratives(doc, tables):
    heading(doc, "7. Completed Use-Case Narrative Drafts", 1)
    add_para(doc, "Eight sea-level narratives are provided. The submitted count must remain equal to the sequence-diagram count in Section 8. Fields in gold are still team or sponsor decisions; all other text is ready for review and transfer into the official narrative template.")
    for idx, narrative in enumerate(NARRATIVES, start=1):
        heading(doc, f"7.{idx} {narrative['id']} - {narrative['name']}", 2)
        tables[0] += 1
        add_table_caption(doc, tables[0], f"{narrative['id']} narrative summary")
        add_table(doc, ["Field", "Draft content"], [
            ("Use-case level", narrative["level"]), ("Actors", narrative["actors"]),
            ("Stakeholders and interests", narrative["stakeholders"]), ("Brief description", narrative["brief"]),
            ("Preconditions", narrative["pre"]), ("Success postconditions", narrative["post"]),
            ("Related use cases", narrative["related"]),
        ], [2300, 7300], font_size=8.2)
        tables[0] += 1
        add_table_caption(doc, tables[0], f"{narrative['id']} main success scenario")
        add_table(doc, ["Actor action", "System responsibility"], narrative["steps"], [4200, 5400], font_size=8.1)
        tables[0] += 1
        add_table_caption(doc, tables[0], f"{narrative['id']} alternative and exception flows")
        add_table(doc, ["Condition", "Required response"], narrative["alts"], [3600, 6000], font_size=8.1)
    add_callout(doc, "Count control", f"Narratives: {len(NARRATIVES)}. Selected sequence diagrams: {len(SEQUENCE_SPECS)}. These counts match.")


def add_sequences(doc, figs):
    heading(doc, "8. Sequence Diagrams for Selected Narratives", 1)
    add_para(doc, "Each sequence follows the matching narrative and separates boundary UI, coordinating controller/service, logical entities and external systems. Messages describe responsibilities, not implementation method names that may change.")
    names = {n["id"]: n["name"] for n in NARRATIVES}
    for idx, (key, (participants, messages)) in enumerate(SEQUENCE_SPECS.items(), start=1):
        heading(doc, f"8.{idx} {key} - {names[key]}", 2)
        add_para(doc, f"This interaction realises the main success path of {key}. Guard failures return a safe rejection and do not partially commit domain state.")
        figs[0] += 1
        add_diagram(doc, draw_sequence_diagram(key.lower(), f"{key} - {names[key]}", participants, messages), figs[0], f"Sequence for {key} - {names[key]}")


def add_class_state(doc, figs, tables):
    heading(doc, "9. Analysis Class Model", 1)
    add_para(doc, "This is an analysis model, not a physical database design. Classes use singular business names, show meaningful attributes, and express associations and multiplicities without foreign keys, framework managers or UI components.")
    figs[0] += 1
    add_diagram(doc, draw_class_diagram(), figs[0], "CFA medium-level analysis class diagram", width=Inches(6.55))
    tables[0] += 1
    add_table_caption(doc, tables[0], "Analysis class dictionary")
    add_table(doc, ["Class", "Key attributes", "Responsibility"], CLASS_ROWS, [2200, 3600, 3800], font_size=7.8)
    heading(doc, "9.1 Multiplicity rules that must survive implementation", 2)
    for item in [
        "A Profile has zero or one current Membership and zero or many MembershipApplications.",
        "A Household composes one or more HouseholdMembers; a Profile may participate in zero or more household records over time.",
        "A FamilyLink joins one guardian Profile and one dependent Profile; only an Active link may activate a DependentBillingLink.",
        "A LessonSlot has zero or many Bookings. Each Booking has one actor/booker, one participant and zero or one Charge.",
        "An Invoice composes one or more InvoiceLines; each charge is invoiced at most once; an invoice may have zero or more attempts and receipts subject to idempotency.",
    ]:
        add_bullet(doc, item)
    heading(doc, "10. State Machines", 1)
    add_para(doc, "State diagrams are provided only for domain objects whose permitted behaviour depends materially on their current condition. State changes require an event, and guards/actions are shown where they carry a business rule.")
    for idx, (key, (title, states, transitions)) in enumerate(STATE_SPECS.items(), start=1):
        heading(doc, f"10.{idx} {title}", 2)
        figs[0] += 1
        add_diagram(doc, draw_state_diagram(key, title, states, transitions), figs[0], title)


def add_navigation(doc, figs, tables):
    heading(doc, "11. Website Navigation and Access Views", 1)
    add_para(doc, "Navigation diagrams are split by audience so access restrictions remain legible. Gold nodes are conditional or protected. Route guards and server-side permissions remain authoritative even when a link is hidden.")
    for idx, (key, (title, nodes, edges, restricted)) in enumerate(NAVIGATION_SPECS.items(), start=1):
        heading(doc, f"11.{idx} {title}", 2)
        figs[0] += 1
        add_diagram(doc, draw_navigation(key, title, nodes, edges, restricted), figs[0], title)
    tables[0] += 1
    add_table_caption(doc, tables[0], "Navigation notation and verification")
    add_table(doc, ["Notation", "Meaning", "Evidence to capture"], [
        ("Teal node", "Generally available within the diagram's audience.", "Screenshot and successful navigation."),
        ("Gold node", "Authentication, role, profile, membership or payer condition applies.", "Allowed and denied actor evidence."),
        ("Solid arrow", "Direct visible navigation.", "Link/button and destination."),
        ("Dashed arrow", "Redirect, return-to-task, or conditional transition.", "Original URL, guard result and safe destination."),
    ], [1800, 3900, 3900], font_size=8.2)


def add_risk(doc, tables):
    heading(doc, "12. CFA Risk Register and Probability-Impact Matrix", 1)
    add_para(doc, "Probability and impact use a five-point scale. Score equals probability x impact. Suggested bands: 1-4 Low, 5-9 Medium, 10-16 High, and 17-25 Critical. Rank should be reviewed whenever a trigger occurs.")
    add_landscape_section(doc)
    tables[0] += 1
    add_table_caption(doc, tables[0], "CFA-specific risk register")
    headers = ["ID", "Rank", "Risk", "P", "I", "Category", "Cause / trigger", "Owner", "Mitigation / contingency", "Status"]
    rows = []
    for r in RISK_ROWS:
        rows.append((r[0], r[1], r[2], r[4], r[5], r[6], f"{r[7]} | {r[8]}", r[9], f"{r[10]} | CONT: {r[11]}", r[12]))
    add_table(doc, headers, rows, [600, 650, 1900, 400, 400, 950, 2800, 1000, 3600, 900], font_size=6.6, landscape=True)
    tables[0] += 1
    add_table_caption(doc, tables[0], "Probability-impact matrix and action bands")
    probability_score = {"Rare": 1, "Low": 2, "Medium": 3, "High": 4, "Almost certain": 5}
    impact_score = {"Insignificant": 1, "Low": 2, "Moderate": 3, "High": 4, "Critical": 5}
    matrix_rows = []
    for impact in range(5, 0, -1):
        vals = [f"I={impact}"]
        for probability in range(1, 6):
            score = impact * probability
            band = "L" if score <= 4 else "M" if score <= 9 else "H" if score <= 16 else "C"
            ids = ", ".join(r[0] for r in RISK_ROWS if probability_score.get(r[4]) == probability and impact_score.get(r[5]) == impact)
            vals.append(f"{score} {band}" + (f"\n{ids}" if ids else ""))
        matrix_rows.append(tuple(vals))
    add_table(doc, ["Impact \\ Probability", "1 Rare", "2 Unlikely", "3 Possible", "4 Likely", "5 Almost certain"], matrix_rows, [1800, 2520, 2520, 2520, 2520, 2520], font_size=7.5, landscape=True)
    add_para(doc, "Risk review cadence: Review the top five risks at each group meeting. Move risks when probability or impact changes, record evidence in the task board, and activate contingency actions when a listed trigger occurs.", bold_prefix="Risk review cadence:")


def add_traceability_and_poe(doc, tables):
    add_landscape_section(doc)
    heading(doc, "13. End-to-End Traceability", 1)
    add_para(doc, "The matrix below is the integration control. Each objective crosses package, behavioural, structural, navigation and evidence views. Blank or contradictory cells identify incomplete work.")
    tables[0] += 1
    add_table_caption(doc, tables[0], "Objective-to-evidence traceability matrix")
    add_table(doc, ["Objective", "Pkg", "Use case", "Narrative", "Sequence", "Classes", "States", "Routes", "Evidence"], TRACE_ROWS, [1900, 850, 1300, 1300, 1300, 1900, 1400, 2600, 1950], font_size=6.8, landscape=True)
    add_portrait_section(doc)
    heading(doc, "14. Task Board and Portfolio of Evidence", 1)
    heading(doc, "14.1 Minimum task-board structure", 2)
    tables[0] += 1
    add_table_caption(doc, tables[0], "Recommended task-board columns and card fields")
    add_table(doc, ["Board item", "Required contents"], [
        ("Columns", "Backlog; Ready; In Progress; Review; Evidence Needed; Done; Blocked / Sponsor Decision."),
        ("Card title", "Artifact ID and action, for example BOOK-2 Review participant eligibility alternatives."),
        ("Card body", "Owner, reviewer, due date, rubric criterion, affected IDs, acceptance checks and evidence link."),
        ("Labels", "PDS, Risk, Activity, Package, Use Case, Narrative, Sequence, Class, State, Navigation, POE."),
        ("Done rule", "Reviewed, traceable, rubric checked, source editable, rendered cleanly, evidence attached."),
    ], [2200, 7400], font_size=8.4)
    add_callout(doc, "Task-board screenshot", "[INSERT CURRENT TASK BOARD SCREENSHOT] Include a full-board view and at least one opened card proving ownership, review, dates, acceptance criteria and evidence.", fill=PALE_GOLD, accent=GOLD)
    heading(doc, "14.2 Portfolio-of-evidence checklist", 2)
    checks = [
        "Repository baseline: commit/branch reference, 62-test result, lint result, build result and route inventory.",
        "Public journey: landing page, lesson availability, sign-up/sign-in and safe return to selected task.",
        "Membership: guest application, visible status, admin review, changes requested/resubmission, approval and lifecycle change.",
        "Family: neutral request response, incoming acceptance, rejection, active relationship and denied unauthorised view.",
        "Booking: public vs members-only, self vs dependent, capacity full, invalid participant and correct payer attribution.",
        "Billing: invoice generation, repeated idempotent run, participant lines, payer-only view, settlement and one receipt.",
        "Administration/security: role-denied routes, RLS/data-isolation checks, audit event and deactivated-account behaviour.",
        "Document quality: editable sources, captions, cross-references, updated contents, PDF render and per-page visual inspection.",
    ]
    for check in checks:
        add_bullet(doc, "☐ " + check)
    add_callout(doc, "Evidence naming", "Use M2_<artifact-or-usecase-ID>_<actor>_<expected-result>_<date>.<ext>. Example: M2_BOOK-2_dependent_members-only_denied_2026-08-05.png.")
    heading(doc, "14.3 Final submission gate", 2)
    for check in [
        "Every listed rubric artifact exists and has a completion check.",
        "The mark-sheet 110-versus-/100 question has been raised and documented.",
        "Narrative count equals sequence count: eight and eight in this baseline.",
        "Terminology, actors, IDs, classes, states, routes and business rules match throughout.",
        "Every figure and table is introduced, numbered, captioned and explained.",
        "No team-input field remains blank; screenshots are current and legible.",
        "Word fields and contents are updated; exported PDF pages are inspected for clipping and bad breaks.",
        "Official URS, use-case narrative and risk-matrix templates contain the approved copied content.",
    ]:
        add_bullet(doc, "☐ " + check)


def plantuml_sources():
    package = """@startuml\ntitle CFA Medium-Level Package Diagram\npackage \"Public Experience\" as PUB\npackage \"Identity & Profile\" as IAM\npackage Membership as MEM\npackage \"Family & Household\" as FAM\npackage \"Lesson Scheduling & Booking\" as BOOK\npackage \"Billing & Payments\" as BILL\npackage \"Administration & Audit\" as ADM\ncloud \"Supabase Auth\" as AUTH\ndatabase PostgreSQL as DB\ncloud Email\ncloud \"Google OAuth\" as GOOGLE\ncloud \"Payment Provider (planned)\" as PAY\nPUB ..> IAM\nMEM ..> IAM\nFAM ..> IAM\nBOOK ..> MEM\nBOOK ..> FAM\nBILL ..> BOOK\nBILL ..> MEM\nADM ..> MEM\nADM ..> FAM\nADM ..> BOOK\nADM ..> BILL\nIAM --> AUTH\nIAM --> Email\nIAM --> GOOGLE\nBILL ..> PAY\nADM --> DB\n@enduml"""
    activity = """@startuml\ntitle Whole-Platform To-Be Activity\nstart\n:Browse CFA and lessons;\nif (Account-required action?) then (yes)\n  :Create account or sign in;\n  :Complete profile;\nendif\nfork\n  :Apply for membership;\n  :Administrator reviews application;\nfork again\n  :Request/respond to family link;\nend fork\n:Choose self or linked dependent;\n:Validate participant eligibility and capacity;\nif (Eligible and available?) then (yes)\n  :Create booking and route charge;\n  :Generate invoice / record payment;\nelse (no)\n  :Reject safely with reason;\nendif\nstop\n@enduml"""
    sequences = {}
    for key, (participants, messages) in SEQUENCE_SPECS.items():
        aliases = []
        lines = ["@startuml", f"title {key} Sequence"]
        for idx, participant in enumerate(participants):
            alias = f"P{idx}"
            aliases.append(alias)
            lines.append(f'participant "{participant.replace(chr(10), " ")}" as {alias}')
        for src, dst, label, dashed in messages:
            token = "-->" if dashed else "->"
            lines.append(f"{aliases[src]} {token} {aliases[dst]} : {label}")
        lines.append("@enduml")
        sequences[key] = "\n".join(lines)
    states = {}
    for key, (title, state_names, transitions) in STATE_SPECS.items():
        lines = ["@startuml", f"title {title}", f"[*] --> {state_names[0].replace(' ', '_')}"]
        for src, dst, label in transitions:
            lines.append(f"{state_names[src].replace(' ', '_')} --> {state_names[dst].replace(' ', '_')} : {label}")
        lines.append(f"{state_names[-1].replace(' ', '_')} --> [*]")
        lines.append("@enduml")
        states[key] = "\n".join(lines)
    usecases = {}
    for key, (title, primary, secondary, cases, relations) in USE_CASE_DIAGRAMS.items():
        lines = ["@startuml", f"title {title}", "left to right direction"]
        left_aliases, right_aliases = [], []
        for idx, actor_name in enumerate(primary):
            alias = f"L{idx}"; left_aliases.append(alias)
            lines.append(f'actor "{actor_name}" as {alias}')
        for idx, actor_name in enumerate(secondary):
            alias = f"R{idx}"; right_aliases.append(alias)
            lines.append(f'actor "{actor_name}" as {alias}')
        lines.append('rectangle "CFA Platform" {')
        for idx, (uc_id, name) in enumerate(cases):
            lines.append(f'  usecase "{uc_id}\\n{name}" as UC{idx}')
        lines.append("}")
        for actor_idx, case_idx, side in relations:
            aliases = left_aliases if side == "L" else right_aliases
            if actor_idx < len(aliases):
                lines.append(f"{aliases[actor_idx]} --> UC{case_idx}")
        lines.append("@enduml")
        usecases[key] = "\n".join(lines)
    navigations = {}
    for key, (title, nodes, edges, restricted) in NAVIGATION_SPECS.items():
        lines = ["@startuml", f"title {title}", "left to right direction"]
        aliases = {}
        for idx, (node_id, label, _row) in enumerate(nodes):
            alias = f"N{idx}"; aliases[node_id] = alias
            stereotype = " <<restricted>>" if node_id in restricted else ""
            lines.append(f'rectangle "{label}" as {alias}{stereotype}')
        for src, dst, dashed, label in edges:
            token = "..>" if dashed else "-->"
            suffix = f" : {label}" if label else ""
            lines.append(f"{aliases[src]} {token} {aliases[dst]}{suffix}")
        lines.append("@enduml")
        navigations[key] = "\n".join(lines)
    class_source = """@startuml\ntitle CFA Analysis Class Diagram\nclass Profile\nclass MembershipType\nclass Membership\nclass MembershipApplication\nclass FamilyLink\nclass Household\nclass HouseholdMember\nclass DependentBillingLink\nclass LessonSlot\nclass Booking\nclass Charge\nclass Invoice\nclass InvoiceLine\nclass Receipt\nclass PaymentAttempt\nclass AuditEvent\nProfile \"1\" -- \"0..1\" Membership\nMembershipType \"1\" -- \"0..*\" Membership\nProfile \"1\" -- \"0..*\" MembershipApplication\nHousehold \"1\" *-- \"1..*\" HouseholdMember\nProfile \"1\" -- \"0..*\" HouseholdMember\nFamilyLink \"1\" -- \"0..1\" DependentBillingLink\nLessonSlot \"1\" -- \"0..*\" Booking\nBooking \"1\" -- \"0..1\" Charge\nCharge \"1\" -- \"0..1\" InvoiceLine\nInvoice \"1\" *-- \"1..*\" InvoiceLine\nInvoice \"1\" -- \"0..*\" Receipt\nInvoice \"1\" -- \"0..*\" PaymentAttempt\n@enduml"""
    return package, activity, sequences, states, class_source, usecases, navigations


def add_appendix(doc):
    heading(doc, "Appendix A. Editable Diagram Definitions", 1)
    add_para(doc, "The rendered diagrams in this handbook are precise review views. The definitions below are editable PlantUML-style sources. Paste a block into a PlantUML-compatible editor, adjust only after updating the shared registry, then replace the rendered figure and re-run consistency checks.")
    package, activity, sequences, states, class_source, usecases, navigations = plantuml_sources()
    heading(doc, "A.1 Package diagram source", 2)
    add_code_block(doc, package)
    heading(doc, "A.2 Activity diagram source", 2)
    add_code_block(doc, activity)
    heading(doc, "A.3 Sequence-diagram sources", 2)
    for key, source in sequences.items():
        heading(doc, f"A.3.{list(sequences).index(key) + 1} {key}", 3)
        add_code_block(doc, source)
    heading(doc, "A.4 State-machine sources", 2)
    for key, source in states.items():
        heading(doc, f"A.4.{list(states).index(key) + 1} {key}", 3)
        add_code_block(doc, source)
    heading(doc, "A.5 Analysis class source", 2)
    add_code_block(doc, class_source)
    heading(doc, "A.6 Use-case diagram sources", 2)
    for key, source in usecases.items():
        heading(doc, f"A.6.{list(usecases).index(key) + 1} {key}", 3)
        add_code_block(doc, source)
    heading(doc, "A.7 Navigation diagram sources", 2)
    for key, source in navigations.items():
        heading(doc, f"A.7.{list(navigations).index(key) + 1} {key}", 3)
        add_code_block(doc, source)
    heading(doc, "A.8 Editing rule", 2)
    add_para(doc, "When transferring these definitions to Visual Paradigm, draw.io or another UML editor, preserve IDs, actors, route labels, access restrictions and subsystem boundaries exactly. Update the shared registry before changing a rendered figure.")
    heading(doc, "Appendix B. Source Basis and Team Inputs", 1)
    add_para(doc, "This handbook was synthesised from the current CFA repository, the official 2026 URS template, use-case narrative template, risk-matrix template, Milestone 2 marking sheet and slides, and the supplied 2019 and 2020 example submissions. Those source files were read only and were not modified.")
    add_callout(doc, "Remaining team-input fields", "Before submission, replace only the explicitly marked team metadata fields, owner/reviewer assignments, sponsor decisions, deadline/budget, and task-board/evidence screenshots. Do not leave any other placeholder text.", fill=PALE_GOLD, accent=GOLD)
    for item in [
        "[TEAM TO COMPLETE] Team name, team number, members, leader, sponsor and contact.",
        "[TEAM TO COMPLETE] Official deadline, budget assumption, task owners and reviewers.",
        "[INSERT CURRENT TASK BOARD SCREENSHOT] Full board and representative card.",
        "[INSERT CURRENT TEST EVIDENCE] Current commands, browser journeys and data-isolation evidence.",
        "[TEAM TO COMPLETE] Sponsor decisions listed in Section 1.4 and risk owners in Section 12.",
    ]:
        add_bullet(doc, item)


def build():
    BUILD_DIR.mkdir(parents=True, exist_ok=True)
    DIAGRAM_DIR.mkdir(parents=True, exist_ok=True)
    doc = Document()
    configure_document(doc)
    figures = [0]
    # Table 1 is the cover metadata table.
    tables = [1]
    add_cover(doc)
    add_front_matter(doc)
    add_scope_section(doc, figures, tables)
    add_rubric_section(doc, tables)
    add_workplan_section(doc, tables)
    add_package_activity(doc, figures, tables)
    add_use_case_section(doc, figures, tables)
    add_narratives(doc, tables)
    add_sequences(doc, figures)
    add_class_state(doc, figures, tables)
    add_navigation(doc, figures, tables)
    add_risk(doc, tables)
    add_traceability_and_poe(doc, tables)
    add_appendix(doc)
    configure_headers(doc)
    core = doc.core_properties
    core.title = "CFA Milestone 2 Group Master Handbook"
    core.subject = "INF3003W Milestone 2 system analysis and group submission guide"
    core.keywords = "CFA, Milestone 2, URS, use case, UML, risk, traceability"
    core.comments = "Internal group master handbook. Source templates unchanged."
    doc.save(OUT)
    print(f"Created {OUT}")
    print(f"Figures: {figures[0]} | Tables: {tables[0]} | Narratives: {len(NARRATIVES)} | Sequences: {len(SEQUENCE_SPECS)} | States: {len(STATE_SPECS)}")


if __name__ == "__main__":
    build()
