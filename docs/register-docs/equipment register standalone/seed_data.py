"""
Static reference data for the CFA Equipment Register.

This is the single source of truth for equipment types, categories, and the
original seed dataset (117 items). Both the backend (app.py, for validation and
code generation) and the frontend (served via GET /api/config) read from here,
so there is only one place to update if equipment types ever change.
"""

TYPES = {
    "Foil": {
        "prefix": "WF",
        "size": False,
        "hand": True
    },
    "Épée": {
        "prefix": "WE",
        "size": False,
        "hand": True
    },
    "Sabre": {
        "prefix": "WS",
        "size": False,
        "hand": True
    },
    "Foil Mask": {
        "prefix": "MF",
        "size": True,
        "hand": False
    },
    "Épée Mask": {
        "prefix": "ME",
        "size": True,
        "hand": False
    },
    "Sabre Mask": {
        "prefix": "MS",
        "size": True,
        "hand": False
    },
    "Foil Lamé": {
        "prefix": "LF",
        "size": True,
        "hand": False
    },
    "Sabre Lamé": {
        "prefix": "LS",
        "size": True,
        "hand": False
    },
    "Jacket": {
        "prefix": "JK",
        "size": True,
        "hand": False
    },
    "Plastron": {
        "prefix": "PT",
        "size": True,
        "hand": True
    },
    "Chest Protector": {
        "prefix": "CP",
        "size": True,
        "hand": False
    },
    "Breeches": {
        "prefix": "BR",
        "size": True,
        "hand": False
    },
    "Glove": {
        "prefix": "GL",
        "size": True,
        "hand": True
    },
    "Manchette": {
        "prefix": "MN",
        "size": False,
        "hand": True
    },
    "Foil Wire": {
        "prefix": "FW",
        "size": False,
        "hand": False
    },
    "Épée Wire": {
        "prefix": "EW",
        "size": False,
        "hand": False
    },
    "Mask Clip": {
        "prefix": "MC",
        "size": False,
        "hand": False
    }
}

CATEGORIES = [
    {
        "label": "Weapons",
        "types": [
            "Foil",
            "Épée",
            "Sabre"
        ]
    },
    {
        "label": "Masks",
        "types": [
            "Foil Mask",
            "Épée Mask",
            "Sabre Mask"
        ]
    },
    {
        "label": "Lamés",
        "types": [
            "Foil Lamé",
            "Sabre Lamé"
        ]
    },
    {
        "label": "Clothing",
        "types": [
            "Jacket",
            "Plastron",
            "Chest Protector",
            "Breeches"
        ]
    },
    {
        "label": "Gloves",
        "types": [
            "Glove",
            "Manchette"
        ]
    },
    {
        "label": "Wires",
        "types": [
            "Foil Wire",
            "Épée Wire"
        ]
    },
    {
        "label": "Accessories",
        "types": [
            "Mask Clip"
        ]
    }
]

TYPE_ORDER = [t for cat in CATEGORIES for t in cat["types"]]

SIZES = [
    "XS",
    "S",
    "M",
    "L",
    "XL",
    "XXL"
]
CONDITIONS = [
    "Good",
    "Fair",
    "Poor",
    "Broken"
]
STATUSES = [
    "In Storage",
    "With Member",
    "Awaiting Repair"
]

STATUS_COLOR = {
    "In Storage": "#15803D",
    "With Member": "#B45309",
    "Awaiting Repair": "#B91C1C"
}

COND_COLOR = {
    "Good": "#15803D",
    "Fair": "#A16207",
    "Poor": "#C2410C",
    "Broken": "#B91C1C"
}

# The original 117-item seed register, used to populate equipment.db on first run.
# Note: id is NOT included here -- SQLite assigns its own primary key on insert.
SEED = [
    {
        "type": "Foil",
        "code": "WF001",
        "hand": "Right",
        "size": "",
        "condition": "Good",
        "status": "In Storage",
        "notes": ""
    },
    {
        "type": "Foil",
        "code": "WF002",
        "hand": "Right",
        "size": "",
        "condition": "Good",
        "status": "In Storage",
        "notes": ""
    },
    {
        "type": "Foil",
        "code": "WF003",
        "hand": "Right",
        "size": "",
        "condition": "Fair",
        "status": "In Storage",
        "notes": ""
    },
    {
        "type": "Foil",
        "code": "WF004",
        "hand": "Right",
        "size": "",
        "condition": "Good",
        "status": "With Member",
        "notes": ""
    },
    {
        "type": "Foil",
        "code": "WF005",
        "hand": "Right",
        "size": "",
        "condition": "Fair",
        "status": "With Member",
        "notes": ""
    },
    {
        "type": "Foil",
        "code": "WF006",
        "hand": "Right",
        "size": "",
        "condition": "Fair",
        "status": "In Storage",
        "notes": "Grip worn"
    },
    {
        "type": "Foil",
        "code": "WF007",
        "hand": "Right",
        "size": "",
        "condition": "Poor",
        "status": "Awaiting Repair",
        "notes": "Blade cracked"
    },
    {
        "type": "Foil",
        "code": "WF008",
        "hand": "Left",
        "size": "",
        "condition": "Good",
        "status": "In Storage",
        "notes": ""
    },
    {
        "type": "Foil",
        "code": "WF009",
        "hand": "Left",
        "size": "",
        "condition": "Fair",
        "status": "With Member",
        "notes": ""
    },
    {
        "type": "Foil",
        "code": "WF010",
        "hand": "Right",
        "size": "",
        "condition": "Good",
        "status": "In Storage",
        "notes": "Junior size"
    },
    {
        "type": "Épée",
        "code": "WE001",
        "hand": "Right",
        "size": "",
        "condition": "Good",
        "status": "In Storage",
        "notes": ""
    },
    {
        "type": "Épée",
        "code": "WE002",
        "hand": "Right",
        "size": "",
        "condition": "Good",
        "status": "In Storage",
        "notes": ""
    },
    {
        "type": "Épée",
        "code": "WE003",
        "hand": "Right",
        "size": "",
        "condition": "Fair",
        "status": "With Member",
        "notes": ""
    },
    {
        "type": "Épée",
        "code": "WE004",
        "hand": "Right",
        "size": "",
        "condition": "Fair",
        "status": "In Storage",
        "notes": "Point spring weak"
    },
    {
        "type": "Épée",
        "code": "WE005",
        "hand": "Left",
        "size": "",
        "condition": "Good",
        "status": "In Storage",
        "notes": ""
    },
    {
        "type": "Épée",
        "code": "WE006",
        "hand": "Right",
        "size": "",
        "condition": "Poor",
        "status": "Awaiting Repair",
        "notes": "Blade bent"
    },
    {
        "type": "Sabre",
        "code": "WS001",
        "hand": "Right",
        "size": "",
        "condition": "Good",
        "status": "In Storage",
        "notes": ""
    },
    {
        "type": "Sabre",
        "code": "WS002",
        "hand": "Right",
        "size": "",
        "condition": "Good",
        "status": "In Storage",
        "notes": ""
    },
    {
        "type": "Sabre",
        "code": "WS003",
        "hand": "Right",
        "size": "",
        "condition": "Fair",
        "status": "With Member",
        "notes": ""
    },
    {
        "type": "Sabre",
        "code": "WS004",
        "hand": "Left",
        "size": "",
        "condition": "Fair",
        "status": "In Storage",
        "notes": ""
    },
    {
        "type": "Foil Mask",
        "code": "MF001",
        "hand": "",
        "size": "XS",
        "condition": "Good",
        "status": "In Storage",
        "notes": ""
    },
    {
        "type": "Foil Mask",
        "code": "MF002",
        "hand": "",
        "size": "S",
        "condition": "Good",
        "status": "In Storage",
        "notes": ""
    },
    {
        "type": "Foil Mask",
        "code": "MF003",
        "hand": "",
        "size": "S",
        "condition": "Fair",
        "status": "With Member",
        "notes": ""
    },
    {
        "type": "Foil Mask",
        "code": "MF004",
        "hand": "",
        "size": "M",
        "condition": "Good",
        "status": "In Storage",
        "notes": ""
    },
    {
        "type": "Foil Mask",
        "code": "MF005",
        "hand": "",
        "size": "M",
        "condition": "Good",
        "status": "With Member",
        "notes": ""
    },
    {
        "type": "Foil Mask",
        "code": "MF006",
        "hand": "",
        "size": "M",
        "condition": "Fair",
        "status": "In Storage",
        "notes": ""
    },
    {
        "type": "Foil Mask",
        "code": "MF007",
        "hand": "",
        "size": "L",
        "condition": "Good",
        "status": "In Storage",
        "notes": ""
    },
    {
        "type": "Foil Mask",
        "code": "MF008",
        "hand": "",
        "size": "L",
        "condition": "Poor",
        "status": "Awaiting Repair",
        "notes": "Mesh damaged"
    },
    {
        "type": "Épée Mask",
        "code": "ME001",
        "hand": "",
        "size": "S",
        "condition": "Good",
        "status": "In Storage",
        "notes": ""
    },
    {
        "type": "Épée Mask",
        "code": "ME002",
        "hand": "",
        "size": "M",
        "condition": "Good",
        "status": "In Storage",
        "notes": ""
    },
    {
        "type": "Épée Mask",
        "code": "ME003",
        "hand": "",
        "size": "M",
        "condition": "Fair",
        "status": "With Member",
        "notes": ""
    },
    {
        "type": "Épée Mask",
        "code": "ME004",
        "hand": "",
        "size": "L",
        "condition": "Good",
        "status": "In Storage",
        "notes": ""
    },
    {
        "type": "Épée Mask",
        "code": "ME005",
        "hand": "",
        "size": "L",
        "condition": "Fair",
        "status": "In Storage",
        "notes": "Padding worn"
    },
    {
        "type": "Sabre Mask",
        "code": "MS001",
        "hand": "",
        "size": "S",
        "condition": "Good",
        "status": "In Storage",
        "notes": ""
    },
    {
        "type": "Sabre Mask",
        "code": "MS002",
        "hand": "",
        "size": "M",
        "condition": "Good",
        "status": "In Storage",
        "notes": ""
    },
    {
        "type": "Sabre Mask",
        "code": "MS003",
        "hand": "",
        "size": "M",
        "condition": "Fair",
        "status": "With Member",
        "notes": ""
    },
    {
        "type": "Foil Lamé",
        "code": "LF001",
        "hand": "",
        "size": "XS",
        "condition": "Good",
        "status": "In Storage",
        "notes": ""
    },
    {
        "type": "Foil Lamé",
        "code": "LF002",
        "hand": "",
        "size": "S",
        "condition": "Good",
        "status": "In Storage",
        "notes": ""
    },
    {
        "type": "Foil Lamé",
        "code": "LF003",
        "hand": "",
        "size": "S",
        "condition": "Fair",
        "status": "With Member",
        "notes": ""
    },
    {
        "type": "Foil Lamé",
        "code": "LF004",
        "hand": "",
        "size": "M",
        "condition": "Good",
        "status": "In Storage",
        "notes": ""
    },
    {
        "type": "Foil Lamé",
        "code": "LF005",
        "hand": "",
        "size": "M",
        "condition": "Fair",
        "status": "In Storage",
        "notes": "Conductivity patchy"
    },
    {
        "type": "Foil Lamé",
        "code": "LF006",
        "hand": "",
        "size": "L",
        "condition": "Good",
        "status": "In Storage",
        "notes": ""
    },
    {
        "type": "Sabre Lamé",
        "code": "LS001",
        "hand": "",
        "size": "S",
        "condition": "Good",
        "status": "In Storage",
        "notes": ""
    },
    {
        "type": "Sabre Lamé",
        "code": "LS002",
        "hand": "",
        "size": "M",
        "condition": "Good",
        "status": "With Member",
        "notes": ""
    },
    {
        "type": "Sabre Lamé",
        "code": "LS003",
        "hand": "",
        "size": "M",
        "condition": "Fair",
        "status": "In Storage",
        "notes": ""
    },
    {
        "type": "Sabre Lamé",
        "code": "LS004",
        "hand": "",
        "size": "L",
        "condition": "Poor",
        "status": "Awaiting Repair",
        "notes": "Conductivity failing"
    },
    {
        "type": "Jacket",
        "code": "JK001",
        "hand": "",
        "size": "XS",
        "condition": "Good",
        "status": "In Storage",
        "notes": "Kids"
    },
    {
        "type": "Jacket",
        "code": "JK002",
        "hand": "",
        "size": "XS",
        "condition": "Fair",
        "status": "In Storage",
        "notes": "Kids"
    },
    {
        "type": "Jacket",
        "code": "JK003",
        "hand": "",
        "size": "S",
        "condition": "Good",
        "status": "In Storage",
        "notes": ""
    },
    {
        "type": "Jacket",
        "code": "JK004",
        "hand": "",
        "size": "S",
        "condition": "Good",
        "status": "With Member",
        "notes": ""
    },
    {
        "type": "Jacket",
        "code": "JK005",
        "hand": "",
        "size": "M",
        "condition": "Good",
        "status": "In Storage",
        "notes": ""
    },
    {
        "type": "Jacket",
        "code": "JK006",
        "hand": "",
        "size": "M",
        "condition": "Good",
        "status": "In Storage",
        "notes": ""
    },
    {
        "type": "Jacket",
        "code": "JK007",
        "hand": "",
        "size": "M",
        "condition": "Fair",
        "status": "With Member",
        "notes": ""
    },
    {
        "type": "Jacket",
        "code": "JK008",
        "hand": "",
        "size": "L",
        "condition": "Good",
        "status": "In Storage",
        "notes": ""
    },
    {
        "type": "Jacket",
        "code": "JK009",
        "hand": "",
        "size": "L",
        "condition": "Fair",
        "status": "In Storage",
        "notes": ""
    },
    {
        "type": "Jacket",
        "code": "JK010",
        "hand": "",
        "size": "XL",
        "condition": "Good",
        "status": "In Storage",
        "notes": ""
    },
    {
        "type": "Jacket",
        "code": "JK011",
        "hand": "",
        "size": "M",
        "condition": "Poor",
        "status": "Awaiting Repair",
        "notes": "Zip broken"
    },
    {
        "type": "Plastron",
        "code": "PT001",
        "hand": "Right",
        "size": "XS",
        "condition": "Good",
        "status": "In Storage",
        "notes": "Kids"
    },
    {
        "type": "Plastron",
        "code": "PT002",
        "hand": "Right",
        "size": "S",
        "condition": "Good",
        "status": "In Storage",
        "notes": ""
    },
    {
        "type": "Plastron",
        "code": "PT003",
        "hand": "Right",
        "size": "S",
        "condition": "Good",
        "status": "With Member",
        "notes": ""
    },
    {
        "type": "Plastron",
        "code": "PT004",
        "hand": "Right",
        "size": "M",
        "condition": "Good",
        "status": "In Storage",
        "notes": ""
    },
    {
        "type": "Plastron",
        "code": "PT005",
        "hand": "Right",
        "size": "M",
        "condition": "Fair",
        "status": "In Storage",
        "notes": ""
    },
    {
        "type": "Plastron",
        "code": "PT006",
        "hand": "Right",
        "size": "L",
        "condition": "Good",
        "status": "In Storage",
        "notes": ""
    },
    {
        "type": "Plastron",
        "code": "PT007",
        "hand": "Left",
        "size": "M",
        "condition": "Good",
        "status": "In Storage",
        "notes": ""
    },
    {
        "type": "Chest Protector",
        "code": "CP001",
        "hand": "",
        "size": "XS",
        "condition": "Good",
        "status": "In Storage",
        "notes": ""
    },
    {
        "type": "Chest Protector",
        "code": "CP002",
        "hand": "",
        "size": "S",
        "condition": "Good",
        "status": "In Storage",
        "notes": ""
    },
    {
        "type": "Chest Protector",
        "code": "CP003",
        "hand": "",
        "size": "M",
        "condition": "Good",
        "status": "With Member",
        "notes": ""
    },
    {
        "type": "Chest Protector",
        "code": "CP004",
        "hand": "",
        "size": "L",
        "condition": "Fair",
        "status": "In Storage",
        "notes": ""
    },
    {
        "type": "Breeches",
        "code": "BR001",
        "hand": "",
        "size": "XS",
        "condition": "Good",
        "status": "In Storage",
        "notes": "Kids"
    },
    {
        "type": "Breeches",
        "code": "BR002",
        "hand": "",
        "size": "S",
        "condition": "Good",
        "status": "In Storage",
        "notes": ""
    },
    {
        "type": "Breeches",
        "code": "BR003",
        "hand": "",
        "size": "S",
        "condition": "Good",
        "status": "With Member",
        "notes": ""
    },
    {
        "type": "Breeches",
        "code": "BR004",
        "hand": "",
        "size": "M",
        "condition": "Good",
        "status": "In Storage",
        "notes": ""
    },
    {
        "type": "Breeches",
        "code": "BR005",
        "hand": "",
        "size": "M",
        "condition": "Good",
        "status": "In Storage",
        "notes": ""
    },
    {
        "type": "Breeches",
        "code": "BR006",
        "hand": "",
        "size": "M",
        "condition": "Fair",
        "status": "With Member",
        "notes": ""
    },
    {
        "type": "Breeches",
        "code": "BR007",
        "hand": "",
        "size": "L",
        "condition": "Good",
        "status": "In Storage",
        "notes": ""
    },
    {
        "type": "Breeches",
        "code": "BR008",
        "hand": "",
        "size": "XL",
        "condition": "Fair",
        "status": "In Storage",
        "notes": ""
    },
    {
        "type": "Glove",
        "code": "GL001",
        "hand": "Right",
        "size": "XS",
        "condition": "Good",
        "status": "In Storage",
        "notes": "Kids"
    },
    {
        "type": "Glove",
        "code": "GL002",
        "hand": "Right",
        "size": "S",
        "condition": "Good",
        "status": "In Storage",
        "notes": ""
    },
    {
        "type": "Glove",
        "code": "GL003",
        "hand": "Right",
        "size": "S",
        "condition": "Fair",
        "status": "With Member",
        "notes": ""
    },
    {
        "type": "Glove",
        "code": "GL004",
        "hand": "Right",
        "size": "M",
        "condition": "Good",
        "status": "In Storage",
        "notes": ""
    },
    {
        "type": "Glove",
        "code": "GL005",
        "hand": "Right",
        "size": "M",
        "condition": "Good",
        "status": "With Member",
        "notes": ""
    },
    {
        "type": "Glove",
        "code": "GL006",
        "hand": "Right",
        "size": "L",
        "condition": "Fair",
        "status": "Awaiting Repair",
        "notes": "Stitching loose"
    },
    {
        "type": "Glove",
        "code": "GL007",
        "hand": "Left",
        "size": "S",
        "condition": "Good",
        "status": "In Storage",
        "notes": ""
    },
    {
        "type": "Glove",
        "code": "GL008",
        "hand": "Left",
        "size": "M",
        "condition": "Good",
        "status": "In Storage",
        "notes": ""
    },
    {
        "type": "Manchette",
        "code": "MN001",
        "hand": "Right",
        "size": "",
        "condition": "Good",
        "status": "In Storage",
        "notes": ""
    },
    {
        "type": "Manchette",
        "code": "MN002",
        "hand": "Right",
        "size": "",
        "condition": "Good",
        "status": "With Member",
        "notes": ""
    },
    {
        "type": "Manchette",
        "code": "MN003",
        "hand": "Right",
        "size": "",
        "condition": "Fair",
        "status": "In Storage",
        "notes": ""
    },
    {
        "type": "Manchette",
        "code": "MN004",
        "hand": "Left",
        "size": "",
        "condition": "Good",
        "status": "In Storage",
        "notes": ""
    },
    {
        "type": "Foil Wire",
        "code": "FW001",
        "hand": "",
        "size": "",
        "condition": "Good",
        "status": "In Storage",
        "notes": ""
    },
    {
        "type": "Foil Wire",
        "code": "FW002",
        "hand": "",
        "size": "",
        "condition": "Good",
        "status": "In Storage",
        "notes": ""
    },
    {
        "type": "Foil Wire",
        "code": "FW003",
        "hand": "",
        "size": "",
        "condition": "Good",
        "status": "In Storage",
        "notes": ""
    },
    {
        "type": "Foil Wire",
        "code": "FW004",
        "hand": "",
        "size": "",
        "condition": "Good",
        "status": "With Member",
        "notes": ""
    },
    {
        "type": "Foil Wire",
        "code": "FW005",
        "hand": "",
        "size": "",
        "condition": "Good",
        "status": "With Member",
        "notes": ""
    },
    {
        "type": "Foil Wire",
        "code": "FW006",
        "hand": "",
        "size": "",
        "condition": "Fair",
        "status": "In Storage",
        "notes": ""
    },
    {
        "type": "Foil Wire",
        "code": "FW007",
        "hand": "",
        "size": "",
        "condition": "Fair",
        "status": "In Storage",
        "notes": ""
    },
    {
        "type": "Foil Wire",
        "code": "FW008",
        "hand": "",
        "size": "",
        "condition": "Fair",
        "status": "With Member",
        "notes": ""
    },
    {
        "type": "Foil Wire",
        "code": "FW009",
        "hand": "",
        "size": "",
        "condition": "Poor",
        "status": "Awaiting Repair",
        "notes": "Prong bent"
    },
    {
        "type": "Foil Wire",
        "code": "FW010",
        "hand": "",
        "size": "",
        "condition": "Broken",
        "status": "Awaiting Repair",
        "notes": "Internal break"
    },
    {
        "type": "Foil Wire",
        "code": "FW011",
        "hand": "",
        "size": "",
        "condition": "Good",
        "status": "In Storage",
        "notes": ""
    },
    {
        "type": "Foil Wire",
        "code": "FW012",
        "hand": "",
        "size": "",
        "condition": "Fair",
        "status": "In Storage",
        "notes": ""
    },
    {
        "type": "Épée Wire",
        "code": "EW001",
        "hand": "",
        "size": "",
        "condition": "Good",
        "status": "In Storage",
        "notes": ""
    },
    {
        "type": "Épée Wire",
        "code": "EW002",
        "hand": "",
        "size": "",
        "condition": "Good",
        "status": "In Storage",
        "notes": ""
    },
    {
        "type": "Épée Wire",
        "code": "EW003",
        "hand": "",
        "size": "",
        "condition": "Good",
        "status": "With Member",
        "notes": ""
    },
    {
        "type": "Épée Wire",
        "code": "EW004",
        "hand": "",
        "size": "",
        "condition": "Fair",
        "status": "In Storage",
        "notes": ""
    },
    {
        "type": "Épée Wire",
        "code": "EW005",
        "hand": "",
        "size": "",
        "condition": "Fair",
        "status": "With Member",
        "notes": ""
    },
    {
        "type": "Épée Wire",
        "code": "EW006",
        "hand": "",
        "size": "",
        "condition": "Poor",
        "status": "Awaiting Repair",
        "notes": "Prong loose"
    },
    {
        "type": "Épée Wire",
        "code": "EW007",
        "hand": "",
        "size": "",
        "condition": "Good",
        "status": "In Storage",
        "notes": ""
    },
    {
        "type": "Mask Clip",
        "code": "MC001",
        "hand": "",
        "size": "",
        "condition": "Good",
        "status": "In Storage",
        "notes": ""
    },
    {
        "type": "Mask Clip",
        "code": "MC002",
        "hand": "",
        "size": "",
        "condition": "Good",
        "status": "In Storage",
        "notes": ""
    },
    {
        "type": "Mask Clip",
        "code": "MC003",
        "hand": "",
        "size": "",
        "condition": "Good",
        "status": "With Member",
        "notes": ""
    },
    {
        "type": "Mask Clip",
        "code": "MC004",
        "hand": "",
        "size": "",
        "condition": "Good",
        "status": "With Member",
        "notes": ""
    },
    {
        "type": "Mask Clip",
        "code": "MC005",
        "hand": "",
        "size": "",
        "condition": "Fair",
        "status": "In Storage",
        "notes": ""
    },
    {
        "type": "Mask Clip",
        "code": "MC006",
        "hand": "",
        "size": "",
        "condition": "Fair",
        "status": "In Storage",
        "notes": ""
    },
    {
        "type": "Mask Clip",
        "code": "MC007",
        "hand": "",
        "size": "",
        "condition": "Poor",
        "status": "In Storage",
        "notes": "Spring weak"
    },
    {
        "type": "Mask Clip",
        "code": "MC008",
        "hand": "",
        "size": "",
        "condition": "Broken",
        "status": "Awaiting Repair",
        "notes": "Spring broken"
    },
    {
        "type": "Mask Clip",
        "code": "MC009",
        "hand": "",
        "size": "",
        "condition": "Good",
        "status": "In Storage",
        "notes": ""
    },
    {
        "type": "Mask Clip",
        "code": "MC010",
        "hand": "",
        "size": "",
        "condition": "Fair",
        "status": "In Storage",
        "notes": ""
    }
]
