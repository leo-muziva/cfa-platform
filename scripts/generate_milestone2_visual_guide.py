from __future__ import annotations

import math
import textwrap
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont
from docx import Document
from docx.enum.table import WD_CELL_VERTICAL_ALIGNMENT, WD_TABLE_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Cm, Inches, Pt, RGBColor


ROOT = Path(__file__).resolve().parents[1]
BUILD_DIR = ROOT / "tmp" / "milestone2-visual-guide"
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

# A4 override for the standard_business_brief preset.
CONTENT_DXA = 10180


def rgb(value: str) -> RGBColor:
    return RGBColor.from_string(value)


def font_path(bold=False):
    candidates = [
        r"C:\Windows\Fonts\calibrib.ttf" if bold else r"C:\Windows\Fonts\calibri.ttf",
        r"C:\Windows\Fonts\arialbd.ttf" if bold else r"C:\Windows\Fonts\arial.ttf",
    ]
    for candidate in candidates:
        if Path(candidate).exists():
            return candidate
    raise FileNotFoundError("Diagram font unavailable")


def img_font(size, bold=False):
    return ImageFont.truetype(font_path(bold), size=size)


def set_run(run, size=11, color=INK, bold=False, italic=False, name="Calibri"):
    run.font.name = name
    fonts = run._element.get_or_add_rPr().get_or_add_rFonts()
    fonts.set(qn("w:ascii"), name)
    fonts.set(qn("w:hAnsi"), name)
    run.font.size = Pt(size)
    run.font.color.rgb = rgb(color)
    run.bold = bold
    run.italic = italic


def shade(cell, fill):
    tc_pr = cell._tc.get_or_add_tcPr()
    shd = tc_pr.find(qn("w:shd"))
    if shd is None:
        shd = OxmlElement("w:shd")
        tc_pr.append(shd)
    shd.set(qn("w:fill"), fill)


def margins(cell, top=90, start=130, bottom=90, end=130):
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


def geometry(table, widths):
    table.autofit = False
    table.alignment = WD_TABLE_ALIGNMENT.LEFT
    tbl_pr = table._tbl.tblPr
    tbl_w = tbl_pr.find(qn("w:tblW"))
    if tbl_w is None:
        tbl_w = OxmlElement("w:tblW")
        tbl_pr.append(tbl_w)
    tbl_w.set(qn("w:w"), str(sum(widths)))
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
    for width in widths:
        node = OxmlElement("w:gridCol")
        node.set(qn("w:w"), str(width))
        grid.append(node)
    for row in table.rows:
        for index, cell in enumerate(row.cells):
            width = widths[min(index, len(widths) - 1)]
            tc_pr = cell._tc.get_or_add_tcPr()
            tc_w = tc_pr.find(qn("w:tcW"))
            if tc_w is None:
                tc_w = OxmlElement("w:tcW")
                tc_pr.append(tc_w)
            tc_w.set(qn("w:w"), str(width))
            tc_w.set(qn("w:type"), "dxa")
            margins(cell)
            cell.vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.CENTER


def repeat_header(row):
    tr_pr = row._tr.get_or_add_trPr()
    node = OxmlElement("w:tblHeader")
    node.set(qn("w:val"), "true")
    tr_pr.append(node)


def cell_text(cell, text, size=8.5, bold=False, color=INK, align=WD_ALIGN_PARAGRAPH.LEFT):
    cell.text = ""
    p = cell.paragraphs[0]
    p.alignment = align
    p.paragraph_format.space_after = Pt(0)
    p.paragraph_format.line_spacing = 1.05
    set_run(p.add_run(str(text)), size=size, bold=bold, color=color)


def add_table(doc, headers, rows, widths, size=8.3):
    table = doc.add_table(rows=1, cols=len(headers))
    geometry(table, widths)
    repeat_header(table.rows[0])
    for i, header in enumerate(headers):
        cell_text(table.rows[0].cells[i], header, size=size, bold=True, color=WHITE)
        shade(table.rows[0].cells[i], NAVY)
    for row_index, values in enumerate(rows):
        cells = table.add_row().cells
        for i, value in enumerate(values):
            align = WD_ALIGN_PARAGRAPH.CENTER if len(headers) > 1 and i == 1 and len(str(value)) < 12 else WD_ALIGN_PARAGRAPH.LEFT
            cell_text(cells[i], value, size=size, bold=(i == 0), align=align)
            if row_index % 2:
                shade(cells[i], "F7F6FA")
    p = doc.add_paragraph()
    p.paragraph_format.space_after = Pt(1)
    return table


def para(doc, text="", size=11, color=INK, bold=False, italic=False, after=6, align=None):
    p = doc.add_paragraph()
    p.paragraph_format.space_after = Pt(after)
    p.paragraph_format.line_spacing = 1.10
    if align is not None:
        p.alignment = align
    set_run(p.add_run(text), size=size, color=color, bold=bold, italic=italic)
    return p


def bullet(doc, text, after=3):
    p = doc.add_paragraph(style="List Bullet")
    p.paragraph_format.space_after = Pt(after)
    p.paragraph_format.line_spacing = 1.10
    set_run(p.add_run(text), size=10.5)
    return p


def number(doc, text, after=3):
    p = doc.add_paragraph(style="List Number")
    p.paragraph_format.space_after = Pt(after)
    p.paragraph_format.line_spacing = 1.10
    set_run(p.add_run(text), size=10.5)
    return p


def heading(doc, text, level=1):
    p = doc.add_heading(text, level=level)
    p.paragraph_format.keep_with_next = True
    return p


def callout(doc, title, body, fill=PALE_TEAL, accent=TEAL):
    table = doc.add_table(rows=1, cols=1)
    geometry(table, [CONTENT_DXA])
    cell = table.cell(0, 0)
    shade(cell, fill)
    margins(cell, top=130, start=180, bottom=130, end=180)
    cell.text = ""
    p = cell.paragraphs[0]
    p.paragraph_format.space_after = Pt(2)
    set_run(p.add_run(title), size=10, color=accent, bold=True)
    p2 = cell.add_paragraph()
    p2.paragraph_format.space_after = Pt(0)
    p2.paragraph_format.line_spacing = 1.08
    set_run(p2.add_run(body), size=9.5)
    para(doc, after=1)


def caption(doc, number, title):
    p = doc.add_paragraph(style="Caption")
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.paragraph_format.space_before = Pt(2)
    p.paragraph_format.space_after = Pt(5)
    set_run(p.add_run(f"Figure {number}: {title}"), size=8.5, color=MUTED, italic=True)


def set_alt_text(inline_shape, title, description):
    doc_pr = inline_shape._inline.docPr
    doc_pr.set("title", title)
    doc_pr.set("descr", description)


def add_image(doc, path, number, title, description, width=Inches(6.6)):
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.paragraph_format.keep_with_next = True
    shape = p.add_run().add_picture(str(path), width=width)
    set_alt_text(shape, title, description)
    caption(doc, number, title)


def page_break(doc):
    doc.add_page_break()


def page_title(doc, number, title, subtitle):
    p = doc.add_paragraph()
    p.paragraph_format.space_after = Pt(3)
    r = p.add_run(f"{number:02d}")
    set_run(r, size=11, color=GOLD, bold=True)
    r2 = p.add_run(f"  {title}")
    set_run(r2, size=18, color=NAVY, bold=True)
    para(doc, subtitle, size=10.5, color=MUTED, after=8)


def page_field(paragraph):
    run = paragraph.add_run()
    begin = OxmlElement("w:fldChar")
    begin.set(qn("w:fldCharType"), "begin")
    instr = OxmlElement("w:instrText")
    instr.set(qn("xml:space"), "preserve")
    instr.text = " PAGE "
    end = OxmlElement("w:fldChar")
    end.set(qn("w:fldCharType"), "end")
    run._r.extend([begin, instr, end])


def configure(doc):
    section = doc.sections[0]
    section.page_width, section.page_height = Cm(21.0), Cm(29.7)
    section.left_margin = section.right_margin = Cm(1.55)
    section.top_margin = Cm(1.45)
    section.bottom_margin = Cm(1.45)
    section.header_distance = Cm(0.7)
    section.footer_distance = Cm(0.7)
    styles = doc.styles
    normal = styles["Normal"]
    normal.font.name = "Calibri"
    normal.font.size = Pt(11)
    normal.font.color.rgb = rgb(INK)
    normal.paragraph_format.space_after = Pt(6)
    normal.paragraph_format.line_spacing = 1.10
    for level, size, color, before, after in [(1, 16, NAVY, 16, 8), (2, 13, TEAL, 12, 6), (3, 12, PURPLE, 8, 4)]:
        style = styles[f"Heading {level}"]
        style.font.name = "Calibri"
        style.font.size = Pt(size)
        style.font.bold = True
        style.font.color.rgb = rgb(color)
        style.paragraph_format.space_before = Pt(before)
        style.paragraph_format.space_after = Pt(after)
        style.paragraph_format.keep_with_next = True
    for name in ("List Bullet", "List Number"):
        style = styles[name]
        style.font.name = "Calibri"
        style.font.size = Pt(10.5)
        style.paragraph_format.left_indent = Inches(0.5)
        style.paragraph_format.first_line_indent = Inches(-0.25)
        style.paragraph_format.space_after = Pt(3)
        style.paragraph_format.line_spacing = 1.10
    styles["Caption"].font.name = "Calibri"
    styles["Caption"].font.size = Pt(8.5)
    styles["Caption"].font.italic = True
    styles["Caption"].font.color.rgb = rgb(MUTED)
    header = section.header.paragraphs[0]
    header.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    set_run(header.add_run("CFA  |  Milestone 2 Visual Group Guide"), size=8, color=MUTED, bold=True)
    footer = section.footer.paragraphs[0]
    footer.alignment = WD_ALIGN_PARAGRAPH.CENTER
    set_run(footer.add_run("Internal group guide  |  "), size=8, color=MUTED)
    page_field(footer)
    update = OxmlElement("w:updateFields")
    update.set(qn("w:val"), "true")
    doc.settings._element.append(update)


def wrap(text, chars):
    return textwrap.wrap(text, width=chars, break_long_words=False) or [""]


def centered(draw, xy, text, font, fill="#243447", gap=4):
    x1, y1, x2, y2 = xy
    chars = max(10, int((x2 - x1) / max(10, font.size * 0.56)))
    lines = wrap(text, chars)
    heights = [draw.textbbox((0, 0), line, font=font)[3] for line in lines]
    total = sum(heights) + gap * (len(lines) - 1)
    y = y1 + (y2 - y1 - total) / 2
    for line, h in zip(lines, heights):
        bb = draw.textbbox((0, 0), line, font=font)
        draw.text((x1 + (x2 - x1 - (bb[2] - bb[0])) / 2, y), line, font=font, fill=fill)
        y += h + gap


def box(draw, xy, text, fill="#F4F1FA", outline="#2D176B", size=24, bold=False, radius=16):
    draw.rounded_rectangle(xy, radius=radius, fill=fill, outline=outline, width=3)
    centered(draw, xy, text, img_font(size, bold), fill="#243447")


def arrow(draw, start, end, color="#625B73", width=4, dashed=False):
    x1, y1 = start
    x2, y2 = end
    if dashed:
        for i in range(0, 14, 2):
            a, b = i / 14, min((i + 1) / 14, 1)
            draw.line((x1 + (x2 - x1) * a, y1 + (y2 - y1) * a, x1 + (x2 - x1) * b, y1 + (y2 - y1) * b), fill=color, width=width)
    else:
        draw.line((x1, y1, x2, y2), fill=color, width=width)
    angle = math.atan2(y2 - y1, x2 - x1)
    head = 16
    pts = [(x2, y2), (x2 - head * math.cos(angle - .5), y2 - head * math.sin(angle - .5)), (x2 - head * math.cos(angle + .5), y2 - head * math.sin(angle + .5))]
    draw.polygon(pts, fill=color)


def canvas(title, width=1800, height=850):
    im = Image.new("RGB", (width, height), "white")
    d = ImageDraw.Draw(im)
    d.rectangle((0, 0, width, 82), fill="#25145C")
    d.text((36, 18), title, font=img_font(38, True), fill="white")
    return im, d


def save(im, name):
    path = DIAGRAM_DIR / f"{name}.png"
    im.save(path, dpi=(180, 180))
    return path


def artifact_flow():
    im, d = canvas("How the Milestone 2 artifacts connect", height=720)
    groups = [
        ("1. DEFINE", "Project definition\nRisk matrix", PALE_GOLD, GOLD),
        ("2. SCOPE", "Activity diagram\nPackage diagram", PALE, PURPLE),
        ("3. DESCRIBE", "Use cases\nNarratives", PALE_TEAL, TEAL),
        ("4. MODEL", "Sequence, class\nand state diagrams", PALE, PURPLE),
        ("5. PROVE", "Navigation\nTask board + evidence", PALE_GOLD, GOLD),
    ]
    x = 40
    for i, (label, body, fill, outline) in enumerate(groups):
        box(d, (x, 190, x + 300, 500), f"{label}\n\n{body}", fill=f"#{fill}", outline=f"#{outline}", size=24, bold=True)
        if i < len(groups) - 1:
            arrow(d, (x + 304, 345), (x + 350, 345), color="#007C83")
        x += 350
    d.text((60, 590), "Each view must tell the same business story.", font=img_font(28, True), fill="#25145C")
    return save(im, "01-artifact-flow")


def actor_map():
    im, d = canvas("CFA business actors", height=850)
    actors = [
        ("Visitor", "Browses CFA and lessons"), ("Account holder", "Signs in and manages a profile"),
        ("Member", "Has an approved active membership"), ("Guardian / payer", "Manages agreed family and payment duties"),
        ("Dependent", "Has a separate account and linked guardian"), ("Coach", "Supports lesson operations"),
        ("Administrator", "Reviews and manages CFA records"),
    ]
    positions = [(70,160),(620,160),(1170,160),(70,380),(620,380),(1170,380),(620,600)]
    for (title, detail), (x, y) in zip(actors, positions):
        box(d, (x, y, x + 500, y + 160), f"{title}\n{detail}", fill="#E8F3F3" if title in {"Visitor","Account holder","Member"} else "#FFF8E0", outline="#007C83" if title in {"Visitor","Account holder","Member"} else "#D2A800", size=23, bold=True)
    return save(im, "02-actor-map")


def activity_diagram():
    im, d = canvas("Whole-business To-Be activity", width=1900, height=950)
    lanes = ["Visitor / account", "Guardian / dependent", "CFA staff", "CFA system"]
    lane_w = 450
    for i, lane in enumerate(lanes):
        x = 45 + i * lane_w
        d.rectangle((x, 120, x + lane_w, 900), outline="#B7AFC8", width=2, fill="#FFFFFF" if i % 2 == 0 else "#FAF9FD")
        d.rectangle((x, 120, x + lane_w, 175), fill="#2D176B")
        centered(d, (x,120,x+lane_w,175), lane, img_font(22, True), fill="white")
    nodes = [
        (100,230,"Browse information\nand lesson availability"), (100,410,"Create account / sign in"),
        (100,590,"Apply for membership\nor choose a lesson"), (550,590,"Select self or linked\ndependent"),
        (1000,230,"Publish lesson slots"), (1000,410,"Review membership\napplication"),
        (1450,590,"Check eligibility\nand capacity"), (1450,760,"Confirm booking and\nrecord amount due"),
    ]
    for x,y,text in nodes:
        box(d,(x,y,x+350,y+105),text,fill="#F4F1FA",size=20)
    d.ellipse((230,190,290,250),fill="#243447")
    flows=[((260,250),(275,230)),((275,335),(275,410)),((275,515),(275,590)),((450,642),(550,642)),((900,642),(1450,642)),((1275,335),(1625,590)),((1275,515),(1625,590)),((1625,695),(1625,760))]
    for a,b in flows: arrow(d,a,b,width=3)
    d.text((1410,700),"[eligible and space available]",font=img_font(17),fill="#18794E")
    d.text((1410,840),"[not eligible or full] explain and stop",font=img_font(17),fill="#B42318")
    return save(im,"03-activity")


def package_diagram():
    im, d = canvas("Medium-level package diagram", width=1900, height=950)
    names = ["Public Experience","Identity & Profile","Membership","Family & Household","Lesson Scheduling & Booking","Billing & Payments","Administration & Audit"]
    pos = [(70,180),(555,180),(1040,180),(70,440),(555,440),(1040,440),(555,700)]
    centers={}
    for name,(x,y) in zip(names,pos):
        box(d,(x,y,x+390,y+140),name,fill="#F4F1FA",size=22,bold=True)
        centers[name]=(x+195,y+70)
    deps=[("Public Experience","Identity & Profile"),("Membership","Identity & Profile"),("Family & Household","Identity & Profile"),("Lesson Scheduling & Booking","Membership"),("Lesson Scheduling & Booking","Family & Household"),("Billing & Payments","Lesson Scheduling & Booking"),("Administration & Audit","Membership"),("Administration & Audit","Billing & Payments")]
    for a,b in deps: arrow(d,centers[a],centers[b],color="#9A90AD",width=2,dashed=True)
    box(d,(1500,260,1825,390),"Payment service\n(external)",fill="#E8F3F3",outline="#007C83",size=21)
    box(d,(1500,520,1825,650),"Database\n(external)",fill="#E8F3F3",outline="#007C83",size=21)
    arrow(d,(1430,510),(1500,325),color="#007C83",width=3)
    arrow(d,(945,770),(1500,585),color="#007C83",width=3)
    return save(im,"04-package")


def usecase_overview():
    im, d = canvas("Use cases by subsystem", width=1900, height=900)
    rows = [
        ("Public", "Browse CFA; view lessons"), ("Identity", "Create account; sign in; maintain profile"),
        ("Membership", "Apply; resubmit; review; change status"), ("Family", "Request link; accept/reject; end link"),
        ("Booking", "Create slot; book lesson; view history"), ("Billing", "Generate invoice; view billing; record payment"),
        ("Administration", "Manage accounts; review dashboard"),
    ]
    for i,(name,cases) in enumerate(rows):
        y=130+i*103
        box(d,(80,y,390,y+78),name,fill="#25145C",outline="#25145C",size=21,bold=True)
        centered(d,(80,y,390,y+78),name,img_font(21,True),fill="white")
        box(d,(430,y,1780,y+78),cases,fill="#F4F1FA",size=21)
    return save(im,"05-usecases")


def sequence_diagram():
    im, d = canvas("BOOK-2 sequence - Book lesson", width=1900, height=820)
    participants=["Booker","Booking page","Booking controller","Lesson slot","Participant","Booking"]
    xs=[110,430,750,1070,1390,1710]
    for x,name in zip(xs,participants):
        box(d,(x-105,120,x+105,190),name,fill="#E8F3F3" if name in {"Booker","Booking page"} else "#F4F1FA",size=17,bold=True)
        d.line((x,190,x,760),fill="#A49BB2",width=2)
    messages=[(0,1,"choose lesson and participant"),(1,2,"request booking"),(2,3,"check space"),(3,2,"space available"),(2,4,"check participant eligibility"),(4,2,"eligible"),(2,5,"create booking"),(5,2,"confirmed"),(2,1,"show confirmation")]
    y=250
    for src,dst,label in messages:
        dashed=dst<src
        arrow(d,(xs[src],y),(xs[dst],y),color="#2D176B",width=2,dashed=dashed)
        centered(d,(min(xs[src],xs[dst])+4,y-38,max(xs[src],xs[dst])-4,y-4),label,img_font(14),fill="#243447",gap=1)
        y+=53
    return save(im,"06-sequence")


def class_diagram():
    im, d = canvas("Simplified analysis class example", width=1900, height=820)
    classes=[("Profile",["name","account status"]),("Membership",["type","status"]),("FamilyLink",["status","accepted date"]),("LessonSlot",["date/time","capacity","access rule"]),("Booking",["status","payment choice"]),("Charge",["amount","status"]),("Invoice",["number","period","status"])]
    positions=[(60,160),(500,160),(940,160),(60,500),(500,500),(940,500),(1380,500)]
    centers={}
    for (name,attrs),(x,y) in zip(classes,positions):
        d.rectangle((x,y,x+350,y+190),fill="white",outline="#2D176B",width=3)
        d.rectangle((x,y,x+350,y+55),fill="#2D176B")
        centered(d,(x,y,x+350,y+55),name,img_font(21,True),fill="white")
        for j,attr in enumerate(attrs): d.text((x+20,y+78+j*42),attr,font=img_font(18),fill="#243447")
        centers[name]=(x+175,y+95)
    links=[("Profile","Membership","1 to 0..1"),("Profile","FamilyLink","1 to 0..*"),("LessonSlot","Booking","1 to 0..*"),("Profile","Booking","participant"),("Booking","Charge","1 to 0..1"),("Charge","Invoice","0..* to 0..1")]
    for a,b,label in links:
        arrow(d,centers[a],centers[b],color="#9A90AD",width=2)
        x=(centers[a][0]+centers[b][0])/2; y=(centers[a][1]+centers[b][1])/2
        d.rectangle((x-70,y-14,x+70,y+14),fill="white")
        centered(d,(x-70,y-14,x+70,y+14),label,img_font(13),fill="#625B73")
    return save(im,"07-class")


def state_diagram():
    im, d = canvas("Booking state machine", width=1900, height=500)
    d.ellipse((90,260,145,315),fill="#243447")
    states=[("Upcoming",320),("Attended",900),("Cancelled",1480)]
    for name,x in states: box(d,(x,230,x+260,345),name,fill="#F4F1FA",size=24,bold=True)
    arrow(d,(145,287),(320,287),width=3)
    arrow(d,(580,260),(900,260),width=3)
    d.text((650,220),"lesson completed",font=img_font(17),fill="#243447")
    arrow(d,(580,325),(1480,325),width=3)
    d.text((910,345),"cancel [policy permits]",font=img_font(17),fill="#243447")
    d.ellipse((1770,260,1830,320),fill="white",outline="#243447",width=4)
    d.ellipse((1783,273,1817,307),fill="#243447")
    return save(im,"08-state")


def navigation_diagram():
    im, d = canvas("Website navigation by audience", width=1900, height=720)
    lanes=[("PUBLIC",140,["Home","CFA information","Lesson availability","Sign in"]),("ACCOUNT",330,["Account home","Profile","Membership","Family","Lessons","Billing"]),("STAFF",520,["Staff home","Applications","Lesson planning","Payments","Reports"])]
    for label,y,pages in lanes:
        d.text((45,y+25),label,font=img_font(22,True),fill="#25145C")
        gap=1500/max(1,len(pages))
        centers=[]
        for i,page in enumerate(pages):
            x=250+i*gap
            box(d,(x,y,x+220,y+90),page,fill="#E8F3F3" if label=="PUBLIC" else "#FFF8E0" if label=="STAFF" else "#F4F1FA",outline="#007C83" if label=="PUBLIC" else "#D2A800" if label=="STAFF" else "#2D176B",size=17)
            centers.append((x+110,y+45))
        for a,b in zip(centers,centers[1:]): arrow(d,a,b,width=2)
    d.text((1420,645),"Gold = staff access",font=img_font(17),fill="#7A5A00")
    return save(im,"09-navigation")


def page_one(doc):
    para(doc, "INF3003W  |  MILESTONE 2", size=11, color=GOLD, bold=True, after=2)
    para(doc, "CFA Milestone 2\nVisual Group Guide", size=29, color=NAVY, bold=True, after=6)
    para(doc, "A short guide to the business analysis work your group must submit.", size=13, color=MUTED, after=12)
    add_table(doc, ["Team", "Team no.", "Submission date"], [["[TEAM TO COMPLETE]", "[TEAM TO COMPLETE]", "[TEAM TO COMPLETE]"]], [4300,2500,3380], size=9)
    callout(doc, "Use this guide first", "Agree on the CFA background, actors and scope before splitting the diagrams. The official templates remain the final submission format.")
    add_image(doc, artifact_flow(), 1, "How the Milestone 2 artifacts connect", "Five stages connect the project definition and risk work to scope diagrams, use cases, UML models, navigation, task tracking and evidence.", width=Inches(6.7))
    heading(doc, "Three group rules", 2)
    bullet(doc, "Use the same actor, subsystem, use-case and class names everywhere.")
    bullet(doc, "A narrative and its sequence diagram must describe the same events.")
    bullet(doc, "Model the proposed business system, not the development process.")


def page_two(doc):
    page_title(doc, 2, "CFA Business Background", "The shared story every diagram must tell.")
    para(doc, "Cape Flitz Archery needs one web-based service where people can learn about CFA, manage membership, arrange family relationships, book lessons and handle related payments. CFA staff need clear processes for reviewing membership, planning lessons and maintaining accurate records.")
    heading(doc, "Agreed To-Be scope", 2)
    add_table(doc, ["Included", "Not part of this milestone guide"], [
        ("Public CFA information and lesson availability", "Development tasks and technical design"),
        ("Accounts, profiles and membership applications", "Equipment inventory or tournament management"),
        ("Guardian-dependent links and lesson booking", "Payroll or full accounting replacement"),
        ("Amounts due, invoices, payments and receipts", "Unconfirmed sponsor ideas presented as facts"),
        ("Staff review, lesson planning and oversight", "Anything outside the agreed CFA business problem"),
    ], [5100,5080], size=8.5)
    add_image(doc, actor_map(), 2, "CFA business actors", "Seven business actors: visitor, account holder, member, guardian or payer, dependent, coach and administrator.", width=Inches(6.55))
    callout(doc, "Sponsor decisions still needed", "Confirm membership products, lesson cancellation and no-show rules, family-payment responsibilities, payment method, and final privacy/terms wording.", fill=PALE_GOLD, accent=GOLD)


def page_three(doc):
    page_title(doc, 3, "Milestone 2 Checklist", "The marking sheet asks for 12 connected artifacts.")
    rows=[
        ("Project Definition Statement","5","Goal, objectives, priorities, assumptions, deadline, budget and legal/ethical issues."),
        ("Risk Matrix","10","Project-specific risks with probability, impact, cause, trigger, owner and responses."),
        ("To-Be Activity Diagram","10","Whole business process with actors, swimlanes, decisions and guards."),
        ("Medium-level Package Diagram","10","Subsystems, dependencies and external systems."),
        ("Use Case Diagrams","10","One per subsystem; numbered sea-level and fish-level use cases."),
        ("Use Case Narratives","10","At least five core functions using the official narrative structure."),
        ("Analysis Class Diagram","10","Business classes, attributes, relationships and multiplicities."),
        ("Sequence Diagrams","10","One sequence for every submitted narrative."),
        ("State Machine Diagrams","10","States and triggers for important stateful business objects."),
        ("Website Navigation Diagram","10","Pages, links and access restrictions."),
        ("Updated Task Board","5","Completed, assigned, delayed, moved and new tasks with progress explanation."),
        ("Portfolio of Evidence","10","Evidence that supports decisions, progress and completed work."),
    ]
    add_table(doc,["Artifact","Marks","What markers expect"],rows,[3000,750,6430],size=7.7)
    callout(doc,"Check the total","The listed sections add to 110, although the sheet displays /100. Ask the lecturer how the final mark is normalised; complete every listed artifact.",fill=PALE_GOLD,accent=GOLD)
    heading(doc,"Use the examples properly",2)
    para(doc,"The 2019 and 2020 groups introduce each artifact, caption the diagram and explain what it shows. Copy that discipline, not their project actors or content.",size=10)


def page_four(doc):
    page_title(doc,4,"Project Definition and Risk","Define the business problem before drawing the solution.")
    heading(doc,"Project definition draft",2)
    para(doc,"CFA will use a web-based information system to provide public information, manage individual membership, support agreed family relationships, arrange lesson bookings and maintain related payment records. The system will give authorised CFA staff clear processes while protecting personal and financial information.",size=10.5)
    add_table(doc,["Area","Working content"],[
        ("Objectives","Make CFA information and lesson availability easy to find; support membership applications; manage family links; book lessons; maintain accurate payment records."),
        ("Priority","1 Schedule  |  2 Quality  |  3 Cost - confirm with the group."),
        ("Deadline / budget","[TEAM TO COMPLETE]"),
        ("Assumptions","Users have internet access; CFA staff review applications and schedules; sponsor decisions will be supplied in time."),
        ("Legal / ethical","Protect personal and financial information; obtain consent for family links; use approved privacy and terms wording."),
    ],[2300,7880],size=8.3)
    heading(doc,"Five risks to carry into the official matrix",2)
    risks=[
        ("Different group interpretations","High","Lock one scope and glossary. If conflict appears, pause affected diagrams and resolve it together."),
        ("Sponsor rules remain unclear","High","Record questions and assumptions. If unanswered, label the rule as pending rather than inventing it."),
        ("Scope keeps expanding","High","Use the agreed To-Be boundary. Move new ideas to a future-work list."),
        ("Diagrams contradict each other","Medium","Review names and flows across use cases, narratives, sequences, classes and states."),
        ("Work or evidence is late","Medium","Use owners, reviewers and due dates. Reassign work when a task-board trigger is reached."),
    ]
    add_table(doc,["Risk","Rating","Mitigation and contingency"],risks,[2900,900,6380],size=7.9)
    callout(doc,"Finish in the official templates","Add rank, probability, impact, category, cause, trigger, owner, mitigation, contingency and status for every risk.")


def page_five(doc):
    page_title(doc,5,"Activity and Package Diagrams","Show the business flow first, then the system boundary.")
    add_image(doc,activity_diagram(),3,"Whole-business To-Be activity diagram","Swimlanes show how visitors, family members, staff and the CFA system participate in membership and lesson booking.",width=Inches(6.45))
    add_image(doc,package_diagram(),4,"CFA medium-level package diagram","Seven CFA business subsystems and their dependencies, with the payment service and database shown outside the system boundary.",width=Inches(6.45))
    add_table(doc,["Do","Do not"],[
        ("Activity: use one whole-business flow, swimlanes and guarded decisions.","Show development work, technical tiers or page-to-page navigation."),
        ("Package: show business subsystems, dependencies and external systems.","Treat actors as packages or place the database inside the CFA system."),
    ],[5090,5090],size=8.1)


def page_six(doc):
    page_title(doc,6,"Use Cases","Describe what each actor wants the proposed system to do.")
    callout(doc,"Sea level vs fish level","Sea-level use cases complete a meaningful user goal, such as Book Lesson. Fish-level use cases support another use case and normally do not stand alone, such as Check Participant Eligibility.")
    add_image(doc,usecase_overview(),5,"CFA use cases grouped by subsystem","Seven subsystem rows list the principal business use cases that should be expanded into separate use-case diagrams.",width=Inches(6.45))
    heading(doc,"Minimum core narrative set",2)
    para(doc,"Choose at least five significant sea-level functions. A balanced CFA set is:",size=10)
    add_table(doc,["ID","Core function","Why it matters"],[
        ("MEM-1","Submit membership application","Starts the membership process."),
        ("MEM-3","Review membership application","Shows a staff decision and alternatives."),
        ("FAM-1","Request family link","Captures consent and relationship rules."),
        ("BOOK-2","Book lesson","Connects participant, eligibility and capacity."),
        ("BILL-1","Generate invoice","Shows how lesson amounts become payer records."),
    ],[1200,3500,5480],size=8.1)
    callout(doc,"Submission rule","Create a use-case diagram for each subsystem. Give every diagram an ID, number every use case, place primary actors on the left and secondary actors on the right.",fill=PALE_GOLD,accent=GOLD)


def page_seven(doc):
    page_title(doc,7,"Worked Narrative: BOOK-2 Book Lesson","Use this as the pattern for the other selected narratives.")
    add_table(doc,["Field","BOOK-2 draft"],[
        ("Primary actor","Account holder, guardian or dependent"),
        ("Purpose","Reserve a place in an available lesson for the account holder or an agreed linked dependent."),
        ("Preconditions","The actor is signed in; the lesson is open; the chosen participant is permitted."),
        ("Postconditions","A confirmed booking identifies the lesson and participant; any amount due is assigned correctly."),
        ("Cross-references","Check Participant Eligibility; View Lesson History; Generate Invoice."),
    ],[2300,7880],size=8.4)
    heading(doc,"Typical course of events",2)
    steps=[
        ("1. Select an available lesson.","1.1 Show the lesson details and available places."),
        ("2. Sign in if needed.","2.1 Return to the selected lesson."),
        ("3. Choose the participant.","3.1 Show only the actor and agreed linked dependents."),
        ("4. Confirm the booking.","4.1 Check the participant's eligibility and lesson capacity."),
        ("5. Review the result.","5.1 Create the booking and show confirmation."),
    ]
    add_table(doc,["Actor action","System response"],steps,[4750,5430],size=8.3)
    heading(doc,"Alternative courses",2)
    add_table(doc,["Condition","Response"],[
        ("Lesson is full or closed","Stop and show another available lesson."),
        ("Participant does not meet the access rule","Explain that the selected participant cannot book this lesson."),
        ("Participant is not an agreed linked dependent","Do not allow the booking; return to participant selection."),
    ],[4300,5880],size=8.3)
    callout(doc,"Narrative checklist","Include name, ID, actors, purpose, preconditions, postconditions, typical course, alternatives and cross-references. Keep actor actions separate from system responses.")


def page_eight(doc):
    page_title(doc,8,"Sequence and Class Diagrams","Show one use case over time and the business objects it uses.")
    add_image(doc,sequence_diagram(),6,"BOOK-2 sequence diagram","The booker interacts with a booking page, controller and business entities to check a lesson and participant before creating a booking.",width=Inches(6.55))
    para(doc,"Boundary/interface represents what the actor interacts with. Controller coordinates the use case. Entity objects hold the business information used by the interaction.",size=9.5,color=MUTED)
    add_image(doc,class_diagram(),7,"Simplified CFA analysis class example","A business-level class model linking profiles, membership, family links, lesson slots, bookings, charges and invoices with multiplicities.",width=Inches(6.55))
    callout(doc,"Two marking rules","Provide one sequence diagram for every narrative. In the class diagram, use business classes with attributes, relationships and multiplicities; do not turn it into a data-storage design.",fill=PALE_GOLD,accent=GOLD)


def page_nine(doc):
    page_title(doc,9,"State and Website Navigation","Model how an object changes and how each audience moves through pages.")
    add_image(doc,state_diagram(),8,"Booking state machine example","A booking starts as Upcoming and changes to Attended when the lesson is completed or Cancelled when policy permits.",width=Inches(6.45))
    callout(doc,"Other state candidates","Consider Membership Application, Membership, Family Link, Invoice and Payment Attempt. Only draw a state machine where the object's current state changes what may happen next.")
    add_image(doc,navigation_diagram(),9,"Website navigation by audience","Public, signed-in account and staff lanes show page names, direct movement and access separation without technical addresses.",width=Inches(6.45))
    add_table(doc,["Do","Do not"],[
        ("State: name conditions and label transitions with events or guards.","Draw another activity process or use action names as states."),
        ("Navigation: show every important page, link and access restriction.","Use technical addresses or assume hidden links provide security."),
    ],[5090,5090],size=8.0)


def page_ten(doc):
    page_title(doc,10,"Task Board and Evidence","Show how the group worked, not only what it produced.")
    heading(doc,"Updated task board",2)
    for text in [
        "Show tasks completed, assigned, delayed, moved forward, added and removed.",
        "Give each artifact an owner, reviewer, due date and completion check.",
        "Explain whether the group is on schedule and what changed since the previous milestone.",
        "Keep sponsor questions and blocked work visible until resolved.",
    ]: bullet(doc,text)
    callout(doc,"Screenshot field","[INSERT CURRENT TASK BOARD SCREENSHOT] Include the whole board and one representative card with owner, reviewer, date and completion check.",fill=PALE_GOLD,accent=GOLD)
    heading(doc,"Portfolio of evidence",2)
    evidence=[
        ("Scope decisions","Meeting notes or sponsor confirmation supporting the project definition and assumptions."),
        ("Diagram development","Drafts, review notes or comparison evidence showing how diagrams were refined."),
        ("Group progress","Task-board history, assignments, completed tasks and explanations for changes."),
        ("Consistency review","Evidence that names and flows match across narratives, sequences, classes and states."),
        ("Final quality","Updated contents, readable diagrams, captions and a page-by-page submission check."),
    ]
    add_table(doc,["Evidence area","What to include"],evidence,[3000,7180],size=8.4)
    callout(doc,"Evidence rule","Name the evidence, state what it proves and connect it to a Milestone 2 artifact. A screenshot without an explanation is weak evidence.")


def page_eleven(doc):
    page_title(doc,11,"Allocation and Final Gate","Split the work only after the shared model is agreed.")
    add_table(doc,["Workstream","Owner / reviewer","Completion check"],[
        ("Project definition + risk","[TEAM TO COMPLETE]","Scope, assumptions and risks approved."),
        ("Activity + package","[TEAM TO COMPLETE]","Whole process and seven subsystems agree."),
        ("Use-case diagrams","[TEAM TO COMPLETE]","One diagram per subsystem; IDs and actors consistent."),
        ("Narratives + sequences","[TEAM TO COMPLETE]","At least five pairs; every pair matches."),
        ("Class + state","[TEAM TO COMPLETE]","Business objects, multiplicities, states and triggers checked."),
        ("Navigation","[TEAM TO COMPLETE]","Pages and audience restrictions complete."),
        ("Task board + evidence","[TEAM TO COMPLETE]","Progress explanation and evidence attached."),
        ("Final integration","[TEAM TO COMPLETE]","Rubric, naming, captions and layout reviewed."),
    ],[3000,2800,4380],size=8.1)
    heading(doc,"Final submission gate",2)
    checks=[
        "All 12 marked artifacts are present in the official submission.",
        "At least five core narratives have matching sequence diagrams.",
        "Actors, subsystem names, use-case IDs, class names and states agree throughout.",
        "Every diagram is introduced, captioned and briefly explained.",
        "The activity diagram shows business processes only.",
        "The package diagram keeps external systems outside the CFA boundary.",
        "Task-board progress and portfolio evidence are current and explained.",
        "Team details, deadline, budget, sponsor decisions and screenshots are complete.",
    ]
    for text in checks: bullet(doc,text,after=2)
    callout(doc,"Source of truth","Use the 2026 URS template, marking sheet, Milestone 2 slides and official narrative/risk templates for the submitted work. The 2019 and 2020 examples show presentation patterns only.")
    para(doc,"This guide intentionally excludes development details that are not required by Milestone 2.",size=9.5,color=MUTED,italic=True,align=WD_ALIGN_PARAGRAPH.CENTER)


def build():
    BUILD_DIR.mkdir(parents=True,exist_ok=True)
    DIAGRAM_DIR.mkdir(parents=True,exist_ok=True)
    doc=Document()
    configure(doc)
    pages=[page_one,page_two,page_three,page_four,page_five,page_six,page_seven,page_eight,page_nine,page_ten,page_eleven]
    for i,fn in enumerate(pages):
        fn(doc)
        if i < len(pages)-1: page_break(doc)
    props=doc.core_properties
    props.title="CFA Milestone 2 Visual Group Guide"
    props.subject="INF3003W Milestone 2 business analysis guide"
    props.keywords="CFA, Milestone 2, URS, UML, risk, use case"
    props.comments="Internal group guide based only on official Milestone 2 requirements."
    doc.save(OUT)
    print(f"Created {OUT}")
    print("Target pages: 11 | Figures: 9 | Marked artifacts covered: 12")


if __name__ == "__main__":
    build()
