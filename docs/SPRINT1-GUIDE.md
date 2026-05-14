# CFA Platform — Sprint 1 Guide

A reference for what's been done, what still needs to be built, and where to learn how to build it.

---

## What's Already Done

### 1. Project Scaffold
The entire project was generated using the official Next.js + Supabase starter template.

```bash
npx create-next-app -e with-supabase cfa-platform
```

**Source code of the template:**
https://github.com/vercel/next.js/tree/canary/examples/with-supabase

---

### 2. Supabase Clients — `lib/supabase/server.ts` and `lib/supabase/client.ts`

Two separate Supabase clients — one for the server (Server Components, Server Actions) and one for the browser. Do not modify these.

**Docs:**
https://supabase.com/docs/guides/auth/server-side/nextjs
> Read the "Create a Supabase client" section. It explains why there are two separate files.

---

### 3. Auth Pages — `app/auth/`

All authentication pages are pre-built:
- `/auth/login` — Login with email + password
- `/auth/sign-up` — Register a new account
- `/auth/forgot-password` — Request a password reset
- `/auth/confirm` — Handles email confirmation links
- `/auth/update-password` — Set a new password

**Docs:**
https://supabase.com/docs/guides/auth/server-side/nextjs#create-a-login-page

---

### 4. Protected Route Pattern — `app/protected/page.tsx`

Shows how to check if a user is logged in inside a Server Component and redirect them if not.

**Docs:**
https://nextjs.org/docs/app/building-your-application/authentication
> Read the "Protecting Routes" section.

---

### 5. UI Components — `components/ui/`

Pre-built accessible components: Button, Input, Label, Card, Badge, Checkbox, Dropdown.
These come from shadcn/ui and are copied directly into the project so you can read and edit them.

**Docs:**
https://ui.shadcn.com/docs/components/button
> Swap `button` in the URL for any component name (e.g. `card`, `input`, `badge`).

---

### 6. Database Migration — `supabase/migrations/0001_profiles.sql`

Sets up the database. Creates:
- `membership_types` table (Junior, Senior, Social tiers)
- `profiles` table (extends Supabase's built-in `auth.users`)
- Row-Level Security (RLS) policies so users can only see their own data
- A trigger that automatically creates a profile row when someone signs up

**Docs:**
- Tables and RLS: https://supabase.com/docs/guides/database/tables
- Triggers: https://supabase.com/docs/guides/database/functions
- RLS policies: https://supabase.com/docs/guides/database/postgres/row-level-security

---

### 7. TypeScript Types — `types/domain.ts`

Shared types used across the whole project: `Profile`, `Role`, `MembershipType`, `ProfileUpdate`.
Read this file before writing any code so you know the shape of the data.

---

### 8. Data Layer — `lib/repositories/` and `lib/services/`

These exist as a **pattern reference** — read them before writing your pages.

| File | What it shows |
|------|--------------|
| `lib/repositories/MemberRepository.ts` | How to write a Supabase query (select, update, join) |
| `lib/services/MemberService.ts` | How to combine auth checks + validation + a repository call |
| `lib/validations/member.schema.ts` | How to write a Zod schema for a form |

**Docs:**
- Supabase select queries: https://supabase.com/docs/reference/javascript/select
- Zod schemas: https://zod.dev/?id=basic-usage

---

## What Still Needs to Be Built

### Leo — Member Profile Page
**File to create:** `app/protected/profile/page.tsx`

A page where a logged-in member can view and edit their own profile (name, phone, date of birth).

**What it needs to do:**
1. Get the logged-in user's ID from Supabase Auth
2. Fetch their row from the `profiles` table
3. Display the data in a form
4. On submit, save the updated values back to Supabase

**Docs to read (in this order):**
1. How async Server Components work (fetching data without useEffect):
   https://nextjs.org/docs/app/building-your-application/data-fetching/fetching
2. How Server Actions work (submitting a form without an API route):
   https://nextjs.org/docs/app/building-your-application/data-fetching/server-actions-and-mutations
3. How to get the logged-in user:
   https://supabase.com/docs/reference/javascript/auth-getuser
4. How to query a table:
   https://supabase.com/docs/reference/javascript/select

**Pattern to follow:** Read `app/protected/page.tsx` (already exists) — your page follows the same structure.

---

### Ameer — Admin Members List Page
**File to create:** `app/protected/admin/members/page.tsx`

A page only admins can access that shows a table of all members.

**What it needs to do:**
1. Check that the logged-in user has the `admin` role (redirect if not)
2. Fetch all rows from the `profiles` table
3. Display them in an HTML table with name, email, role, membership, and join date

**Docs to read (in this order):**
1. Server Components — why there's no useState/useEffect on this page:
   https://nextjs.org/docs/app/building-your-application/rendering/server-components
2. Fetching all rows from a Supabase table:
   https://supabase.com/docs/reference/javascript/select
3. Styling a table with Tailwind:
   https://tailwindcss.com/docs/table-layout

**Pattern to follow:** Read `lib/services/MemberService.ts` → look at the `getMembersForAdmin` function — that's the service call your page will use.

---

### Jack — Branding + Auth Page Styling
**Files to update:**
- `app/protected/layout.tsx` — replace "Next.js Supabase Starter" with "Cape Fencing Academy"
- `app/auth/login/page.tsx` and `app/auth/sign-up/page.tsx` — apply CFA colours and logo

**What it needs to do:**
1. Update the nav title and footer text to say CFA instead of the template defaults
2. Style the login and sign-up pages to look like a CFA product (colours, logo placeholder, clean layout)

**Docs to read:**
1. Tailwind utility classes:
   https://tailwindcss.com/docs/utility-first
2. How Next.js layouts work (so you understand what you're editing):
   https://nextjs.org/docs/app/building-your-application/routing/layouts-and-templates
3. shadcn/ui components available to use:
   https://ui.shadcn.com/docs/components/card

---

### Reabetswe — Seed Data
**File to create:** `supabase/seed.sql`

A SQL file that inserts test data so the team can develop without entering data manually every time.

**What it needs to do:**
Insert a few fake profiles with different roles (admin, coach, fencer, guardian) so the pages have data to display during development.

**Docs to read:**
1. Supabase seed data guide:
   https://supabase.com/docs/guides/database/seed-your-database
2. PostgreSQL INSERT syntax:
   https://www.postgresqltutorial.com/postgresql-tutorial/postgresql-insert-multiple-rows/

**Note:** Read `supabase/migrations/0001_profiles.sql` first so you know the exact column names before writing inserts.

---

## Setup Checklist Before Any Coding

- [ ] Leo: Create Supabase project, copy URL + publishable key into `.env.local`
- [ ] Leo: Run the migration SQL in the Supabase SQL editor
- [ ] Leo: Create the GitHub repo, push the project, invite teammates
- [ ] Everyone: Clone the repo, run `npm install`, run `npm run dev`
- [ ] Everyone: Sign up at `localhost:3000/auth/sign-up` and confirm it works
