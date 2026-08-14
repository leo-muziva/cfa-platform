import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(new URL('./0008_auth_confirmation_lifecycle.sql', import.meta.url), 'utf8')
const config = readFileSync(new URL('../config.toml', import.meta.url), 'utf8')
const localDevScript = readFileSync(new URL('../../scripts/dev-local.mjs', import.meta.url), 'utf8')
const confirmationTemplate = readFileSync(new URL('../templates/confirmation.html', import.meta.url), 'utf8')
const inviteTemplate = readFileSync(new URL('../templates/invite.html', import.meta.url), 'utf8')

describe('email confirmation lifecycle', () => {
  it('enables confirmation and keeps the Windows-safe local ports', () => {
    expect(config).toContain('enable_confirmations = true')
    expect(config).toContain('email_sent = 30')
    for (const port of ['15420', '15421', '15422', '15423', '15424', '15427', '15429']) {
      expect(config).toContain(port)
    }
  })

  it('provides the local server secret to server-only admin workflows', () => {
    expect(localDevScript).toContain('localEnvironment.SECRET_KEY || localEnvironment.SERVICE_ROLE_KEY')
    expect(localDevScript).toContain('SUPABASE_SECRET_KEY: secretKey')
  })

  it('does not create a profile before email confirmation', () => {
    expect(migration).toContain('if new.email_confirmed_at is not null then')
    expect(migration).toContain('and u.email_confirmed_at is null')
  })

  it('creates a profile on the null-to-confirmed transition', () => {
    expect(migration).toContain('old.email_confirmed_at is null and new.email_confirmed_at is not null')
    expect(migration).toContain('execute function public.handle_user_email_confirmed()')
  })

  it('carries validated invitation staff metadata into the profile', () => {
    expect(migration).toContain("new.raw_user_meta_data->>'cfa_is_staff'")
    expect(migration).toContain("invited_staff_type in ('admin', 'coach')")
  })

  it('sends confirmation and invitation links through the SSR confirm route', () => {
    expect(confirmationTemplate).toContain('{{ .RedirectTo }}')
    expect(confirmationTemplate).toContain('token_hash={{ .TokenHash }}')
    expect(confirmationTemplate).toContain('type=email')
    expect(inviteTemplate).toContain('/auth/confirm?token_hash={{ .TokenHash }}')
    expect(inviteTemplate).toContain('type=invite')
    expect(inviteTemplate).toContain('next=%2Fauth%2Fupdate-password')
  })
})
