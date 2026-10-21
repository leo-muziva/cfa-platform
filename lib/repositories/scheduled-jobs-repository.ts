import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'

export type JobResult = { ok: true; count: number } | { ok: false; error: string }

// Both routines are granted to service_role only, so they run through the
// server-only admin client. Callers must never pass user input here.
async function callCountingRpc(name: 'expire_lesson_holds' | 'run_scheduled_invoices'): Promise<JobResult> {
  const db = createAdminClient()
  if (!db) return { ok: false, error: 'SUPABASE_SECRET_KEY is not configured' }
  const { data, error } = await db.rpc(name)
  if (error) return { ok: false, error: error.message }
  return { ok: true, count: Number(data ?? 0) }
}

export function expireLessonHolds(): Promise<JobResult> {
  return callCountingRpc('expire_lesson_holds')
}

export function runScheduledInvoices(): Promise<JobResult> {
  return callCountingRpc('run_scheduled_invoices')
}
