# CFA Equipment Register

Split-file version of the original single-HTML equipment register. Same look,
same data (117 seeded items across 17 equipment types), same CRUD behaviour —
just organised as a small Python backend + database instead of one file with
everything crammed into browser localStorage.

## File structure

```
cfa_equipment_app/
├── app.py            Flask app: routes, validation, business logic
├── database.py       SQLite schema, connection, and query functions
├── seed_data.py       Reference data (equipment types, categories, the
│                      original 117-item seed list) — single source of
│                      truth, used by both the backend and the frontend
├── requirements.txt   Python dependencies (just Flask)
├── equipment.db        Created automatically on first run — this IS the
│                       database file (delete it to reset back to seed data)
├── templates/
│   └── index.html      Page shell (loads React/Babel/Tailwind + app.js)
└── static/
    └── app.js           Frontend: renders the UI, calls the API in app.py
```

## Why these choices

- **SQLite, not localStorage.** LocalStorage only exists in one browser on
  one device. SQLite is a real (if simple) database — a single file,
  `equipment.db`, that any Python process can read and write, and that
  survives clearing your browser data.
- **Flask, not the main platform's stack.** This is still the standalone
  side tool, separate from the Next.js/Supabase CFA platform — no point
  dragging in Node/Supabase for something this small. If it later needs to
  become a real feature on the main site, `database.py` is the one place
  that would need rewriting to talk to Supabase instead of SQLite; `app.py`
  and the frontend wouldn't need to change much.
- **Validation lives on the server now, not just the browser.** The
  original version checked things like "Foil needs a handedness" only in
  the browser. `app.py` checks again independently, so the rule can't be
  bypassed by anyone editing the page's JavaScript.

## Running it

```bash
pip install -r requirements.txt
python app.py
```

Then open **http://localhost:5000** in a browser. First run creates
`equipment.db` and seeds it with the original 117 items automatically.

To reset back to the original seed data, stop the server and delete
`equipment.db`, then run `python app.py` again.
