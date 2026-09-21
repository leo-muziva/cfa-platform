# Getting the CFA Platform running — team setup

*If it "just won't run," 9 times out of 10 it's one of two things: Docker isn't actually open, or you're running the wrong `npm` command. Read the "the one thing that trips people up" section first.*

---

## 1. What needs to be installed, before anything else

| Tool | Why | Mac note | Windows note |
|---|---|---|---|
| **Git** | To clone the repo | Usually pre-installed, or `brew install git` | Comes with Git Bash / GitHub Desktop |
| **Node.js** (22 LTS) | Runs the app | Install via [nodejs.org](https://nodejs.org) or `brew install node` | Install via [nodejs.org](https://nodejs.org) |
| **Docker Desktop** | Runs the local database — this is the one people get wrong | Pick the right download: **Apple Silicon** (M1/M2/M3/M4) vs **Intel** — check via Apple menu → About This Mac | Needs **WSL2** enabled — the installer will prompt for this |

Check Node is installed correctly:
```bash
node -v   # should print v20.x or higher
```

**Docker Desktop has to be a running app, not just installed.** Open it and wait until its icon shows steady/idle (not animating) before doing anything else. This is the single most common reason `supabase start` fails.

---

## 2. Clone and install — identical on Mac and Windows

```bash
git clone <repo-url>
cd cfa-platform
npm install
```

`npm install` reads `package.json` + `package-lock.json` and downloads everything the app needs into a `node_modules` folder. This can take a minute or two the first time.

---

## 3. The standard local command: `npm run dev`

There are **two different ways** to run this app, and using the wrong one is almost certainly what's happening:

| Command | What it needs | Use this if... |
|---|---|---|
| `npm run dev` | A `.env.local` file with real credentials for a live, hosted Supabase project | You've been given real project keys and put them in `.env.local` yourself |
| `npm run dev` | **Nothing but Docker running** — it automatically detects your local Supabase and wires itself up | Standard local development and testing |
| `npm run dev:hosted` | A configured hosted project in `.env.local` | Intentional hosted-project work only |

**Nobody who freshly cloned the repo has a `.env.local` file** — it's gitignored on purpose, so it never gets committed, which means it simply doesn't exist after a fresh `git clone`. A teammate can run `npm run dev` immediately after local Supabase is started. It needs zero configuration and is the supported local workflow.

### The actual steps to run it locally

```bash
npx supabase start     # ① starts a full local database inside Docker
npx supabase db reset  # ② wipes it and loads realistic seed data (coaches, test logins)
npm run dev            # ③ starts the app, auto-connected to that local database
```

Then open **http://localhost:3000** and log in with a seeded test account, e.g.:

```
guardian@cfa.test  /  Test1234!
```

**Step ① the first time will feel slow** — it's downloading several GB of Docker images (the database, the login service, the dashboard, etc.). This can take 5–15 minutes depending on wifi, and it can look "stuck" while it's actually just downloading. Every time after the first is fast.

**Step ② only needs to be run once** (or any time you want to reset back to clean demo data). Skipping it means the app runs, but every list (coaches, members, bookings) is empty.

---

## 4. Local environment variables — only if you want a real `.env.local`

**Skip this section if `npm run dev:local` (§3) is working for you.** It auto-detects all of this — zero setup, nothing to copy-paste. This section exists only for the rare case you want an actual `.env.local` file — e.g. running some other script outside `npm run dev:local`, or you just want to see the real values.

Get these yourself any time by running `npx supabase start` once, then `npx supabase status` — it prints all of them straight to your terminal. Paste into a `.env.local` file in the repo root (gitignored, never committed):

```bash
# LOCAL Supabase only — do NOT use these for the real hosted project
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:15421
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH
SUPABASE_SECRET_KEY=sb_secret_N7UND0UgjKTVK-Uodkm0Hg_xSvEMPvz
NEXT_PUBLIC_SITE_URL=http://localhost:3000
RESEND_API_KEY=
```

| Variable | Where it comes from | How to find your own |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | The **Project URL** row printed by `npx supabase status` | Run that command |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | The **Publishable** row under "Authentication Keys" | Same command |
| `SUPABASE_SECRET_KEY` | The **Secret** row under "Authentication Keys" — server-only, powers the admin "invite member" flow | Same command |
| `NEXT_PUBLIC_SITE_URL` | Not from Supabase — it's just "where is this app running" | Always `http://localhost:3000` locally |
| `RESEND_API_KEY` | Email sending (Phase 3 feature) | Leave blank — not used locally yet |

**Why these exact values are identical for every teammate:** they're not personal secrets. They're generated from `project_id = "cfa-platform"` in `supabase/config.toml` (committed to git) plus the Supabase CLI's fixed default local signing key — anyone who runs `npx supabase start` from this repo gets these exact same values. That's completely different from the real hosted Supabase project's keys, which *are* real secrets, live only as Vercel environment variables, and must never be committed or shared like this.

---

## 5. Troubleshooting table

**Seen most often on Windows — read this one first.** If the site loads fine, but clicking "Sign in" gives a browser error like `TypeError: Failed to fetch`, it's almost never your code or a wrong password. Run `npx supabase status` — if it lists a bunch of `Stopped services` (Auth, Kong/gateway, Studio) and only the database shows as running, that's it. This happens because the `analytics` container that ships with the Supabase CLI regularly crashes on Windows + Docker Desktop, and when it does, the *entire* local stack rolls back and gets left in that half-up state — database alive, but the login service and API gateway aren't, so any `supabase.auth...` call fails outright with "Failed to fetch."

**Exactly what fixes it, permanently — one line changed in `supabase/config.toml`:**
```
[analytics]
enabled = false   # was: true
```
Then apply it:
```bash
npx supabase stop
npx supabase start
```
Analytics isn't needed for local dev anyway — it only powers a log viewer inside Studio.

**Status right now: this fix is only sitting locally, uncommitted, on Leo's machine — it hasn't been pushed yet.** Until it's committed and pushed to `git`, everyone else hits this the first time they run `supabase start` on Windows. Two options for teammates in the meantime:
- **Quick, one-off:** run `npx supabase stop` then `npx supabase start --exclude analytics` — same effect, doesn't touch any files.
- **Permanent, for their own machine:** open `supabase/config.toml`, find the `[analytics]` block, set `enabled = false`, then `npx supabase stop && npx supabase start`.

Once Leo commits and pushes the `config.toml` change, a normal `git pull` + `npx supabase start` is enough for everyone — no manual step needed.

| What they see | What's actually wrong | Fix |
|---|---|---|
| `Cannot connect to the Docker daemon` | Docker Desktop isn't open, or is still starting | Open Docker Desktop, wait for the icon to go steady, try again |
| `Local Supabase is not ready. Start Docker Desktop, run npx supabase start...` | They ran `npm run dev:local` before starting Supabase | Run `npx supabase start` first, then `npm run dev:local` |
| Port already in use / bind error when starting Supabase | A leftover container from a previous session is still holding the port | Run `npx supabase stop`, then `npx supabase start` again |
| `npm install` fails partway, or weird dependency errors | A half-broken `node_modules` from an earlier failed install | Delete the `node_modules` folder, then run `npm ci` (installs the *exact* locked versions instead of re-resolving) |
| App loads but says "missing env vars" or shows a Supabase fetch error | Running `npm run dev` without a `.env.local` — see §3 | Use `npm run dev:local` instead |
| App loads, login works, but every page is empty (no coaches, no members) | Local database has no seed data yet | Run `npx supabase db reset` once |
| `supabase start` seems frozen for a long time | It's pulling several GB of Docker images — normal on the first run | Just let it keep running; check Docker Desktop's own UI to see download progress |
| Everything *was* working, now it isn't, after a reboot | Docker Desktop doesn't always relaunch automatically | Open Docker Desktop manually, then `npx supabase start` again |

---

## 6. Notes for the Mac teammate specifically

Good news: **once Docker and Node are installed correctly, every command from here on is identical to Windows** — `git clone`, `npm install`, `npx supabase start`, `npm run dev:local` are the exact same commands, same terminal, no translation needed. The setup script even auto-detects the operating system to grab the right internal Supabase tool for you.

The two real Mac-specific things to get right:

1. **Download the correct Docker Desktop build** — Apple Silicon (M-series chips) and Intel Macs need different installers. Check which chip via the Apple menu → About This Mac, before downloading.
2. **Give Docker enough memory.** In Docker Desktop → Settings → Resources, if it's set very low (some default installs are conservative), local Supabase's several containers can randomly crash or restart. If things feel flaky, bump the memory allocation up (2–4GB is a reasonable minimum) and restart Docker Desktop.

---

## 7. Quick "did you actually do all of these" checklist

- [ ] Docker Desktop installed **and open** (icon steady, not animating)
- [ ] `node -v` shows 20 or higher
- [ ] `npm install` finished with no errors
- [ ] `npx supabase start` finished (first run can take up to 15 min)
- [ ] `npx supabase db reset` run at least once
- [ ] Using `npm run dev:local` — **not** `npm run dev`
- [ ] Opening `http://localhost:3000`, not some other port
