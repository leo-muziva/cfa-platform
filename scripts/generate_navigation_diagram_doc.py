"""Build the INF3003W Website Navigation Diagram deliverable as a Word document.

The diagram is the same four-section map published at docs/navigation/navigation-diagram.html,
redrawn here with Pillow so it can be embedded in a .docx for submission. Node coordinates
are the SVG coordinates multiplied by SCALE, so the two versions stay in step: change a
position in one place and mirror it in the other.

Drawing style is deliberately ink-on-paper: white ground, hairline rules, no fills, no
shadows, no colour coding. Access level rides in the "(protected)" and "(admin only)"
labels inside each box rather than in a background tint, so the map still reads when it
is printed or photocopied in black and white.

Pages are named the way a person would describe them. Web addresses live in the table at
the end of the document, not in the boxes.

Text helpers (tables, headings, sections) are imported from the Milestone 2 handbook
generator rather than copied - one implementation, two documents.

Run:  python scripts/generate_navigation_diagram_doc.py
Out:  docs/navigation/CFA_Website_Navigation_Diagram.docx
"""

from __future__ import annotations

import math
import sys
from pathlib import Path

from PIL import Image, ImageDraw
from docx import Document
from docx.shared import Cm, Inches

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

import generate_milestone2_master_handbook as mh  # noqa: E402  (path set above)

BUILD_DIR = ROOT / "docs" / "navigation"
BUILD_DIR.mkdir(parents=True, exist_ok=True)
OUT = BUILD_DIR / "CFA_Website_Navigation_Diagram.docx"

# save_image() writes into the handbook's diagram folder; point it at ours instead.
mh.DIAGRAM_DIR = BUILD_DIR

# ---------------------------------------------------------------------------
# Palette - ink on white paper. One accent only, and it means something:
# FLAG marks a page that is finished but has nothing linking to it.
# ---------------------------------------------------------------------------

WHITE = "#FFFFFF"
INK = "#16161A"
MUTED = "#5C5C66"
FAINT = "#8A8A94"
RULE = "#D6D6DC"
GREY = "#9A9AA4"
FLAG = "#9E2A18"

# Access level rides in the box, not in a colour.
PROTECTED = "(protected)"
ADMIN_ONLY = "(admin only)"

SCALE = 1.6
W, H = int(1900 * SCALE), int(1380 * SCALE)


def s(value: float) -> float:
    """Scale an SVG coordinate into diagram pixels."""
    return value * SCALE


def font(size: float, bold: bool = False):
    return mh.img_font(max(9, int(round(size * SCALE))), bold)


# ---------------------------------------------------------------------------
# Drawing primitives
# ---------------------------------------------------------------------------


def dashed_segments(points, dash=9, gap=6):
    """Walk a polyline and yield the visible dash segments."""
    remaining, drawing = dash, True
    for (x1, y1), (x2, y2) in zip(points, points[1:]):
        length = math.hypot(x2 - x1, y2 - y1)
        if length == 0:
            continue
        ux, uy = (x2 - x1) / length, (y2 - y1) / length
        travelled = 0.0
        while travelled < length:
            step = min(remaining, length - travelled)
            a = (x1 + ux * travelled, y1 + uy * travelled)
            b = (x1 + ux * (travelled + step), y1 + uy * (travelled + step))
            if drawing:
                yield a, b
            travelled += step
            remaining -= step
            if remaining <= 0:
                drawing = not drawing
                remaining = dash if drawing else gap


def polyline(draw, pts, color=INK, width=2, style="solid", arrow=True, head=15):
    """Draw a polyline in diagram coordinates, optionally with an arrowhead at the end."""
    pts = [(s(x), s(y)) for x, y in pts]
    if style == "solid":
        draw.line(list(pts), fill=color, width=width, joint="curve")
    else:
        dash, gap = (11, 8) if style == "dashed" else (2, 7)
        for a, b in dashed_segments(pts, dash=dash, gap=gap):
            draw.line([a, b], fill=color, width=width)
    if arrow:
        (x1, y1), (x2, y2) = pts[-2], pts[-1]
        angle = math.atan2(y2 - y1, x2 - x1)
        draw.polygon(
            [
                (x2, y2),
                (x2 - head * math.cos(angle - 0.42), y2 - head * math.sin(angle - 0.42)),
                (x2 - head * math.cos(angle + 0.42), y2 - head * math.sin(angle + 0.42)),
            ],
            fill=color,
        )


def text_at(draw, x, y, value, size: float = 12, color=MUTED, bold=False, anchor="mm",
            tracking: float = 0.0):
    """Draw text. `tracking` letter-spaces it, used for the small-caps section labels."""
    typeface = font(size, bold)
    if tracking:
        # Pillow has no letter-spacing, so place each glyph by hand.
        extra = s(tracking)
        total = sum(draw.textlength(ch, font=typeface) + extra for ch in value) - extra
        cursor = s(x) - (total / 2 if anchor.startswith("m") else 0)
        for ch in value:
            draw.text((cursor, s(y)), ch, font=typeface, fill=color, anchor="l" + anchor[1])
            cursor += draw.textlength(ch, font=typeface) + extra
        return
    draw.text((s(x), s(y)), value, font=typeface, fill=color, anchor=anchor)


def box(draw, x, y, w, h, outline=INK, width=2, dashed=False):
    """A page: square corners, hairline outline, paper fill so arrows pass behind it."""
    xy = (s(x), s(y), s(x + w), s(y + h))
    draw.rectangle(xy, fill=WHITE)
    if dashed:
        corners = [(x, y), (x + w, y), (x + w, y + h), (x, y + h), (x, y)]
        for a, b in dashed_segments([(s(px), s(py)) for px, py in corners], dash=8, gap=6):
            draw.line([a, b], fill=outline, width=width)
    else:
        draw.rectangle(xy, outline=outline, width=width)


def hexagon(draw, x, y, w, h, outline=INK, notch=20, width=2):
    """A step with no screen."""
    pts = [
        (x + notch, y), (x + w - notch, y), (x + w, y + h / 2),
        (x + w - notch, y + h), (x + notch, y + h), (x, y + h / 2),
    ]
    scaled = [(s(px), s(py)) for px, py in pts]
    draw.polygon(scaled, fill=WHITE)
    draw.line(scaled + [scaled[0]], fill=outline, width=width)


def stack(draw, cx, y, h, lines):
    """Centre a stack of (text, size, colour, bold) lines inside a box of height h."""
    heights = [size * 1.5 for _, size, _, _ in lines]
    total = sum(heights)
    cursor = y + (h - total) / 2
    for (value, size, color, bold), line_h in zip(lines, heights):
        text_at(draw, cx, cursor + line_h / 2, value, size=size, color=color, bold=bold)
        cursor += line_h


def label(draw, x, y, value, size: float = 11, color=MUTED, anchor="mm", plate=False):
    """An arrow label. `plate` knocks a paper-coloured hole in the line behind it."""
    if plate:
        bbox = draw.textbbox((s(x), s(y)), value, font=font(size), anchor=anchor)
        pad = s(6)
        draw.rectangle((bbox[0] - pad, bbox[1] - pad / 2, bbox[2] + pad, bbox[3] + pad / 2), fill=WHITE)
    text_at(draw, x, y, value, size=size, color=color, anchor=anchor)


def section_rule(draw, y, title, subtitle_lines, title_y):
    """A hairline divider plus a small-caps section label in the left margin."""
    draw.line((s(20), s(y), s(1880), s(y)), fill=RULE, width=2)
    text_at(draw, 30, title_y, title.upper(), size=12, color=INK, bold=True,
            anchor="lm", tracking=1.6)
    for i, line in enumerate(subtitle_lines):
        text_at(draw, 30, title_y + 20 + i * 15, line, size=10.5, color=FAINT, anchor="lm")


# ---------------------------------------------------------------------------
# The map
# ---------------------------------------------------------------------------


def draw_navigation_map():
    im = Image.new("RGB", (W, H), WHITE)
    d = ImageDraw.Draw(im)

    # ---- key ---------------------------------------------------------------
    d.rectangle((s(20), s(20), s(1880), s(210)), outline=RULE, width=2)
    text_at(d, 44, 44, "KEY", size=11, color=FAINT, anchor="lm", tracking=2.0)

    box(d, 44, 76, 44, 26)
    text_at(d, 102, 89, "A page people can see", size=12, color=INK, anchor="lm")
    box(d, 44, 116, 44, 26, outline=GREY, dashed=True)
    text_at(d, 102, 129, "Planned - not built yet", size=12, color=INK, anchor="lm")
    hexagon(d, 44, 156, 44, 26, notch=8)
    text_at(d, 102, 169, "Behind-the-scenes step, no screen", size=12, color=INK, anchor="lm")

    polyline(d, [(660, 89), (716, 89)])
    text_at(d, 730, 89, "Someone clicks a link or button", size=12, color=INK, anchor="lm")
    polyline(d, [(660, 129), (716, 129)], style="dashed")
    text_at(d, 730, 129, "The site moves you by itself", size=12, color=INK, anchor="lm")
    polyline(d, [(660, 169), (716, 169)], style="dotted")
    text_at(d, 730, 169, "Goes out by email, comes back", size=12, color=INK, anchor="lm")

    box(d, 1290, 76, 44, 26, outline=FLAG)
    text_at(d, 1348, 89, "Built, but nothing links to it yet", size=12, color=INK, anchor="lm")
    text_at(d, 1290, 129, PROTECTED, size=11, color=INK, anchor="lm")
    text_at(d, 1400, 129, "You must be logged in", size=12, color=INK, anchor="lm")
    text_at(d, 1290, 169, ADMIN_ONLY, size=11, color=INK, anchor="lm")
    text_at(d, 1400, 169, "You must be an admin as well", size=12, color=INK, anchor="lm")

    # ---- section 1: public -------------------------------------------------
    section_rule(d, 235, "Public", ["no account needed"], 318)

    polyline(d, [(285, 300), (285, 272), (1545, 272)], color=GREY, style="dashed", arrow=False)
    for cx in (625, 855, 1085, 1315, 1545):
        polyline(d, [(cx, 272), (cx, 300)], color=GREY, style="dashed", head=12)
    label(d, 905, 262, "planned top-bar and footer links", plate=True)

    box(d, 180, 300, 210, 64)
    stack(d, 285, 300, 64, [
        ("Home page", 13, INK, False),
        ("the whole public site", 10.5, MUTED, False),
    ])

    for x, name in (
        (540, "Class availability"),
        (770, "Family information"),
        (1000, "Apply to join"),
        (1230, "Privacy notice"),
        (1460, "Terms of use"),
    ):
        box(d, x, 304, 170, 56, outline=GREY, dashed=True)
        stack(d, x + 85, 304, 56, [(name, 11.5, INK, False)])

    box(d, 180, 392, 430, 62, outline=RULE)
    stack(d, 395, 392, 62, [
        ("About . Coaches . Schedule . Membership . FAQ . Contact", 11.5, INK, False),
        ("top-bar links that scroll down the home page - not separate pages", 10.5, MUTED, False),
    ])

    box(d, 650, 392, 980, 62, outline=RULE)
    stack(d, 1140, 392, 62, [
        ("Grey boxes come from our Milestone 2 design.", 11.5, INK, False),
        ("They are drawn so this map matches the plan - none of them work yet.", 10.5, MUTED, False),
    ])

    # ---- section 2: signing in ---------------------------------------------
    section_rule(d, 505, "Signing in", ["open to all, but", "this is the door"], 553)

    for x, name, sub in (
        (180, "Sign up", "create an account"),
        (540, "Log in", "email or Google"),
        (900, "Forgot password", "ask for a reset email"),
        (1260, "Set a new password", "from the emailed link"),
    ):
        box(d, x, 535, 210, 64)
        stack(d, x + 105, 535, 64, [(name, 13, INK, False), (sub, 10.5, MUTED, False)])

    for x, name in ((180, "Confirm email link"), (540, "Google sign-in check")):
        hexagon(d, x, 630, 210, 58)
        stack(d, x + 105, 630, 58, [(name, 11.5, INK, False), ("no screen", 10.5, MUTED, False)])

    box(d, 180, 722, 210, 76)
    stack(d, 285, 722, 76, [
        ("Error page", 13, INK, False),
        ("explains what", 10.5, MUTED, False),
        ("went wrong", 10.5, MUTED, False),
    ])

    box(d, 1620, 722, 210, 76, outline=FLAG)
    stack(d, 1725, 722, 76, [
        ("Check your email", 13, INK, False),
        ("after signing up", 10.5, MUTED, False),
        ("nothing links here yet", 10, FLAG, False),
    ])

    polyline(d, [(390, 553), (532, 553)])
    label(d, 461, 543, "Log in instead")
    polyline(d, [(540, 583), (398, 583)])
    label(d, 469, 594, "Create one")
    polyline(d, [(750, 567), (892, 567)])
    label(d, 821, 557, "Forgot password?")
    polyline(d, [(1110, 567), (1252, 567)], style="dotted")
    label(d, 1181, 557, "emailed reset link")
    polyline(d, [(645, 599), (645, 622)])
    label(d, 658, 616, "Continue with Google", anchor="lm")
    polyline(d, [(285, 599), (285, 622)], style="dotted")
    label(d, 298, 616, "confirmation email", anchor="lm")
    polyline(d, [(285, 688), (285, 714)], style="dashed")
    label(d, 298, 707, "if the link is bad", anchor="lm")
    polyline(d, [(600, 688), (600, 760), (398, 760)], style="dashed")
    label(d, 614, 700, "if Google says no", anchor="lm")

    box(d, 940, 722, 400, 76, outline=RULE)
    stack(d, 1140, 722, 76, [
        ("Two finished pages have nothing linking to them:", 11.5, INK, False),
        ("Check your email, and My profile.", 11, FLAG, False),
        ("You reach them by typing the address.", 10.5, MUTED, False),
    ])

    # Every successful sign-in merges into one arrow.
    polyline(d, [(390, 659), (420, 659), (420, 812)], arrow=False)
    polyline(d, [(750, 659), (790, 659), (790, 812)], arrow=False)
    polyline(d, [(750, 585), (830, 585), (830, 812)], arrow=False)
    polyline(d, [(420, 812), (830, 812)], arrow=False)
    d.ellipse((s(825), s(807), s(835), s(817)), fill=INK)
    polyline(d, [(830, 812), (830, 905), (892, 905)])
    label(d, 843, 858, "signed in - you land here", anchor="lm")

    polyline(d, [(1365, 599), (1365, 840), (1010, 840), (1010, 864)])
    label(d, 1190, 830, "new password saved")

    # ---- section 3: members ------------------------------------------------
    section_rule(d, 840, "Members", ["must be logged in"], 896)

    hexagon(d, 180, 872, 250, 86)
    stack(d, 305, 872, 86, [
        ("Signed in?", 13, INK, True),
        ("checked before every", 10.5, MUTED, False),
        ("page in this section", 10.5, MUTED, False),
    ])
    polyline(d, [(430, 890), (480, 890), (480, 615), (600, 615), (600, 607)], style="dashed")
    label(d, 493, 792, "no - back to Log in", anchor="lm")
    polyline(d, [(430, 930), (892, 930)])
    label(d, 660, 920, "yes - carry on")

    box(d, 900, 872, 210, 86)
    stack(d, 1005, 872, 86, [
        ("Your account", 13, INK, False),
        (PROTECTED, 10, FAINT, False),
        ("top bar: home . Members . log out", 10, MUTED, False),
    ])

    box(d, 1260, 872, 210, 86, outline=FLAG)
    stack(d, 1365, 872, 86, [
        ("My profile", 13, INK, False),
        (PROTECTED, 10, FAINT, False),
        ("edit name and phone", 10.5, MUTED, False),
        ("no link points here yet", 10, FLAG, False),
    ])

    polyline(d, [(1005, 958), (1005, 974)], color=GREY, style="dashed", arrow=False)
    polyline(d, [(250, 974), (1025, 974)], color=GREY, style="dashed", arrow=False)
    for x, name in (
        (180, "Complete profile"),
        (335, "My lessons"),
        (490, "Membership request"),
        (645, "My family"),
        (800, "My dependents"),
        (955, "My billing"),
    ):
        polyline(d, [(x + 70, 974), (x + 70, 982)], color=GREY, style="dashed", head=12)
        box(d, x, 990, 140, 58, outline=GREY, dashed=True)
        stack(d, x + 70, 990, 58, [(name, 11, INK, False), (PROTECTED, 10, FAINT, False)])

    # ---- section 4: admins -------------------------------------------------
    section_rule(d, 1110, "Admins", ["logged in, and", "an admin role"], 1166)

    polyline(d, [(1110, 935), (1150, 935), (1150, 1112), (960, 1112), (960, 1142)])
    label(d, 1163, 1006, '"Members" in the top bar', anchor="lm")

    hexagon(d, 180, 1142, 250, 86)
    stack(d, 305, 1142, 86, [
        ("Admin role?", 13, INK, True),
        ("checked before every", 10.5, MUTED, False),
        ("page in this section", 10.5, MUTED, False),
    ])
    polyline(d, [(430, 1165), (480, 1165), (480, 1092), (1225, 1092), (1225, 910), (1118, 910)],
             style="dashed")
    label(d, 645, 1084, "no - back to your account", plate=True)
    polyline(d, [(430, 1185), (532, 1185)])

    for x, name, sub1, sub2 in (
        (540, "Admin dashboard", "member counts by role", "and membership type"),
        (900, "Members list", "search . filter . pages", None),
        (1260, "Member details", "edit and deactivate", "< back to members"),
        (1620, "Invite a member", "send a joining email", "< back to members"),
    ):
        box(d, x, 1142, 210, 86)
        lines = [(name, 13, INK, False), (ADMIN_ONLY, 10, FAINT, False), (sub1, 10.5, MUTED, False)]
        if sub2:
            lines.append((sub2, 10.5, MUTED, False))
        stack(d, x + 105, 1142, 86, lines)

    polyline(d, [(750, 1170), (892, 1170)])
    label(d, 821, 1160, "Members")
    polyline(d, [(900, 1200), (758, 1200)])
    label(d, 829, 1212, "Dashboard")
    polyline(d, [(1110, 1185), (1252, 1185)])
    label(d, 1181, 1175, "click a row")
    polyline(d, [(1060, 1142), (1060, 1130), (1725, 1130), (1725, 1142)])
    label(d, 1392, 1130, "Add member", plate=True)

    polyline(d, [(645, 1228), (645, 1246)], color=GREY, style="dashed", arrow=False)
    polyline(d, [(265, 1246), (1185, 1246)], color=GREY, style="dashed", arrow=False)
    for x, name in (
        (180, "Membership requests"),
        (410, "Lesson schedule"),
        (640, "Households"),
        (870, "Invoicing"),
        (1100, "Payments"),
    ):
        polyline(d, [(x + 85, 1246), (x + 85, 1254)], color=GREY, style="dashed", head=12)
        box(d, x, 1262, 170, 58, outline=GREY, dashed=True)
        stack(d, x + 85, 1262, 58, [(name, 11, INK, False), (ADMIN_ONLY, 10, FAINT, False)])

    return mh.save_image(im, "website-navigation-map")


# ---------------------------------------------------------------------------
# Document content
# ---------------------------------------------------------------------------

KEY_ROWS = [
    ("Solid box", "A page a visitor can open and see."),
    ("Six-sided box", "A step with no screen. It runs, decides, and passes you straight on."),
    ("Grey dashed box", "Planned in our Milestone 2 design. Not built yet."),
    ("Red outline", "The page is built and works, but nothing on the site links to it yet."),
    ("(protected)", "You have to be logged in before the page will open."),
    ("(admin only)", "You have to be logged in and hold the admin role."),
    ("Solid arrow", "Someone clicks something. The label names the button, link or menu item."),
    ("Dashed arrow", "The site moves you on its own. Nobody clicked anything."),
    ("Dotted arrow", "The trip leaves the site by email and comes back when the link is clicked."),
    ("Joining dot", "Several routes end the same way, so they merge into one arrow."),
]

# Written as paragraphs, not table rows. Each is (bold lead-in, rest of the paragraph);
# the lead-in names the page so the section can still be skimmed.
EXPLANATIONS = [
    ("The home page",
     " holds everything the public sees on one screen. Membership, Lessons, Schedule, FAQ and Contact "
     "in the top bar do not open new pages - they scroll you down to a section of this same one, and "
     "on a phone they hide behind the menu button. Signing in is built into that top bar as well: "
     "logged out you see Log in and Sign up, and once you are logged in both disappear and a Dashboard "
     "button takes their place."),
    ("Log in",
     " asks for your email, then your password, one step at a time. There are three ways out of it - "
     "your account if the details are right, the sign-up page, or the reset-password page. Choosing "
     "Google instead sends you through a hidden checking step before you land anywhere."),
    ("Sign up",
     " does not sign you in, which surprises people. It emails you a confirmation link and sends you "
     "to the login page. Only when you click the link in that email does the hidden confirm step run "
     "and drop you on your account page."),
    ("Set a new password",
     " has no button anywhere that opens it. Forgot password emails you a link, and that link is the "
     "only way in. That is why the arrow leading to it on the map is dotted rather than solid."),
    ("Confirm email link and Google sign-in check",
     " never show you anything. They read the code in your link, check it with Supabase, and move you "
     "straight on - to your account if the code was good, to the error page if it was not."),
    ("Your account",
     " is the junction of the whole site. Every way of signing in ends here: password, Google, a "
     "confirmed email, or a freshly reset password. It also carries the top bar with the Members link, "
     "which is the only route from the member side into the admin side."),
    ("My profile",
     " lets you change your name and phone number, but your email and your role are locked - the "
     "server throws those away even if the form is tampered with. Nothing links to this page yet, so "
     "for now you reach it by typing the address."),
    ("The members list",
     " looks like several pages but is only one. Searching by name, filtering by role or status, and "
     "moving between pages all change the web address while keeping you here. Two things lead away "
     "from it: the Add member button, and clicking any row."),
    ("Member details",
     " does two jobs on one page. It edits a member, and it switches them between active and inactive. "
     "Deactivating is not deleting - the member keeps their history and simply stops being included in "
     "invoicing."),
    ("The two checkpoints",
     " are not pages, and nobody clicks them. They run before a page loads: ask for a member page "
     "without being logged in and you are sent to Log in; ask for an admin page as an ordinary member "
     "and you are sent back to your own account. Both happen on the server, before anything is drawn."),
    ("The grey pages",
     " are the ones from our Milestone 2 design that we have not built. They are on the map so it "
     "lines up with the plan we submitted, and drawn in grey dashes so nobody mistakes them for "
     "working pages."),
]

ROUTE_ROWS = [
    ("PUBLIC", "", "", ""),
    ("Home page", "/",
     "The web address, or the logo in the top bar",
     "Log in or Sign up in the top bar; section links scroll down the same page"),
    ("SIGNING IN", "", "", ""),
    ("Log in", "/auth/login",
     "Log in button in the home top bar; the \"Log in\" link on the sign-up page",
     "Your account, sign up, forgot password, or the Google checking step"),
    ("Sign up", "/auth/sign-up",
     "Sign up button in the home top bar; Join button in the Membership section; \"Create one\" on login",
     "Sends you to the login page and emails you a confirmation link"),
    ("Forgot password", "/auth/forgot-password",
     "\"Forgot password?\" on the login page",
     "Back to login, or out by email to the reset page"),
    ("Set a new password", "/auth/update-password",
     "Only the emailed reset link",
     "Your account, once the new password is saved"),
    ("Confirm email link", "/auth/confirm",
     "Clicking the link in the confirmation email",
     "Your account if the link is good, the error page if not"),
    ("Google sign-in check", "/auth/callback",
     "Choosing \"Continue with Google\" on login or sign up",
     "Your account if Google agrees, the error page if not"),
    ("Error page", "/auth/error",
     "Sent here automatically by either checking step",
     "No link out yet - you go back by hand"),
    ("Check your email", "/auth/sign-up-success",
     "Nothing links here. The sign-up form shows the same message in a pop-up instead.",
     "No link out"),
    ("MEMBERS - PROTECTED", "", "", ""),
    ("Your account", "/protected",
     "Every successful sign-in lands here; Dashboard button in the home top bar",
     "Members link in the top bar; Log out, which returns you to login"),
    ("My profile", "/protected/profile",
     "No link points here yet - type the address",
     "Top bar links"),
    ("ADMINS - PROTECTED, ADMIN ROLE REQUIRED", "", "", ""),
    ("Admin dashboard", "/protected/admin",
     "Dashboard link in the admin bar",
     "\"Manage members\" link; Members in the admin bar"),
    ("Members list", "/protected/admin/members",
     "Members link in the top bar, or the admin bar",
     "Add member button; clicking any row"),
    ("Invite a member", "/protected/admin/members/new",
     "Add member button on the list",
     "\"Back to members\" link"),
    ("Member details", "/protected/admin/members/[id]",
     "Clicking that member's row on the list",
     "\"Back to members\" link"),
]


def build():
    diagram = draw_navigation_map()

    doc = Document()
    section = doc.sections[0]
    section.page_width, section.page_height = Cm(29.7), Cm(21.0)
    section.left_margin = section.right_margin = Cm(1.5)
    section.top_margin = section.bottom_margin = Cm(1.4)

    mh.heading(doc, "Website Navigation Diagram", 1)
    mh.add_para(
        doc,
        "Cape Fencing Academy platform - INF3003W Systems Development Project, Group 17. "
        "Every page in the application, and the button, link or menu item that gets you to it. "
        "Pages drawn in solid outline are built and working; grey pages come from our Milestone 2 "
        "design and are not built yet.",
    )
    mh.add_para(
        doc,
        "How to read it: the map runs in four sections down the page, ordered by how much access a "
        "page needs. The top section is open to anyone; each one below asks for one more thing - an "
        "account, then a login, then an admin role. Pages are named the way a person would describe "
        "them, and the web address of every one is in the last table.",
    )
    mh.add_para(
        doc,
        "Every arrow matches a real line in the code - a link, a form button, or an automatic "
        "redirect. The Contact section also holds three links that leave the site entirely (a map, "
        "an email address and a Facebook group), so they are not pages and are not drawn.",
    )

    figures, tables = [0], [0]
    mh.heading(doc, "What the notation means", 2)
    tables[0] += 1
    mh.add_table_caption(doc, tables[0], "Diagram key")
    mh.add_table(doc, ["Notation", "Meaning"], KEY_ROWS, [3200, 12000], font_size=9, landscape=True)

    # The map is a full landscape page on its own - at any smaller size the labels
    # stop being readable in print. Tighter margins buy the height needed to keep
    # the whole map, plus its caption, on one page.
    map_page = mh.add_landscape_section(doc)
    map_page.top_margin = map_page.bottom_margin = Cm(1.0)
    figures[0] += 1
    mh.add_diagram(doc, diagram, figures[0], "CFA website navigation map", width=Inches(9.6))

    # Prose, so it goes on a portrait page - running text across a 27 cm landscape
    # measure is too wide a line to read comfortably.
    mh.add_portrait_section(doc)
    mh.heading(doc, "Pages worth explaining", 2)
    mh.add_para(
        doc,
        "Most pages are simple: one job, one way in, one way out. These ones are not, either because "
        "they do several things at once, because something is built into them, or because not "
        "everyone may open them.",
    )
    for lead, rest in EXPLANATIONS:
        mh.add_para(doc, lead + rest, bold_prefix=lead, after=9)

    mh.add_landscape_section(doc)
    mh.heading(doc, "Every page, and how you get there", 2)
    tables[0] += 1
    mh.add_table_caption(doc, tables[0], "Complete page and navigation list")
    mh.add_table(
        doc,
        ["Page", "Web address", "How you get to it", "How you leave"],
        ROUTE_ROWS,
        [3000, 3600, 4400, 4200],
        font_size=8.2,
        landscape=True,
    )

    core = doc.core_properties
    core.title = "CFA Website Navigation Diagram"
    core.subject = "INF3003W website navigation diagram deliverable"
    core.keywords = "CFA, navigation diagram, sitemap, INF3003W"
    doc.save(OUT)
    print(f"Created {OUT}")
    print(f"Diagram: {diagram}")


if __name__ == "__main__":
    build()
