# CFA Platform — Team Environment Setup Guide

This guide gets every Group 17 member running the CFA platform locally with their own
`.env.local` file. It contains **no secret values** — it explains where each key comes
from and how to get access.

---

## 1. What the app needs

The app reads its configuration from a file called `.env.local` in the repo root.
This file is **gitignored** — it never gets committed, so each person creates their own.

| Key | What it is | Secret? |
|-----|------------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | The URL of our shared Supabase project | No — safe to share in team chat |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | The public ("anon"/publishable) key. It's designed to be exposed to browsers — Row-Level Security protects the data | No — safe to share in team chat |
| `SUPABASE_SECRET_KEY` | The **secret / service-role key**. It **bypasses all Row-Level Security** — anyone holding it has full read/write access to our entire database | **YES — handle carefully (see §3)** |
| `NEXT_PUBLIC_SITE_URL` | Just the app's own URL | No — everyone uses `http://localhost:3000` |
| `RESEND_API_KEY` | Email sending (Phase 3 invoicing) | Leave **blank** for now |

We all connect to the **same shared Supabase project** (Leo's) — do not create your own
Supabase project, or your data and schema will be different from everyone else's.

---

## 2. One-time setup for each team member

1. Clone the repo and install dependencies:
   ```bash
   git clone <repo-url>
   cd cfa-platform
   npm install
   ```
2. Copy the template:
   ```bash
   # Windows (PowerShell)
   Copy-Item .env.example .env.local

   # Mac/Linux
   cp .env.example .env.local
   ```
3. Fill in the values (where to get them is in §3 below):
   ```
   NEXT_PUBLIC_SUPABASE_URL=<from Supabase dashboard>
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<from Supabase dashboard>
   SUPABASE_SECRET_KEY=<from Supabase dashboard — keep private>
   NEXT_PUBLIC_SITE_URL=http://localhost:3000
   RESEND_API_KEY=
   ```
4. Verify it works:
   ```bash
   npm run dev
   ```
   Open http://localhost:3000 — the site should load, and logging in on
   `/auth/login` should work. If you see "Invalid API key" or a fetch error,
   a value was pasted wrong (watch for trailing spaces or missing characters).

---

## 3. Getting the keys — two options

### Option A (recommended): Leo invites you to the Supabase project

This is the proper way — everyone reads the keys themselves from the dashboard,
and nothing sensitive travels through chat apps.

**Leo does this once per teammate:**

1. Go to https://supabase.com/dashboard and open the organization that owns the
   CFA project.
2. Open **Organization settings → Team** (in older UI: the org page → "Team" tab).
3. Click **Invite member**, enter the teammate's email address, and give them the
   **Developer** role (enough to view project settings and API keys; **Owner**
   is not needed).
4. The teammate receives an email invite → accepts → creates/uses their own free
   Supabase account.

**Each teammate then does:**

1. Go to https://supabase.com/dashboard and log in with the account that
   accepted the invite.
2. Switch to **Leo's organization** (org switcher, top-left — not your own
   personal org) and open the **CFA project**.
3. Click the gear icon at the bottom of the left sidebar: **Project Settings**,
   then under Configuration click **API Keys** (older UI: **Settings → API**).
4. Copy these into your `.env.local`:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **Publishable key** (starts with `sb_publishable_`; on older projects this is
     the **anon** key) → `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   - **Secret key**: in the *Secret keys* section, click **Reveal** on the default
     key and copy it (starts with `sb_secret_`). On older projects, open the
     *Legacy API keys* tab instead and reveal/copy **service_role** — same thing,
     older naming. → `SUPABASE_SECRET_KEY`
5. Paste values with no quotes and no trailing spaces, then **restart the dev
   server** (`Ctrl+C`, `npm run dev`) — Next.js only reads env files at startup.

> **"Reveal" greyed out or permissions error?** Your organization role is too low
> to view secret keys. Ask Leo to raise your role (Organization settings → Team →
> change role to Developer, or Administrator if Developer still can't reveal).

### Option B (fallback): Leo shares the values directly

If dashboard invites are a problem, Leo can send the values — but the secret key
needs care:

- The **URL** and **publishable key** can go in the normal group chat — they are
  public by design.
- The **secret key** should be shared via something that doesn't keep a permanent,
  searchable copy — e.g. a password manager share, a one-time-secret link
  (such as onetimesecret.com), or in person. Avoid leaving it sitting in a
  WhatsApp/Discord history.

---

## 4. Rules — read these, they protect the project

- **Never commit `.env.local`** or paste key values into code, comments, GitHub
  issues, or PRs. Only `.env.example` (names, no values) lives in the repo.
- **Never use `SUPABASE_SECRET_KEY` in browser/client code.** It is server-only
  (used by the admin invite flow). Anything prefixed `NEXT_PUBLIC_` gets bundled
  into the browser — that's why the secret key must never carry that prefix.
- If the secret key ever leaks (committed by accident, pasted publicly), tell Leo
  immediately — it can be **rotated** in Supabase under Project Settings → API Keys,
  and everyone updates their `.env.local` with the new value.
- Production values live in **Vercel environment variables**, managed by Leo —
  nothing to do locally.

---

## 5. Quick FAQ

**Do I need my own Supabase account?** Yes (free), but only to *view* our shared
project — don't create a new project.

**The dashboard shows "anon" and "service_role" instead of "publishable" and
"secret".** Same thing, older naming. anon → publishable, service_role → secret.

**`npm run dev` says missing env vars.** Your `.env.local` is missing, in the wrong
folder (it must be in the repo root, next to `package.json`), or has typos in the
key names.

**Login works but I see no data.** That's usually Row-Level Security doing its job —
your logged-in user may not have a profile row or the right role yet. Ask Leo to
check your row in the `profiles` table.
