"""
CFA Equipment Register -- Flask backend.

This holds all the logic that used to live inline in the browser's React
code: validation rules, item-code generation, and now persistence via
database.py. The frontend (static/app.js) is now a thin layer that just
renders state and calls these API endpoints -- it doesn't decide what's
valid on its own anymore, the server does. That matters even for a small
tool like this: it means someone can't bypass a rule (like "Foil needs a
handedness") just by editing browser JavaScript, because the server checks
again independently.

Run with:  python app.py
Then open: http://localhost:5000
"""

from flask import Flask, jsonify, request, render_template

import database
from seed_data import (
    TYPES, CATEGORIES, TYPE_ORDER, SIZES, CONDITIONS, STATUSES,
    STATUS_COLOR, COND_COLOR,
)

app = Flask(__name__)


# ---------------------------------------------------------------------------
# Validation -- mirrors the checks the original save() function did in the
# browser, now enforced server-side so they can't be skipped.
# ---------------------------------------------------------------------------
def validate_item(form, editing_id=None):
    """Returns an error message string, or None if the item is valid."""
    item_type = form.get("type", "")
    code = (form.get("code") or "").strip()

    if not item_type or not code:
        return "Type and code are required."

    type_info = TYPES.get(item_type)
    if not type_info:
        return f'Unknown equipment type "{item_type}".'

    if type_info["size"] and not form.get("size"):
        return "Select a size."
    if type_info["hand"] and not form.get("hand"):
        return "Select handedness."

    if form.get("condition") not in CONDITIONS:
        return "Invalid condition."
    if form.get("status") not in STATUSES:
        return "Invalid status."

    existing = database.get_equipment_by_code(code.upper(), exclude_id=editing_id)
    if existing:
        return f'Code "{code.upper()}" is already in use.'

    return None


def normalise_item(form):
    """Builds a clean dict with exactly the columns the DB expects, applying
    the same defaults the original frontend used (blank hand/size when the
    type doesn't need them)."""
    item_type = form.get("type", "")
    type_info = TYPES.get(item_type, {})
    return {
        "type": item_type,
        "code": (form.get("code") or "").strip().upper(),
        "hand": form.get("hand", "") if type_info.get("hand") else "",
        "size": form.get("size", "") if type_info.get("size") else "",
        "condition": form.get("condition", "Good"),
        "status": form.get("status", "In Storage"),
        "notes": form.get("notes", "") or "",
    }


# ---------------------------------------------------------------------------
# Page
# ---------------------------------------------------------------------------
@app.route("/")
def index():
    return render_template("index.html")


# ---------------------------------------------------------------------------
# API
# ---------------------------------------------------------------------------
@app.route("/api/config")
def api_config():
    """Static reference data the frontend needs to build the form and
    groupings -- served from the same Python source of truth (seed_data.py)
    used for backend validation, so the two can't drift out of sync."""
    return jsonify({
        "types": TYPES,
        "categories": CATEGORIES,
        "typeOrder": TYPE_ORDER,
        "sizes": SIZES,
        "conditions": CONDITIONS,
        "statuses": STATUSES,
        "statusColor": STATUS_COLOR,
        "condColor": COND_COLOR,
    })


@app.route("/api/equipment", methods=["GET"])
def list_equipment():
    return jsonify(database.get_all_equipment())


@app.route("/api/equipment/next-code")
def api_next_code():
    item_type = request.args.get("type", "")
    return jsonify({"code": database.next_code(item_type, TYPES)})


@app.route("/api/equipment", methods=["POST"])
def create_equipment():
    form = request.get_json(force=True) or {}
    error = validate_item(form)
    if error:
        return jsonify({"error": error}), 400
    item = normalise_item(form)
    created = database.insert_equipment(item)
    return jsonify(created), 201


@app.route("/api/equipment/<int:item_id>", methods=["PUT"])
def update_equipment(item_id):
    form = request.get_json(force=True) or {}
    error = validate_item(form, editing_id=item_id)
    if error:
        return jsonify({"error": error}), 400
    item = normalise_item(form)
    updated = database.update_equipment(item_id, item)
    if updated is None:
        return jsonify({"error": "Item not found."}), 404
    return jsonify(updated)


@app.route("/api/equipment/<int:item_id>", methods=["DELETE"])
def delete_equipment(item_id):
    deleted = database.delete_equipment(item_id)
    if not deleted:
        return jsonify({"error": "Item not found."}), 404
    return jsonify({"deleted": True})


if __name__ == "__main__":
    database.init_db()
    app.run(debug=True, port=5000)
