# CFA Platform — Team Setup Guide

Welcome to the project. Follow this guide to get your machine ready to code.

---

## Step 1 — Software to Install

Install these in order. Click each link.

| Tool | Download | Why |
|------|----------|-----|
| **Node.js LTS** (v20 or v22) | [nodejs.org](https://nodejs.org) | Runs Next.js and npm |
| **Git** | [git-scm.com](https://git-scm.com) | Version control |
| **VS Code** | [code.visualstudio.com](https://code.visualstudio.com) | Code editor |
| **GitHub Desktop** | [desktop.github.com](https://desktop.github.com) | Easier Git for beginners (optional but recommended) |

---

## Step 2 — VS Code Extensions

Open VS Code, press `Ctrl+Shift+X` (Extensions panel), search and install:

- `ESLint` — shows code errors as you type
- `Prettier - Code formatter` — auto-formats your code on save
- `Tailwind CSS IntelliSense` — autocompletes Tailwind class names
- `ES7+ React/Redux/React-Native snippets` — shortcut snippets for React

**Recommended settings** — add these to your VS Code settings (`Ctrl+Shift+P` → "Open User Settings JSON"):
```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode"
}
```

---

## Step 3 — GitHub Account

1. Create a GitHub account at [github.com](https://github.com) if you don't have one.
2. Send your GitHub username to **Leo** so he can add you as a collaborator on the repo.

---

## Step 4 — Clone the Repository

Once Leo has added you as a collaborator and sent you the repo link:

**Option A — GitHub Desktop (recommended for beginners):**
1. Open GitHub Desktop → File → Clone Repository
2. Paste the repo URL → choose where to save it on your computer
3. Click Clone

**Option B — Terminal:**
```bash
git clone https://github.com/<leo-username>/cfa-platform.git
cd cfa-platform
```

---

## Step 5 — Install Project Dependencies

Open a terminal **inside the `cfa-platform` folder** and run:

```bash
npm install
```

This downloads all the packages the project needs. It only needs to run once (or again if `package.json` changes).

---

## Step 6 — Environment Variables (Leo sends you this)

For the shared hosted database, the project needs a `.env.local` file.
**Leo will send you the values in a private message** (never share these publicly).

1. In the `cfa-platform` folder, create a file called `.env.local`
2. Copy the contents from `.env.template` and fill in the values Leo sends you:

```

For local Supabase, do not replace your hosted `.env.local`. Start Docker
Desktop, run `npx supabase start`, and use `npm run dev:local`. The command
gets the local public connection values directly from the Supabase CLI.
NEXT_PUBLIC_SUPABASE_URL=<paste value from Leo>
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<paste value from Leo>
```

---

## Step 7 — Run the Project Locally

```bash
npm run dev
```

Open your browser at **http://localhost:3000** — you should see the app running.

If you see an "env var warning" banner, check Step 6.

---

## Git Workflow (How We Push Code)

We use branches. **Never push directly to `main`.**

### Starting a new task:
```bash
git checkout develop          # make sure you're on develop
git pull                      # get latest changes
git checkout -b feat/your-task-name   # create your branch
```

### Saving your work:
```bash
git add .                     # stage all changes
git commit -m "feat: describe what you did"
git push origin feat/your-task-name
```

### Getting your work into the project:
1. Go to GitHub.com → the repo → Pull Requests → New Pull Request
2. Base: `develop` ← Compare: `feat/your-task-name`
3. Add a short description of what you built
4. Request a review from **Leo**
5. Leo merges it after reviewing

### Branch naming:
- New feature: `feat/profile-page`
- Bug fix: `fix/login-redirect`
- Database changes: `db/add-invoices-table`

---

## Who Is Doing What (Sprint 1)

| Person | Task | Branch name |
|--------|------|-------------|
| **Leo** | Project setup, Supabase, deploy to Vercel | `feat/project-setup` |
| **Jack** | Update app branding + style the auth pages (login, sign-up) with CFA look | `feat/auth-ui` |
| **Reabetswe** | Read and understand the DB migration + data layer; add seed data | `db/seed-data` |
| **Ameer** | Build the admin members list page from scratch (after Leo's setup is done) | `feat/admin-members` |

---

## Project Folder Structure (Quick Reference)

```
cfa-platform/
├── app/               ← Pages and routes (what users see)
│   ├── auth/          ← Login, signup, password reset (ALREADY DONE by template)
│   └── protected/     ← Pages that require login
├── components/        ← Reusable UI pieces
│   └── ui/            ← shadcn components (Button, Input, Card, etc.)
├── lib/
│   ├── supabase/      ← Database client setup (don't touch)
│   ├── repositories/  ← Database queries (read this to learn)
│   ├── services/      ← Business logic (read this to learn)
│   └── validations/   ← Form validation schemas
├── types/             ← TypeScript type definitions
└── supabase/
    └── migrations/    ← SQL files that set up the database
```

---

## Useful Commands

| Command | What it does |
|---------|-------------|
| `npm run dev` | Start local development server |
| `npm run build` | Build for production (check for errors) |
| `npm run lint` | Check for code style issues |
| `git status` | See what files you've changed |
| `git pull` | Get latest code from GitHub |

---

## Getting Help
- Check the [PRD.md](PRD.md) if you're unsure what to build
- Check the [CLAUDE-CONTEXT.md](CLAUDE-CONTEXT.md) for architecture decisions
- Stack Overflow and Next.js docs are your friends
