"""Rebuild the Database Design / Data Dictionary part of the M3 report from erd_spec.py.

Usage: python build_docx.py <original.docx> <erd.png> <output.docx>

Only these parts are rewritten; everything else is copied byte for byte:
  - ERD image (and a landscape page for it)
  - the entity-count paragraph under Scope and Methodology
  - the Principal Entity List table
  - the Data Dictionary headings and tables
  - the Legacy or Supporting Structures Excluded table
Existing table formatting (purple header, banded rows) is reused by cloning rows.
"""
import copy
import shutil
import struct
import sys
import tempfile
import zipfile
from pathlib import Path

from lxml import etree

from erd_spec import ENTITIES, SUBTYPES, SUBTYPE_NOTE, EXCLUDED

W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
W14 = "http://schemas.microsoft.com/office/word/2010/wordml"
WP = "http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"
A = "http://schemas.openxmlformats.org/drawingml/2006/main"
NS = {"w": W, "wp": WP, "a": A}


def q(tag):
    prefix, local = tag.split(":")
    return "{%s}%s" % ({"w": W, "w14": W14}[prefix], local)


def text_of(el):
    return "".join(el.itertext())


def strip_ids(el):
    for e in el.iter():
        for att in (q("w14:paraId"), q("w14:textId")):
            e.attrib.pop(att, None)
    return el


def set_para_text(p, text):
    """Keep the first run's formatting, replace all run text with `text`."""
    runs = p.findall("w:r", NS)
    first = runs[0]
    for r in runs[1:]:
        p.remove(r)
    for t in first.findall("w:t", NS)[1:]:
        first.remove(t)
    t = first.find("w:t", NS)
    t.text = text
    t.set("{http://www.w3.org/XML/1998/namespace}space", "preserve")


def set_cell(tc, text):
    set_para_text(tc.find("w:p", NS), text)


def fill_table(tbl, rows):
    """rows: list of lists of cell text. Clones banded template rows 1 and 2."""
    trs = tbl.findall("w:tr", NS)
    templates = [copy.deepcopy(trs[1]), copy.deepcopy(trs[2] if len(trs) > 2 else trs[1])]
    for tr in trs[1:]:
        tbl.remove(tr)
    for i, cells in enumerate(rows):
        tr = strip_ids(copy.deepcopy(templates[i % 2]))
        for tc, value in zip(tr.findall("w:tc", NS), cells):
            set_cell(tc, value)
        tbl.append(tr)


def find_para(body, text, style=None):
    for el in body:
        if el.tag == q("w:p") and text_of(el).strip() == text:
            st = el.find("w:pPr/w:pStyle", NS)
            if style is None or (st is not None and st.get(q("w:val")) == style):
                return el
    raise KeyError(text)


def png_size(path):
    with open(path, "rb") as f:
        head = f.read(24)
    return struct.unpack(">II", head[16:24])


def section_props(template, landscape):
    sp = strip_ids(copy.deepcopy(template))
    sz = sp.find("w:pgSz", NS)
    if landscape:
        sz.set(q("w:w"), "15840")
        sz.set(q("w:h"), "12240")
        sz.set(q("w:orient"), "landscape")
    return sp


def add_sectpr(p, sectpr):
    ppr = p.find("w:pPr", NS)
    if ppr is None:
        ppr = etree.SubElement(p, q("w:pPr"))
        p.remove(ppr)
        p.insert(0, ppr)
    ppr.append(sectpr)


# invoices.total_cents, invoices.document_frozen, payment_attempts.merchant_reference and
# provider_transaction_id are not in any migration; the payment status check is pending/succeeded/failed.
TEXT_FIXES = [
    ("amount_cents and total_cents are exact-cent bigint values",
     "amount_cents and booked_unit_price_cents are exact-cent bigint values"),
    ("such as charges.type, payment_attempts.status, and bookings.status",
     "such as payment_attempts.status, bookings.status, and family_links.status"),
    (" Separately, invoices.document_frozen prevents any change to a document that has already been issued and frozen.", ""),
    (" (per document_frozen)", ""),
    ("moves through pending, then succeeded / failed / cancelled / uncertain, based on a provider callback (process_payment_notification)",
     "moves from pending to succeeded or failed based on a provider callback (record_payment_event)"),
    ("merchant_reference, provider_reference, and provider_transaction_id give",
     "provider_reference and provider_payment_id give"),
    ("idempotency_key prevents the same provider notification from being applied twice.",
     "idempotency_key prevents the same payment attempt from being started twice."),
    ("charges.lifecycle_state (provisional / finalized / voided / waived) and invoices.document_frozen give the financial tables "
     "their own audit trail by preserving how a charge or invoice moved through its lifecycle.",
     "charges.lifecycle_state (provisional / finalized / voided / waived) gives the financial tables their own audit trail "
     "by preserving how a charge moved through its lifecycle."),
    ("(amount alongside amount_cents, total alongside total_cents)",
     "(amount alongside amount_cents on charges, payments and receipts)"),
]

NUMBER_WORDS ={6: "six", 7: "seven", 8: "eight", 9: "nine", 10: "ten"}


def main(src, png, out):
    work = Path(tempfile.mkdtemp())
    with zipfile.ZipFile(src) as z:
        z.extractall(work)
    doc_path = work / "word" / "document.xml"
    tree = etree.parse(str(doc_path))
    body = tree.getroot().find("w:body", NS)

    # ---- 1. ERD image on its own landscape page -------------------------------
    blip = next(b for b in body.iter(f"{{{A}}}blip") if b.get(
        "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}embed") == "rId12")
    img_para = next(a for a in blip.iterancestors() if a.tag == q("w:p"))
    shutil.copyfile(png, work / "word" / "media" / "image2.png")
    pw, ph = png_size(png)
    cx = int(8.45 * 914400)
    cy = int(cx * ph / pw)
    for ext in img_para.iter(f"{{{WP}}}extent", f"{{{A}}}ext"):
        if ext.get("cx"):
            ext.set("cx", str(cx))
            ext.set("cy", str(cy))
    jc = img_para.find("w:pPr/w:jc", NS)
    if jc is None:
        etree.SubElement(img_para.find("w:pPr", NS), q("w:jc")).set(q("w:val"), "center")

    final_sect = body.find("w:sectPr", NS)
    heading = find_para(body, "Database Design", "Heading1")
    before = heading.getprevious()
    add_sectpr(before, section_props(final_sect, landscape=False))
    add_sectpr(img_para, section_props(final_sect, landscape=True))
    after = img_para.getnext()
    if after.tag == q("w:p") and not text_of(after).strip() and after.find(".//w:drawing", NS) is None:
        body.remove(after)  # blank line would otherwise open the next page with a gap

    # ---- 2. Scope and Methodology entity paragraph ----------------------------
    names = [e["name"] for e in ENTITIES.values()]
    scope = next(el for el in body if el.tag == q("w:p") and text_of(el).startswith("The main design contains"))
    set_para_text(scope, (
        f"The principal design is deliberately limited to the {NUMBER_WORDS[len(names)]} entities that represent real people and real club "
        f"activity: {', '.join(names[:-1])} and {names[-1]}. Guests, members and coaches are not separate tables: every "
        "account is one row in profiles, so the ERD shows Guest, Member and Coach as overlapping subtypes of Profile, "
        "distinguished by membership_status and the staff fields. The ERD and the data dictionary below list exactly the "
        "same entities, attributes and keys, and every attribute was checked against the final state of the Supabase "
        "migrations (0001 to 0025). Link tables, reference data, workflow records, ledger detail, audit columns and "
        "compatibility columns are listed under Legacy or Supporting Structures Excluded with the reason for leaving them "
        "out. Required means the column is NOT NULL in the schema; columns that the booking and payment functions always "
        "fill for current records but that remain nullable for older rows are marked Optional."))

    # ---- 3. Principal Entity List --------------------------------------------
    pel_heading = find_para(body, "Principal Entity List", "Heading1")
    pel = pel_heading.getnext()
    while pel.tag != q("w:tbl"):
        pel = pel.getnext()
    rows = []
    for key, e in ENTITIES.items():
        rows.append([e["name"], e["table"], e["purpose"], e["evidence"]])
        if key == "profile":
            rows.append(["Guest, Member, Coach (subtypes)", "profiles",
                         "Roles of a Profile, identified by membership_status, is_staff and staff_type rather than stored in separate tables.",
                         "MemberService.ts: deriveCapabilities, requireStaff; LessonBookingService.ts: coach availability operations; migration 0003."])
    fill_table(pel, rows)

    # ---- 4. Data Dictionary ---------------------------------------------------
    dd_heading = find_para(body, "Data Dictionary", "Heading2")
    excl_heading = find_para(body, "Legacy or Supporting Structures Excluded", "Heading1")
    # template elements
    entity_heading_tpl = dd_heading.getnext()
    dd_table_tpl = entity_heading_tpl.getnext()
    excl_intro = excl_heading.getnext()
    excl_table = excl_intro.getnext()
    three_col_tpl = copy.deepcopy(excl_table)
    body_para_tpl = copy.deepcopy(excl_intro)
    heading_tpl = copy.deepcopy(entity_heading_tpl)
    table_tpl = copy.deepcopy(dd_table_tpl)
    empty_tpl = copy.deepcopy(dd_table_tpl.getnext())

    # remove everything between the preceding table and the Excluded heading,
    # including stray empty headings, and rebuild it
    start = pel.getnext()
    el = start
    while el is not excl_heading:
        nxt = el.getnext()
        if el is not dd_heading:
            body.remove(el)
        el = nxt
    anchor = dd_heading
    # Data Dictionary is a major section, so it sits at the same level as Principal Entity List
    dd_heading.find("w:pPr/w:pStyle", NS).set(q("w:val"), "Heading1")
    body.remove(dd_heading)
    pel.addnext(anchor)
    pel.addnext(strip_ids(copy.deepcopy(empty_tpl)))

    def put(el):
        nonlocal anchor
        el = strip_ids(el)
        anchor.addnext(el)
        anchor = el

    intro = copy.deepcopy(body_para_tpl)
    set_para_text(intro, "Each table below documents one entity exactly as it appears on the ERD: the same attributes, "
                         "data types and keys. PK is the primary key, FK a foreign key and UK a unique constraint.")
    put(intro)

    def heading(text):
        h = copy.deepcopy(heading_tpl)
        h.find("w:pPr/w:pStyle", NS).set(q("w:val"), "Heading3")
        set_para_text(h, text)
        put(h)

    for key, e in ENTITIES.items():
        heading(f'{e["name"]}  {e["table"]}')
        tbl = copy.deepcopy(table_tpl)
        fill_table(tbl, [[e["name"], col, typ, req, cons, desc] for _k, col, typ, req, cons, desc in e["attrs"]])
        put(tbl)
        put(copy.deepcopy(empty_tpl))
        if key == "profile":
            heading("Profile Subtypes  Guest, Member, Coach")
            tbl = copy.deepcopy(three_col_tpl)
            hdr = tbl.findall("w:tr", NS)[0].findall("w:tc", NS)
            for tc, value in zip(hdr, ["Subtype", "Rule in profiles", "Plain Language Description"]):
                set_cell(tc, value)
            fill_table(tbl, [[s["name"], s["rule"], s["description"]] for s in SUBTYPES.values()]
                       + [["All subtypes", "-", SUBTYPE_NOTE]])
            put(tbl)
            put(copy.deepcopy(empty_tpl))

    # ---- 5. Excluded structures ----------------------------------------------
    fill_table(excl_table, [list(r) for r in EXCLUDED])

    # ---- 6. Remove references to columns that do not exist (Validation Controls) ----
    for el in body.iter(q("w:p")):
        for old, new in TEXT_FIXES:
            t = text_of(el)
            if old in t:
                set_para_text(el, t.replace(old, new))

    tree.write(str(doc_path), xml_declaration=True, encoding="UTF-8", standalone=True)

    out = Path(out)
    if out.exists():
        out.unlink()
    with zipfile.ZipFile(src) as zin, zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as zout:
        for item in zin.infolist():
            zout.writestr(item, (work / item.filename).read_bytes())
    shutil.rmtree(work)
    print("wrote", out)


if __name__ == "__main__":
    main(*sys.argv[1:4])
