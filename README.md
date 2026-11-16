# Cape Fencing Academy Platform

A full-stack member platform for **Cape Fencing Academy**, a fencing club in Rondebosch, Cape Town. Members, parents, coaches and club staff use it to handle memberships, families, private lessons, invoices, payments and kit orders.

**Live demo:** https://cfa-platform-pi.vercel.app

![Cape Fencing Academy crest with the text Member Platform](app/opengraph-image.png)

Built with Next.js 16, React 19, TypeScript, Supabase (Postgres, Auth and row level security), Tailwind CSS, Zod and Vitest.

---

## Try it

Anyone can create an account and explore the member side of the platform for free.

1. Open https://cfa-platform-pi.vercel.app and click **Sign up** (or **Log in** if you already have an account).
2. Click **Continue with Google**, or sign up with an email address and password and confirm your email.
3. Complete your profile when asked.

Things to try as a new member:

| Area | Where | What to look at |
| --- | --- | --- |
| Public site | Home, About, Classes, Membership, Contact | Cinematic video hero, responsive layout, light and dark themes |
| Membership | Top bar, then **Membership** | Apply for a membership and follow its status |
| Lessons | Top bar, then **Book** | Pick a coach and a 30-minute slot on the live availability calendar |
| My lessons | Member Portal, then **Lessons** | Cancel or reschedule, with the cancellation rules enforced on the server |
| Family | Member Portal, then **Family** | Link a dependent (under 18) or a guardian who pays for them |
| Billing | Member Portal, then **Billing** | Invoices, receipts and payment status in rands (ZAR) |
| Shop | Top bar, then **Shop** | Order club kit by size and handedness |

Coach and admin portals aren't open to the public. A new account is always an ordinary member, and staff roles can only be granted by club staff.

> Payments run in **PayFast sandbox** mode, so no real money moves. Use PayFast's test card details if you go through a checkout.

---

## What it does

- **Accounts and profiles:** email/password sign-up with email confirmation, Google sign-in, password reset, and profile completion with emergency contacts.
- **Memberships:** applications, approval by staff, lifecycle status and membership products stored in the database.
- **Families:** a guardian can link and pay for dependents. Dependents can book lessons but never see money. Unlinking or transferring needs staff approval.
- **Lesson booking:** coaches publish standing weekly availability plus one-off extra times, blocks and club closures. Members see every offered 30-minute slot as either bookable or **Unavailable**, without revealing why.
- **Booking integrity:** booking, rescheduling and cancelling are rechecked atomically inside Postgres, so two people can never take the same slot.
- **Billing:** charges, monthly invoice runs on the 25th, immutable issued invoices, PDF invoices, receipts, credits and refunds.
- **Payments:** a provider-neutral checkout and settlement flow with a PayFast sandbox adapter, including pay-now slot holds that expire automatically.
- **Shop:** kit orders with payment, plus supplier order sheets for staff.
- **AI supplier check:** a small tool-calling agent (Groq or Gemini free tier) reviews supplier order sheets for mistakes and drafts an email. It only sees product lines, never member data.
- **Scheduled jobs:** Vercel Cron expires unpaid holds daily and runs the monthly invoice job.
- **Email:** sign-up, password reset, payment requests and order confirmations are sent through SMTP.

---

## Tech stack

| Layer | Technology |
| --- | --- |
| Framework | Next.js 16 App Router, React 19, Server Components and Server Actions |
| Language | TypeScript (strict) |
| Styling | Tailwind CSS 3, shadcn/ui-style primitives, light and dark themes |
| Database | Supabase Postgres with 60+ forward migrations, RPC functions and row level security |
| Auth | Supabase Auth: email/password with confirmation, plus Google OAuth |
| Validation | Zod 4 on every mutation |
| Payments | PayFast sandbox behind a provider-neutral payment service |
| AI | Vercel AI SDK with Groq and Google Gemini |
| Testing | Vitest unit tests and pgTAP database workflow tests |
| Hosting | Vercel (app and cron) and Supabase (database and auth) |

---

## Architecture

```
Page / Server Action  ->  Service  ->  Repository  ->  Supabase (Postgres + RLS)
     app/               lib/services/   lib/repositories/      supabase/migrations/
```

- **`app/`** holds routes, layouts and Server Actions. Pages are Server Components by default.
- **`lib/services/`** holds business rules and authorization checks, e.g. who may book, cancel or pay.
- **`lib/repositories/`** holds all database access. UI components never query domain tables directly.
- **`lib/validations/`** holds Zod schemas. Every action returns a typed success or failure result.
- **`types/domain.ts`** holds the shared contracts between layers.
- **Security in depth:** permissions are checked in services, again in Postgres RPC functions, and again by row level security policies. Hiding a button is never the only protection.
- Money is handled in integer cents and formatted as ZAR with `en-ZA` dates.

---

## Run it locally

You'll need Node.js 22 and Docker Desktop.

```bash
npm ci                    # install exact dependency versions
npx supabase start        # start local Supabase in Docker
npx supabase db reset     # apply migrations and load demo data
npm run dev               # http://localhost:3000
```

`npm run dev` reads the local Supabase settings automatically, so you don't need an environment file. Use `npm run dev:hosted` only when you've configured a hosted Supabase project in `.env.local` (start from `.env.sample`).

### Local demo data

`npx supabase db reset` loads a demo club: member, guardian, coach and admin personas, a guardian and dependent household, coach availability, a blocked time, a club closure, scheduled lessons and provisional charges. The personas are defined in `supabase/seed.sql` and exist only in your local database.

### Checks

```bash
npm test -- --run         # Vitest unit tests
npm run test:db-workflows # pgTAP database workflow tests (local Supabase)
npm run lint              # ESLint
npx tsc --noEmit          # TypeScript
npm run build             # production build
```

---

## Project status

This is a student project built for Cape Fencing Academy as part of INF3003W at the University of Cape Town. Payments use the PayFast sandbox only. Production payments (Peach Payments), saved cards and some notification types are planned but not live.

## Privacy

See the [privacy policy](https://cfa-platform-pi.vercel.app/privacy) for how the platform handles personal information.
