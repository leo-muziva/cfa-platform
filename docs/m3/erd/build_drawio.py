"""Generate cfa_erd.drawio from erd_spec.py.

Layout is explicit (absolute coordinates and edge waypoints) so that no
relationship line crosses an entity box. Run, then export with draw.io:
  "C:/Program Files/draw.io/draw.io.exe" -x -f png -s 3 -b 16 -o cfa_erd.png cfa_erd.drawio
"""
from html import escape
from pathlib import Path

from erd_spec import ENTITIES, SUBTYPES, SUBTYPE_NOTE, RELATIONSHIPS

HEADER_H = 34
ROW_H = 24
KEY_W, NAME_W, TYPE_W = 58, 186, 116
BOX_W = KEY_W + NAME_W + TYPE_W  # 360
OY = 70  # room for the title

COLORS = {
    "people": ("#2F4B8C", "#EEF2FA"),
    "family": ("#2E7D5B", "#EDF7F2"),
    "lessons": ("#B35A1F", "#FCF1EA"),
    "payments": ("#6A2C91", "#F4EEF8"),
}

# Top-left corner of every box (before the title offset).
POS = {
    "family_link": (40, 40),
    "household": (40, 470),
    "profile": (680, 40),
    "member": (720, 430),
    "guest": (940, 430),
    "coach": (1160, 430),
    "membership": (580, 620),
    "lesson_booking": (1020, 620),
    "booking_participant": (1020, 1020),
    "payment": (1560, 620),
    "receipt": (1560, 40),
}
SUB_W, SUB_H = 200, 92
CIRCLE = (984, 360, 32)  # x, y (top-left), size


def box_h(key):
    if key in SUBTYPES:
        return SUB_H
    return HEADER_H + ROW_H * len(ENTITIES[key]["attrs"])


def box(key):
    x, y = POS[key]
    w = SUB_W if key in SUBTYPES else BOX_W
    return x, y + OY, w, box_h(key)


cells = []
_id = [100]


def nid():
    _id[0] += 1
    return f"c{_id[0]}"


def add(xml):
    cells.append(xml)


def vertex(cid, value, style, x, y, w, h, parent="1"):
    add(f'<mxCell id="{cid}" value="{escape(value, quote=True)}" style="{style}" vertex="1" parent="{parent}">'
        f'<mxGeometry x="{x}" y="{y}" width="{w}" height="{h}" as="geometry"/></mxCell>')


FONT = "fontFamily=Helvetica;"

# ---- title -----------------------------------------------------------------
vertex("title", "<b>CFA Platform - Entity Relationship Diagram</b>",
       f"text;html=1;align=left;verticalAlign=middle;fontSize=22;fontColor=#1F2937;{FONT}", 40, 14, 900, 34)
vertex("subtitle", "Principal entities of the Supabase schema (migrations 0001-0025). Crow's foot notation with multiplicities.",
       f"text;html=1;align=left;verticalAlign=middle;fontSize=13;fontColor=#4B5563;{FONT}", 40, 46, 1100, 22)

# ---- entity tables ---------------------------------------------------------
for key, e in ENTITIES.items():
    head, fill = COLORS[e["cluster"]]
    x, y, w, h = box(key)
    label = f'<b>{e["name"]}</b> <font style="font-size:11px" color="#E5E7EB">{e["table"]}</font>'
    vertex(key, label,
           f"swimlane;html=1;startSize={HEADER_H};fillColor={head};fontColor=#FFFFFF;strokeColor={head};"
           f"swimlaneFillColor=#FFFFFF;rounded=1;arcSize=3;fontSize=15;collapsible=0;{FONT}strokeWidth=1.5;",
           x, y, w, h)
    for i, (k, col, typ, req, cons, desc) in enumerate(e["attrs"]):
        ry = HEADER_H + i * ROW_H
        shade = fill if i % 2 else "#FFFFFF"
        is_pk = "PK" in k
        name = f"<u>{col}</u>" if is_pk else col
        if req == "Required" and not is_pk:
            name = f"{name} <font color='#B91C1C'>*</font>"
        base = f"text;html=1;fillColor={shade};strokeColor=none;verticalAlign=middle;spacingLeft=8;fontSize=12;{FONT}"
        vertex(nid(), f"<b>{k}</b>" if k else "", base + "align=center;spacingLeft=0;fontColor=#374151;", 0, ry, KEY_W, ROW_H, key)
        vertex(nid(), f"<b>{name}</b>" if is_pk else name, base + "align=left;fontColor=#111827;", KEY_W, ry, NAME_W, ROW_H, key)
        vertex(nid(), typ, base + "align=left;fontColor=#6B7280;fontStyle=2;", KEY_W + NAME_W, ry, TYPE_W, ROW_H, key)
    # key column divider
    add(f'<mxCell id="{nid()}" style="endArrow=none;html=1;strokeColor={head};strokeWidth=1;opacity=40;" edge="1" parent="{key}">'
        f'<mxGeometry relative="1" as="geometry"><mxPoint x="{KEY_W}" y="{HEADER_H}" as="sourcePoint"/>'
        f'<mxPoint x="{KEY_W}" y="{h}" as="targetPoint"/></mxGeometry></mxCell>')

# ---- subtypes --------------------------------------------------------------
head, fill = COLORS["people"]
for key, s in SUBTYPES.items():
    x, y, w, h = box(key)
    label = (f'<div style="font-size:10px;color:#6B7280">&laquo;subtype of Profile&raquo;</div>'
             f'<b style="font-size:15px">{s["name"]}</b>'
             f'<div style="font-size:10px;font-family:Consolas,monospace;color:#1F2937;margin-top:4px">{escape(s["rule"])}</div>')
    vertex(key, label,
           f"rounded=1;arcSize=12;html=1;whiteSpace=wrap;fillColor={fill};strokeColor={head};dashed=1;dashPattern=6 3;"
           f"strokeWidth=1.5;verticalAlign=middle;{FONT}", x, y, w, h)

cx, cy, cs = CIRCLE
vertex("isa", "<b>o</b>", f"ellipse;html=1;fillColor=#FFFFFF;strokeColor={head};strokeWidth=1.5;fontSize=16;fontColor={head};{FONT}",
       cx, cy + OY, cs, cs)
vertex("isa_note", "overlapping<br><font style='font-size:10px'>(Guest and Member are exclusive)</font>",
       f"text;html=1;align=left;fontSize=11;fontColor=#4B5563;fontStyle=2;{FONT}", cx + cs + 6, cy + OY - 2, 190, 34)


def rel_point(key, px, py):
    x, y, w, h = box(key) if key != "isa" else (cx, cy + OY, cs, cs)
    return round((px - x) / w, 4), round((py - y) / h, 4)


def edge(eid, src, tgt, pts, style, labels=()):
    """pts: absolute points [start, *waypoints, end] (y already without OY)."""
    pts = [(px, py + OY) for px, py in pts]
    ex, ey = rel_point(src, *pts[0])
    nx, ny = rel_point(tgt, *pts[-1])
    way = "".join(f'<mxPoint x="{px}" y="{py}"/>' for px, py in pts[1:-1])
    arr = f'<Array as="points">{way}</Array>' if way else ""
    add(f'<mxCell id="{eid}" style="edgeStyle=orthogonalEdgeStyle;rounded=0;html=1;{style}'
        f'exitX={ex};exitY={ey};exitDx=0;exitDy=0;entryX={nx};entryY={ny};entryDx=0;entryDy=0;" '
        f'edge="1" parent="1" source="{src}" target="{tgt}"><mxGeometry relative="1" as="geometry">{arr}</mxGeometry></mxCell>')
    for text, pos, dx, dy, extra in labels:
        add(f'<mxCell id="{nid()}" value="{escape(text, quote=True)}" style="edgeLabel;html=1;resizable=0;{FONT}{extra}" '
            f'vertex="1" connectable="0" parent="{eid}"><mxGeometry x="{pos}" relative="1" as="geometry">'
            f'<mxPoint x="{dx}" y="{dy}" as="offset"/></mxGeometry></mxCell>')


END = {"1": "ERmandOne", "0..1": "ERzeroToOne", "0..*": "ERzeroToMany", "1..*": "ERoneToMany", "1..2": "ERoneToMany"}

# Absolute routes (without title offset): start point on parent, waypoints, end point on child.
# Label offsets: (dx, dy) for parent multiplicity, child multiplicity, verb.
ROUTES = {
    "r_guardian":  [(680, 110), (400, 110)],
    "r_dependent": [(680, 134), (400, 134)],
    "r_pays_for":  [(680, 185), (460, 185), (460, 540), (400, 540)],
    "r_belongs":   [(400, 564), (500, 564), (500, 250), (680, 250)],
    "r_holds":     [(700, 290), (700, 620)],
    "r_coaches":   [(1260, 522), (1260, 620)],
    "r_books":     [(1040, 170), (1440, 170), (1440, 700), (1380, 700)],
    "r_attends":   [(680, 280), (540, 280), (540, 1085), (1020, 1085)],
    "r_includes":  [(1200, 918), (1200, 1020)],
    "r_makes":     [(1040, 110), (1500, 110), (1500, 700), (1560, 700)],
    "r_secures":   [(1380, 840), (1560, 840)],
    "r_credited":  [(1040, 70), (1560, 70)],
    "r_evidences": [(1800, 620), (1800, 218)],
}
VERB_SHIFT = {"r_belongs": -21, "r_holds": 110}
NO_BG = {"r_belongs"}
VERB_DX = {"r_belongs": -22}
VERB_SEG = {"r_pays_for": 0, "r_belongs": 2}  # force label onto a given segment


def seg_dir(a, b):
    dx, dy = b[0] - a[0], b[1] - a[1]
    n = max(abs(dx), abs(dy)) or 1
    return dx / n, dy / n


def free_label(text, cx, cy, w, h, style):
    vertex(nid(), text, f"text;html=1;align=center;verticalAlign=middle;{FONT}{style}", cx - w / 2, cy - h / 2 + OY, w, h)


MULT_STYLE = "fontSize=13;fontStyle=1;fontColor=#111827;"


# Ends whose label goes below a horizontal line (neighbouring rows are only 24px apart).
LABEL_BELOW = {("r_dependent", "parent"), ("r_dependent", "child"), ("r_belongs", "parent")}


def end_label(text, p0, p1, below=False):
    dx, dy = seg_dir(p0, p1)
    ax, ay = p0[0] + dx * 30, p0[1] + dy * 30
    if dy == 0:      # horizontal segment: label above the line (or below when crowded)
        ay += 13 if below else -13
    else:            # vertical segment: label right of the line
        ax += 20
    free_label(text, ax, ay, 40, 18, MULT_STYLE)


for rid, parent, pm, child, cm, verb, via, dashed in RELATIONSHIPS:
    pts = ROUTES[rid]
    style = (f"startArrow={END[pm]};endArrow={END[cm]};startFill=0;endFill=0;startSize=14;endSize=14;"
             f"strokeColor=#374151;strokeWidth=1.4;")
    if dashed:
        style += "dashed=1;dashPattern=8 4;"
    edge(rid, parent, child, pts, style)
    end_label(pm, pts[0], pts[1], (rid, "parent") in LABEL_BELOW)
    end_label(cm, pts[-1], pts[-2], (rid, "child") in LABEL_BELOW)
    # verb on the middle of the longest segment, on a white background
    segs = list(zip(pts, pts[1:]))
    a, b = segs[VERB_SEG[rid]] if rid in VERB_SEG else max(segs, key=lambda sg: abs(sg[1][0] - sg[0][0]) + abs(sg[1][1] - sg[0][1]))
    mx, my = (a[0] + b[0]) / 2, (a[1] + b[1]) / 2
    my += VERB_SHIFT.get(rid, 0)
    mx += VERB_DX.get(rid, 0)
    text = f"<i>{verb}</i>" + (f"<br><font style='font-size:10px' color='#6B7280'>{via}</font>" if dashed else "")
    bg = "none" if rid in NO_BG else "#FFFFFF"
    free_label(text, mx, my, 130 if dashed else 100, 34 if dashed else 20,
               f"fontSize=12;fontColor=#374151;labelBackgroundColor={bg};")

# ---- specialisation (Profile -> o -> subtypes) ------------------------------
spec_style = f"endArrow=none;startArrow=none;strokeColor={head};strokeWidth=1.8;"
edge("isa_up", "profile", "isa", [(1000, 290), (1000, 360)], spec_style)
edge("isa_member", "isa", "member", [(1000, 392), (1000, 410), (820, 410), (820, 430)], spec_style)
edge("isa_guest", "isa", "guest", [(1000, 392), (1000, 410), (1040, 410), (1040, 430)], spec_style)
edge("isa_coach", "isa", "coach", [(1000, 392), (1000, 410), (1260, 410), (1260, 430)], spec_style)

# ---- legend ----------------------------------------------------------------
LX, LY = 40, 650
vertex("legend", "", "rounded=1;arcSize=4;html=1;fillColor=#FAFAFA;strokeColor=#D1D5DB;", LX, LY + OY, 400, 370)
vertex(nid(), "<b>Legend</b>", f"text;html=1;fontSize=14;align=left;{FONT}", LX + 14, LY + OY + 8, 200, 24)
legend_rows = [
    ("ERmandOne", "1", "exactly one"),
    ("ERzeroToOne", "0..1", "zero or one"),
    ("ERoneToMany", "1..*", "one or more (1..2 = one or two)"),
    ("ERzeroToMany", "0..*", "zero or more"),
]
for i, (sym, mult, text) in enumerate(legend_rows):
    yy = LY + OY + 50 + i * 34
    add(f'<mxCell id="{nid()}" style="endArrow={sym};startArrow=none;endFill=0;endSize=14;html=1;strokeColor=#374151;strokeWidth=1.4;" edge="1" parent="1">'
        f'<mxGeometry relative="1" as="geometry"><mxPoint x="{LX + 20}" y="{yy}" as="sourcePoint"/>'
        f'<mxPoint x="{LX + 90}" y="{yy}" as="targetPoint"/></mxGeometry></mxCell>')
    vertex(nid(), f"<b>{mult}</b>&nbsp;&nbsp;{text}", f"text;html=1;fontSize=12;align=left;{FONT}", LX + 104, yy - 11, 290, 22)
notes = [
    "<b>PK</b> primary key &nbsp; <b>FK</b> foreign key &nbsp; <b>UK</b> unique",
    "<u>underlined</u> = primary key, <font color='#B91C1C'>*</font> = required (NOT NULL)",
    "Dashed line: relationship stored in a link table",
    "Dashed box + <b>o</b>: overlapping subtypes of Profile,",
    "&nbsp;&nbsp;&nbsp;&nbsp;stored in the same <i>profiles</i> table",
]
for i, t in enumerate(notes):
    vertex(nid(), t, f"text;html=1;fontSize=12;align=left;{FONT}", LX + 16, LY + OY + 196 + i * 30, 380, 24)

W, H = 2000, 1260
xml = (f'<mxfile host="drawio"><diagram id="erd" name="CFA ERD"><mxGraphModel dx="{W}" dy="{H}" grid="0" gridSize="10" '
       f'guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="0" pageScale="1" pageWidth="{W}" pageHeight="{H}" '
       f'background="#FFFFFF" math="0" shadow="0"><root><mxCell id="0"/><mxCell id="1" parent="0"/>'
       + "".join(cells) + "</root></mxGraphModel></diagram></mxfile>")
Path(__file__).with_name("cfa_erd.drawio").write_text(xml, encoding="utf-8")
print("wrote cfa_erd.drawio with", len(cells), "cells")
