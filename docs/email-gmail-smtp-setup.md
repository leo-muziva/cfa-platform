# Email through Gmail SMTP

Resend without a verified domain only delivers to the account owner. For the
demo, CFA sends email through a Gmail account instead, using an app password.
Gmail delivers to any address, including plus aliases such as
`name+george@gmail.com`, so every demo persona's email can land in one inbox.
The limit is about 500 messages a day.

Two things send email, and both should use the same Gmail account:

| Sender | What it sends | Where it is configured |
|---|---|---|
| Supabase Auth | Signup confirmation, password reset | Supabase dashboard → Authentication → Emails → SMTP settings |
| The app | Membership payment requests, shop order confirmations | Vercel environment variables |

## 1. Create a Gmail app password

1. Turn on 2-Step Verification for the Google account.
2. Open https://myaccount.google.com/apppasswords, create one named `CFA`, and
   copy the 16-character password. Spaces in it do not matter.

## 2. Supabase Auth SMTP

In the hosted project, open Authentication → Emails → SMTP settings, enable
custom SMTP and enter:

| Field | Value |
|---|---|
| Sender email | the Gmail address |
| Sender name | `Cape Fencing Academy` |
| Host | `smtp.gmail.com` |
| Port | `465` |
| Username | the Gmail address |
| Password | the app password |

Then raise the email rate limit under Authentication → Rate Limits, because the
default is low for a demo.

## 3. Vercel environment variables

Set these for Production and Preview, then redeploy:

| Name | Value |
|---|---|
| `SMTP_HOST` | `smtp.gmail.com` |
| `SMTP_PORT` | `465` |
| `SMTP_USER` | the Gmail address |
| `SMTP_PASSWORD` | the app password |
| `EMAIL_FROM` | `Cape Fencing Academy <the Gmail address>` |

When every `SMTP_*` value is set the app sends through SMTP. Otherwise it falls
back to `RESEND_API_KEY` with `EMAIL_FROM`, and with neither it reports "Email
not configured" while approvals still work. See `lib/providers/email-transport.ts`.

## Moving to a real domain later

Verify a domain in Resend, point Supabase SMTP at Resend's SMTP details, set
`EMAIL_FROM` to an address on that domain and remove the `SMTP_*` variables
from Vercel. No code change is needed.
