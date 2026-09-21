# Deployment ownership checklist

This checklist separates the limited account and launch decisions owned by CFA
from technical delivery work owned by the implementation team. Record links to
the relevant dashboard, pull request, test report, or setup confirmation as
each item is completed. Do not place credentials, tokens, API keys, private
URLs, or personal contact details in this document or in Git.

For click-by-click account creation and key retrieval, use
[provider account and key setup](provider-account-and-key-setup.md).

## CFA actions that require account ownership

| Status | Owner task | Evidence / setup link |
| --- | --- | --- |
| [ ] | Create the Vercel staging team/project and the Supabase staging project, then grant the required team access. | [Vercel dashboard](https://vercel.com/dashboard) / [Supabase dashboard](https://supabase.com/dashboard) |
| [ ] | Connect GitHub to Vercel and share the generated preview URL with the implementation team through an approved private channel. | [Vercel Git integration](https://vercel.com/docs/git) |
| [ ] | Set the staging environment variables in Vercel using values from the hosted Supabase project. Do not commit them to Git or share them in chat. | [Vercel environment variables](https://vercel.com/docs/environment-variables) |
| [ ] | Create personal Peach sandbox, Meta developer/WhatsApp test-number, and Resend accounts. Store credentials only in the relevant provider dashboard or Vercel. | [Peach Payments](https://www.peachpayments.com/) / [Meta for Developers](https://developers.facebook.com/) / [Resend](https://resend.com/) |
| [ ] | Add the approved tester email addresses and WhatsApp test recipients in the applicable provider dashboards. | Provider dashboard record |
| [ ] | Confirm when CFA has obtained a custom domain and can supply the DNS records needed by Vercel and Resend. | [Vercel domains](https://vercel.com/docs/domains) / [Resend domains](https://resend.com/docs/dashboard/domains/introduction) |
| [ ] | Approve paid production hosting, payment, and messaging plans before any public launch. | Written approval / provider plan record |

## Implementation work

| Status | Delivery task | Evidence / setup link |
| --- | --- | --- |
| [ ] | Restore the currently missing build dependencies and actions, then make CI green. | CI run and pull request link |
| [ ] | Configure staging deployment compatibility, Supabase redirect URLs, migration validation, and synthetic seed data. | Deployment record, Supabase configuration, and migration test report |
| [ ] | Implement feature-flagged Peach sandbox checkout with server-side credentials, webhook verification, and auditable payment-ledger updates. | Pull request and sandbox test evidence |
| [ ] | Add a disabled-by-default Meta test adapter plus a Resend/Supabase Auth SMTP integration path. | Pull request and provider test evidence |
| [ ] | Run deployment, authorization, payment-sandbox, and notification tests. Report current evidence and blockers before any public-launch decision. | Dated QA report in `docs/qa/` |

## Completion criteria and production gate

- Every completed owner task includes a link to its dashboard, setup evidence, or test record in the tables above.
- No secret appears in Git, documentation, browser-delivered code, or chat.
- Production remains blocked until CFA has supplied the domain/DNS information, approved commercial hosting, payment, and messaging plans, and obtained the required provider approvals.
- A public launch decision requires documented evidence for deployment, authorization, payment-sandbox, and notification testing, with outstanding blockers explicitly recorded.
