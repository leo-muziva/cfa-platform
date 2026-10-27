// Scheduled jobs triggered by Vercel Cron through app/api/cron/*: releasing
// lapsed lesson holds and running the monthly invoice batch.
import 'server-only'
import { timingSafeEqual } from 'node:crypto'
import { expireLessonHolds, runScheduledInvoices, type JobResult } from '@/lib/repositories/scheduled-jobs-repository'

/** Vercel Cron sends `Authorization: Bearer <CRON_SECRET>`. No secret configured means no access. */
export function isAuthorizedCronRequest(authorization: string | null, secret = process.env.CRON_SECRET): boolean {
  if (!secret || !authorization) return false
  const expected = Buffer.from(`Bearer ${secret}`)
  const actual = Buffer.from(authorization)
  return expected.length === actual.length && timingSafeEqual(expected, actual)
}

/**
 * Frees slots whose pay-now hold has lapsed. Pages call this before reading
 * lessons so a stale hold is released even when the cron job runs rarely
 * (Vercel Hobby allows only daily jobs). Failure must never block the page.
 */
export async function releaseExpiredLessonHolds(): Promise<void> {
  const result = await expireLessonHolds()
  if (!result.ok) console.error('[scheduled-jobs] expire_lesson_holds failed', { error: result.error })
}

/** Cron job: release every pay-now hold that has expired. */
export async function runExpireHoldsJob(): Promise<JobResult> {
  return expireLessonHolds()
}

/** Cron job: generate this month's invoices (Johannesburg time). */
export async function runMonthlyInvoicesJob(): Promise<JobResult> {
  return runScheduledInvoices()
}
