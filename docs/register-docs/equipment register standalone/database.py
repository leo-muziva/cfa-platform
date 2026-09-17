"""
Database layer for the CFA Equipment Register.

Uses SQLite (equipment.db, created automatically next to this file on first
run) instead of the browser localStorage the original single-file version
used. SQLite was chosen deliberately over something heavier: this is a
standalone side tool, not the main CFA platform (which already uses
Supabase/Postgres) -- SQLite needs no separate server or setup, and the whole
database is just one file you can back up, delete, or hand to a teammate.

If this ever needs to become a real multi-user feature on the main platform,
swap this module out for Supabase calls -- everything in app.py that talks to
the database goes through the functions below, so that would be a contained
change rather than a rewrite of the app.
"""

import sqlite3
from pathlib import Path

from seed_data import SEED

DB_PATH = Path(__file__).parent / "equipment.db"

SCHEMA = """
CREATE TABLE IF NOT EXISTS equipment (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    type      TEXT NOT NULL,
    code      TEXT NOT NULL UNIQUE,
    hand      TEXT NOT NULL DEFAULT '',
    size      TEXT NOT NULL DEFAULT '',
    condition TEXT NOT NULL,
    status    TEXT NOT NULL,
    notes     TEXT NOT NULL DEFAULT ''
);
"""


def get_db():
    """Open a connection with row access by column name (like a dict)."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    """Create the table if it doesn't exist, and seed it on first run only.

    Safe to call every time the app starts: if equipment.db already has
    rows, the seed data is skipped so nothing gets duplicated or reset.
    """
    conn = get_db()
    conn.executescript(SCHEMA)
    conn.commit()

    count = conn.execute("SELECT COUNT(*) AS n FROM equipment").fetchone()["n"]
    if count == 0:
        conn.executemany(
            """
            INSERT INTO equipment (type, code, hand, size, condition, status, notes)
            VALUES (:type, :code, :hand, :size, :condition, :status, :notes)
            """,
            SEED,
        )
        conn.commit()

    conn.close()


def row_to_dict(row):
    return {
        "id": row["id"],
        "type": row["type"],
        "code": row["code"],
        "hand": row["hand"],
        "size": row["size"],
        "condition": row["condition"],
        "status": row["status"],
        "notes": row["notes"],
    }


def get_all_equipment():
    conn = get_db()
    rows = conn.execute("SELECT * FROM equipment ORDER BY id").fetchall()
    conn.close()
    return [row_to_dict(r) for r in rows]


def get_equipment_by_code(code, exclude_id=None):
    """Used for the 'code already in use' check. exclude_id lets an item's
    own code not collide with itself during an edit."""
    conn = get_db()
    if exclude_id is None:
        row = conn.execute(
            "SELECT * FROM equipment WHERE code = ?", (code,)
        ).fetchone()
    else:
        row = conn.execute(
            "SELECT * FROM equipment WHERE code = ? AND id != ?", (code, exclude_id)
        ).fetchone()
    conn.close()
    return row_to_dict(row) if row else None


def insert_equipment(item):
    conn = db = get_db()
    cur = db.execute(
        """
        INSERT INTO equipment (type, code, hand, size, condition, status, notes)
        VALUES (:type, :code, :hand, :size, :condition, :status, :notes)
        """,
        item,
    )
    db.commit()
    new_id = cur.lastrowid
    row = db.execute("SELECT * FROM equipment WHERE id = ?", (new_id,)).fetchone()
    db.close()
    return row_to_dict(row)


def update_equipment(item_id, item):
    conn = get_db()
    conn.execute(
        """
        UPDATE equipment
        SET type = :type, code = :code, hand = :hand, size = :size,
            condition = :condition, status = :status, notes = :notes
        WHERE id = :id
        """,
        {**item, "id": item_id},
    )
    conn.commit()
    row = conn.execute("SELECT * FROM equipment WHERE id = ?", (item_id,)).fetchone()
    conn.close()
    return row_to_dict(row) if row else None


def delete_equipment(item_id):
    conn = get_db()
    cur = conn.execute("DELETE FROM equipment WHERE id = ?", (item_id,))
    conn.commit()
    deleted = cur.rowcount > 0
    conn.close()
    return deleted


def next_code(type_name, types_config):
    """Mirrors the original frontend's nextCode(): find the highest existing
    number for this type's code prefix and return prefix + next number,
    zero-padded to 3 digits (e.g. WF010 -> WF011)."""
    prefix = types_config.get(type_name, {}).get("prefix")
    if not prefix:
        return ""
    conn = get_db()
    rows = conn.execute(
        "SELECT code FROM equipment WHERE code LIKE ?", (prefix + "%",)
    ).fetchall()
    conn.close()
    max_n = 0
    for r in rows:
        suffix = r["code"][len(prefix):]
        if suffix.isdigit():
            max_n = max(max_n, int(suffix))
    return f"{prefix}{max_n + 1:03d}"
