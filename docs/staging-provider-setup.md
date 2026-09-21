# Staging provider setup

The repository contains sandbox-only payment code and disabled notification
paths. The provider accounts, DNS, credentials, and commercial approvals must
be supplied outside Git. Do not copy any actual value into this document.

## Vercel staging configuration

Set these variables for the Preview environment after the hosted Supabase
staging project exists:

| Variable | Source | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project settings | Public project URL. |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase project settings | Public browser key, never a service-role key. |
| `SUPABASE_SECRET_KEY` | Supabase project settings | Server-only. Required for the webhook and staging seed script. |
| `CFA_PEACH_SANDBOX_ENABLED` | CFA launch decision | Set to `true` only for the Peach sandbox preview. |
| `PEACH_ENTITY_ID` | Peach sandbox dashboard | Server-only. |
| `PEACH_SECRET_TOKEN` | Peach sandbox dashboard | Server-only. |
| `PEACH_WEBHOOK_SECRET` | Peach webhook security settings | Server-only. Enable signing before setting this value. |
| `CFA_STAGING_SEED_PASSWORD` | Generate privately | Used only when manually running `npm run seed:staging`; never use a production password. |
| `CFA_STAGING_SEED_CONFIRM` | Manual operator confirmation | Required exact staging-only confirmation by the seed script. |

Add the staging preview URL and the production URL, once issued, to Supabase
Auth redirect URLs. The Peach sandbox webhook URL is
`https://<staging-host>/api/payments/peach/webhook`; configure it in the Peach
dashboard only after the preview host is stable. The sandbox hosted checkout
also requires that host to be allowlisted in Peach.

## Supabase Auth SMTP with Resend

In the hosted Supabase project's Auth SMTP settings, enable custom SMTP and
enter Resend's SMTP host, port, username, password, sender address, and sender
name directly in the dashboard. Verify the sending domain in Resend first.
Keep the local `supabase/config.toml` SMTP block commented: it is a local
development template, not a safe place for hosted credentials.

## WhatsApp test adapter

The database outbox is prepared for an email or WhatsApp reminder, and a Meta
test adapter is present but disabled by default. Before enabling it, CFA must
create the Meta app, configure its test number, add each approved recipient,
and provide credentials through Vercel only. Set
`CFA_META_WHATSAPP_TEST_ENABLED` to `true` only for the test environment,
together with the server-only test access token and phone-number ID. The
adapter has no fallback recipient and must not send to unapproved recipients.

## Production gate

Do not promote this setup to production until CFA has approved paid provider
plans, supplied the custom domain and DNS records, configured provider
allowlists/webhooks, and reviewed current sandbox test evidence.
