# Provider account and key setup

Use this guide to create the accounts and retrieve the values needed for the
staging deployment. Do every step in the provider dashboard. Never paste an
actual key into Git, a document, an issue, or chat. Enter secrets directly into
Vercel or the relevant provider's own settings.

This guide is for staging. Do not create or enable production credentials until
the domain, provider approvals, commercial plans, and sandbox evidence have
been approved.

## 1. GitHub and Vercel

1. Sign in to [Vercel](https://vercel.com/) with the CFA-owned GitHub account,
   or create a CFA-owned Vercel team and invite the people who need deployment
   access.
2. In Vercel, select **Add New** then **Project**.
3. Connect GitHub when prompted, authorize access to the CFA repository, select
   this repository, and leave the root directory as the repository root.
4. Confirm Vercel detects **Next.js**, then deploy. This creates a preview URL.
   Keep Deployment Protection on while staging.
5. In the Vercel project, open **Settings -> Environment Variables**. Add the
   values listed in the table below to **Preview** only. Select **Sensitive**
   for every value marked secret. Redeploy after changing environment variables.

Vercel needs no application API key for this project. The GitHub connection is
an OAuth authorization managed by Vercel. See Vercel's
[Git deployment guide](https://vercel.com/docs/git) and
[environment-variable guide](https://vercel.com/docs/environment-variables/managing-environment-variables).

## 2. Supabase staging project

1. Sign in at [Supabase](https://supabase.com/dashboard) with a CFA-owned
   account or organization.
2. Select **New project**. Give it a clearly staging-only name and select a
   region appropriate for CFA. Store the database password in CFA's password
   manager - it is not an application environment variable and must not be
   shared with this repository.
3. Once provisioned, open **Connect**. Copy the project URL and publishable
   key. Then open **Settings -> API Keys** and copy a **secret key**. If the
   project does not yet have the new key types, create them on that page.
4. In **Authentication -> URL Configuration**, set **Site URL** to the stable
   staging Vercel URL. Add that URL and the production URL, once known, to
   **Redirect URLs**. Add the Vercel preview wildcard only if you understand
   that it permits matching preview hosts.
5. Invite required staff through Supabase or your CFA organization. Use the
   least access that lets each person do their job.

Use the current publishable and secret keys, not legacy values that begin with
`eyJ`. Supabase explains the distinction in its
[API-key documentation](https://supabase.com/docs/guides/getting-started/api-keys).
The secret key bypasses Row Level Security and must never use a `NEXT_PUBLIC_`
prefix. Redirect URL behavior is documented by
[Supabase Auth](https://supabase.com/docs/guides/auth/redirect-urls).

## 3. Peach Payments sandbox

1. Create or sign in to the CFA-owned sandbox account at the
   [Peach sandbox dashboard](https://sandbox-dashboard.peachpayments.com/).
2. Enable the sandbox Hosted Checkout product. The current code uses the
   classic signed Hosted Checkout form flow, so retrieve the **Entity ID** and
   **Secret Token** for that flow. If the dashboard only displays V2 client ID,
   client secret, and merchant ID, stop and ask Peach support to enable or
   provide the matching classic Hosted Checkout credentials - do not put V2
   values into the V1 variable names below.
3. In **Checkout**, add the stable staging Vercel host to **Allowlisted
   domains**. Sandbox domains do not need production verification.
4. Configure the webhook URL as
   `https://your-staging-host/api/payments/peach/webhook`.
5. Under webhook security, enable signing and copy the generated shared webhook
   secret once. Store it immediately in Vercel as described below.
6. Keep the account in sandbox mode. Use Peach's sandbox test flow to make a
   successful and an unsuccessful payment only after the staging deployment is
   live.

Peach requires the server to sign the hosted-checkout fields with an HMAC using
the secret token, and requires a unique nonce. It also signs webhook requests;
the application verifies the raw request body. Read Peach's
[checkout authentication guide](https://developer.peachpayments.com/docs/checkout-authentication)
and [webhook guide](https://developer.peachpayments.com/docs/checkout-webhooks)
before enabling the flag.

## 4. Resend and Supabase Auth email

1. Create a CFA-owned [Resend](https://resend.com/) account.
2. In Resend, open **Domains**, add the CFA domain or an authentication
   subdomain such as `auth.example.com`, and publish the DNS records Resend
   gives you. Wait for the domain to verify.
3. In Resend's SMTP credentials area, create an SMTP credential. Copy its SMTP
   host, port, username, and password directly into the hosted Supabase
   project - do not add these to Git or Vercel for this application path.
4. In Supabase, open **Authentication -> Settings -> SMTP** (the label may
   appear as **Custom SMTP**), enable it, and enter the Resend SMTP details and
   a verified From address, for example `no-reply@auth.example.com`.
5. Send a signup confirmation and a password-reset email to an approved test
   mailbox. Check that the links return to the staging Vercel host.

Supabase Auth needs a custom SMTP provider for normal external email delivery;
its default SMTP is intentionally restricted. See
[Supabase custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp).

### Membership payment emails

When an admin approves a membership application, the app emails the payer a
link to the portal so they can pay. Membership only becomes active once that
payment is confirmed. These emails go through the Resend API, not SMTP:

1. In the same Resend account, open **API Keys** and create a key with
   **Sending access** only, restricted to the verified domain.
2. Set `RESEND_API_KEY` to that key and `EMAIL_FROM` to a verified sender, for
   example `Cape Fencing Academy <no-reply@auth.example.com>`, in Vercel
   (server-side only, never `NEXT_PUBLIC_`) and in your local `.env.local`.
3. Make sure `NEXT_PUBLIC_SITE_URL` is the public site address. The email
   link points to `/protected/membership`, or to `/protected/billing` when a
   guardian pays for a dependent.

Without these settings approval still works. The admin page then shows
"Email not configured", and staff let the payer know another way.

## 5. Meta WhatsApp test account

1. Create a CFA-owned account at [Meta for Developers](https://developers.facebook.com/).
2. Create an app and add the **WhatsApp** product. Follow the Cloud API
   quick-start setup to obtain the test phone number and temporary test access
   token.
3. In the WhatsApp API Setup screen, add every approved tester number. Meta
   requires each test recipient to be added and verified before the test number
   can message it.
4. Copy the **Phone number ID** and a suitable test access token. Treat the
   token as a password. When the test adapter is ready to be exercised, enter
   them in Vercel only and leave its feature flag disabled until then.
5. Do not request live business verification or production messaging approval
   until CFA explicitly approves production launch.

The adapter is disabled by default, so creating this account does not send any
messages. Refer to Meta's [WhatsApp Cloud API documentation](https://developers.facebook.com/docs/whatsapp/cloud-api/).

## 6. Values to enter in Vercel

Add these under **Project -> Settings -> Environment Variables**. Choose the
**Preview** environment for staging. Only the two public Supabase variables may
be non-sensitive; every other value is secret. Never make a secret name begin
with `NEXT_PUBLIC_`.

| Variable name | Copy from | Secret? | When to set it |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase Connect dialog | No | Before first staging deploy |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase Connect dialog | No | Before first staging deploy |
| `SUPABASE_SECRET_KEY` | Supabase Settings -> API Keys | Yes | Before webhook testing |
| `CFA_PEACH_SANDBOX_ENABLED` | Type `true` yourself | No | Only after all three Peach keys exist |
| `PEACH_ENTITY_ID` | Peach Hosted Checkout sandbox credentials | Yes | Before checkout testing |
| `PEACH_SECRET_TOKEN` | Peach Hosted Checkout sandbox credentials | Yes | Before checkout testing |
| `PEACH_WEBHOOK_SECRET` | Peach webhook-security setup | Yes | Before checkout testing |
| `CFA_META_WHATSAPP_TEST_ENABLED` | Leave unset or `false` initially | No | Set `true` only for approved test sends |
| `META_WHATSAPP_TEST_ACCESS_TOKEN` | Meta WhatsApp API Setup | Yes | Only when testing the adapter |
| `META_WHATSAPP_TEST_PHONE_NUMBER_ID` | Meta WhatsApp API Setup | Yes | Only when testing the adapter |
| `CFA_STAGING_SEED_PASSWORD` | Generate a unique staging-only password in CFA's password manager | Yes | Only before manually running the staging seed command |
| `CFA_STAGING_SEED_CONFIRM` | Type the required confirmation phrase from the seed command | Yes | Only before manually running the staging seed command |

## Final safety check

Before clicking deploy, confirm that no value was pasted into `.env`,
`.env.local`, a source file, a Markdown file, a pull request, GitHub Actions
logs, or chat. Vercel environment values apply only to new deployments, so
redeploy after adding or changing them. Rotate a key immediately if it is ever
exposed.
