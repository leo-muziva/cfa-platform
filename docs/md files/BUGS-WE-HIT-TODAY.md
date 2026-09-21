# Bugs we hit today — what they were, and what to do

*Four things went wrong while getting the demo working. This is what each one actually was, in plain English, and exactly what to do about it. Nothing here is scary — three are already fixed for you, one is a five-minute Windows setting.*

---

## 1. Login says "Failed to fetch"

**What you'd see:** clicking "Sign in" does nothing, and the browser console shows `TypeError: Failed to fetch`.

**What was actually wrong:** your local database (Supabase) is really a handful of small programs running inside Docker — one for login, one for the database itself, one for the dashboard, and so on. One of those programs (analytics — just a log viewer, nothing important) crashes on Windows. When it crashes, Docker panics and shuts the *whole group* down, including the login program. So login fails, even though nothing about your code or your password is wrong.

**Status: ✅ already fixed, merged into git.** All you need to do:
```bash
git pull
npx supabase stop
npx supabase start
```
That's it — you won't hit this at all going forward.

**If you somehow still see it** (e.g. haven't pulled yet), run:
```bash
npx supabase start --exclude analytics
```
as a one-off workaround.

---

## 2. "It was working, now it's not" (nothing changed, but login fails again)

**What you'd see:** the app was working earlier, then suddenly login fails again, with no error you did anything to cause.

**What was actually wrong:** the website itself (`npm run dev:local`) is a separate program from the database (`supabase start`). If the terminal window running the website gets closed, or the laptop sleeps, that program just stops — silently. There's nothing left listening on `localhost:3000`, so anything you do just fails.

**Fix — just start it again:**
```bash
npx supabase start      # make sure the database side is up
npm run dev:local        # start the website
```
**Rule of thumb:** if *anything* about the site misbehaves, the very first thing to check is "is `npm run dev:local` actually still running in a terminal window somewhere?" — nine times out of ten, that's the whole problem.

---

## 3. Docker won't start on Windows — mentions "WSL"

**What you'd see:** Docker Desktop refuses to start, or `supabase start` fails immediately with a Docker connection error.

**What was actually wrong:** Docker on Windows needs a lightweight Linux environment called **WSL2** built in — Docker itself is a Linux technology, so Windows borrows a bit of Linux under the hood to run it. Some machines don't have this switched on yet.

**Fix (Windows only — Mac doesn't need this at all):**
1. Open **PowerShell as Administrator**
2. Run:
   ```powershell
   wsl --install
   ```
3. **Restart the computer** — required, not optional
4. Open Docker Desktop again — it should start cleanly

Check it worked with `wsl --status` — it should say `Default Version: 2`.

If `wsl --install` itself fails, Windows is probably out of date — run Windows Update first, then try again.

---

## 4. Console warnings about "hydration mismatch" / `fdprocessedid`

**What you'd see:** a red console error mentioning "hydrated but some attributes... didn't match," pointing at a button or a form input, with a mysterious attribute called `fdprocessedid`.

**What was actually wrong:** nothing in our code. `fdprocessedid` is a tag left behind by the **LastPass** browser extension (or similar password managers) — it scans every button and input on the page the instant it loads, and tags each one. React expects the page to look exactly like what the server sent, sees LastPass's extra tag, and complains. This happens on *any* React site with LastPass installed — it's not specific to this app.

**Fix: nothing to fix in the code.** To confirm it's just the extension:
- Open the site in an **Incognito/Private window** (extensions are off by default there), or
- Disable LastPass in `chrome://extensions`
- Reload — the warning disappears

**For demo day specifically:** present from an Incognito window (or a browser profile with no extensions) so this warning never shows up on screen at all — one less thing to explain live if someone glances at the console.

---

## The one-line version, if someone's in a rush

| Symptom | Fix |
|---|---|
| Login: "Failed to fetch" | `git pull` then `npx supabase stop && npx supabase start` |
| Site was working, now isn't | Check `npm run dev:local` is still running — restart it |
| Docker won't start (Windows) | `wsl --install` in an admin PowerShell, then restart PC |
| Weird `fdprocessedid` console warning | Ignore it, or disable LastPass / use Incognito |
