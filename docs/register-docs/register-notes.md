cfa equipment register - project notes

what this is: bringing the club's equipment/inventory register into the main site properly. this isn't part of the fin/pay/book/shop/int ticket plan, it's a separate thing: "equipment inventory & rentals" is one of the five original subsystems in the design and it's never actually been built into the real platform yet.

what already exists (built earlier, separately, before this task - needs adapting, not just copying in):

- a standalone single-file html tool, full crud, seeded with 117 items across 17 equipment types, navy/gold/white styling matching cfa branding. persistence is just browser localstorage though, not a real backend
- a second version also exists, rebuilt as a flask/sqlite multi-file app, also standalone, also not connected to the real platform

what this task actually needs:

- move this into the real next.js/supabase platform properly - an actual db table (or tables) via a migration, not localstorage or sqlite
- match the site's actual look and components instead of the standalone tool's own styling
- probably admin-facing primarily since this is inventory management not a member feature - check how other admin pages/routes are structured and follow that pattern rather than inventing a new one
- figure out what's actually worth keeping from the two existing versions (data model, the 117 seed items, ui layout) vs what needs rethinking now it's part of a real app with real auth/db

stack: next.js 16 (app router), react 19, typescript, supabase, vitest. local dev: npx supabase start then npm run dev:local. run the test suite before and after changes, don't assume things still work just cause they did before.

ground rules: one owner per branch, this branch is just for this. open a draft pr early so it's visible. no real secrets or creds ever committed. keep code comments and any markdown plain and informal, like rough notes, not generated-sounding docs.

not touching: booking, payments, shop - those live on other branches, this is a standalone addition and should stay that way
