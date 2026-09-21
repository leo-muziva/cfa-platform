# CFA Platform v1.0

CFA Platform is the Cape Fencing Academy member portal. It supports account and membership workflows, household and payer relationships, private 30-minute lesson booking, coach availability management, lesson operations, and invoice-only lesson charging.

## Architecture

- Next.js 16 App Router and TypeScript for the web application.
- Tailwind and shared UI components for the portal.
- Supabase Auth and Postgres with RLS for identity, authorization, data, and atomic booking workflows.
- Pages call services in `lib/services/`; services call repositories in `lib/repositories/`. UI components do not query Supabase directly.
- The current lesson workflow is v2 coach availability. The legacy capacity-slot booking RPC is not a supported public workflow.

## Local setup

1. Install dependencies: `npm install`.
2. Start Docker Desktop, then start Supabase: `npx supabase start`.
3. Recreate the local database, migrations, and canonical fixtures: `npx supabase db reset`.
4. Run the app against local Supabase: `npm run dev`. The server announces `http://localhost:3000`.

`npm run dev` is the standard local command. It reads the live local Supabase CLI configuration automatically, so no local credentials need to be copied into an environment file. Use `npm run dev:hosted` only when you intentionally configured a hosted Supabase project in `.env.local`.

`supabase/seed.sql` is the automatic source of local demo fixtures. It is deliberately separate from production migrations.

Run verification with:

`npm test -- --run`
`npm run test:db-workflows`
`npm run lint`
`npm run build`

## Lesson booking

Coaches publish standing availability and optional extra intervals. The booking calendar shows every 30-minute offered occurrence in the booking horizon. A time can be selectable or shown as **Unavailable**. The UI never says whether an unavailable time is blocked, closed, or already booked. Dates with scheduled times but no selectable time are disabled, while remaining visible.

Booking and rescheduling are rechecked atomically in Postgres. Cancellation and rescheduling enforce ownership and start-time rules server-side; lesson charges retain their lifecycle state for the corresponding cancellation or reschedule result.

## Demo personas

Local reset creates these accounts, all using password `Test1234!`:

- `admin@cfa.test` - Alice Admin
- `coach@cfa.test` - Dr. Misha Galukhin
- `fencer@cfa.test` - Fiona Fencer
- `guardian@cfa.test` - George Guardian, payer for Fiona
- `jacques@cfa.test` and `jeremy@cfa.test` - additional coaches

The fixtures include the guardian/dependent household, coach offerings and rules, a blocked interval, club closure, scheduled lessons, participants, and provisional charges.

## Hosted staging demo data

Never run demo seeding against production. The guarded hosted seeder is manual only:

`npm run seed:staging`

It requires these non-secret configuration keys in `.env.local` (start from `.env.sample`):

`NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SECRET_KEY`, and `CFA_STAGING_SEED_CONFIRM=I_UNDERSTAND_THIS_IS_STAGING`.

The script rejects localhost and production-looking project URLs, requires the exact confirmation value, and is idempotent. It provisions the same canonical personas and related CFA demonstration data as the local fixture. Do not put service keys in source control.

## Inspecting hosted data

In the Supabase dashboard, use **Authentication → Users** to inspect demo accounts. Use **Table Editor** for `profiles`, `coach_availability_rules`, `coach_availability_exceptions`, `club_closures`, `bookings`, `booking_participants`, and `charges`.

The application reads these Supabase rows at runtime. “Hard-coded” means a value embedded in UI or code. “Pre-populated” means repeatable records inserted into the database fixture or explicit staging seed.
