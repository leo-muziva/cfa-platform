# Localhost runbook

Use this every time you want the CFA Platform locally:

`npx supabase start`
`npm run dev`

Then open [http://localhost:3000](http://localhost:3000). Keep the terminal running while you use the app.

`npm run dev` is deliberately wired to `scripts/dev-local.mjs`. It asks the local Supabase CLI for the current connection settings at startup, then starts Next.js with those values. This avoids stale or missing local environment configuration.

If it says Local Supabase is not ready, start Docker Desktop and rerun `npx supabase start`. For intentional hosted Supabase work only, use `npm run dev:hosted` with a configured `.env.local`.
