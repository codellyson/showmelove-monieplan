import { and, desc, eq, isNotNull, sql } from 'drizzle-orm'
import type { Db } from '../db/client'
import { supports } from '../db/schema'
import type { Khaime } from '../services/khaime'
import { applyPaymentOutcome } from '../services/payment_outcome'

/**
 * Reconcile Cron: catches tips whose payment.succeeded / payment.failed
 * webhook never arrived (delayed delivery, endpoint down, lost during
 * cutover). For each tip still `pending`, asks Khaime for the transaction with
 * GET /transactions/:id and applies the result exactly as the webhook would.
 *
 * Which tips: pending, with a Khaime transaction id (tips created before
 * migration 0002 have none and are skipped), older than GRACE so the webhook
 * gets the first chance, and newer than LOOKBACK so abandoned checkouts stop
 * being re-checked. Newest first, at most BATCH per run, one request at a time.
 *
 * Outcomes:
 * - `succeeded` / `failed` → applyPaymentOutcome (succeeded never reverts).
 * - `refunded` / `disputed` → left pending and logged. The money moved and then
 *   came back or is contested; there's no tip state for that, so a person
 *   should look rather than the job counting it as raised.
 * - lookup errors (404 while the checkout is unfinished, a suspended
 *   sub-merchant, Khaime down) → left pending; the next run tries again.
 */

export const GRACE_MINUTES = 10
export const LOOKBACK_DAYS = 3
export const BATCH = 50

export interface ReconcileSummary {
  checked: number
  succeeded: number
  failed: number
  /** refunded / disputed: needs a person. */
  flagged: number
  /** Lookup failed or status unknown; retried next run. */
  unresolved: number
}

export async function reconcilePending(db: Db, khaime: Khaime): Promise<ReconcileSummary> {
  const summary: ReconcileSummary = { checked: 0, succeeded: 0, failed: 0, flagged: 0, unresolved: 0 }
  if (!khaime.isConfigured()) return summary

  // created_at is SQLite text in UTC ('YYYY-MM-DD HH:MM:SS'), so datetime() compares directly.
  const candidates = await db
    .select({ reference: supports.reference, transactionId: supports.khaimeTransactionId })
    .from(supports)
    .where(
      and(
        eq(supports.status, 'pending'),
        isNotNull(supports.khaimeTransactionId),
        sql`${supports.createdAt} <= datetime('now', ${`-${GRACE_MINUTES} minutes`})`,
        sql`${supports.createdAt} >= datetime('now', ${`-${LOOKBACK_DAYS} days`})`
      )
    )
    .orderBy(desc(supports.createdAt))
    .limit(BATCH)

  for (const { reference, transactionId } of candidates) {
    summary.checked++
    let payment
    try {
      payment = await khaime.getTransaction(transactionId as string)
    } catch (error) {
      summary.unresolved++
      console.log('Reconcile: transaction lookup failed; will retry', { reference, transactionId, error: String(error) })
      continue
    }

    // Guard against a transaction that isn't this tip's.
    const theirs = payment.metadata?.partner_reference ?? payment.partner_reference
    if (theirs && theirs !== reference) {
      summary.unresolved++
      console.warn('Reconcile: transaction belongs to another reference; skipped', { reference, transactionId, theirs })
      continue
    }

    if (payment.status === 'succeeded' || payment.status === 'failed') {
      await applyPaymentOutcome(db, reference, payment.status, payment.metadata)
      summary[payment.status]++
      console.log('Reconcile: applied missed webhook outcome', { reference, transactionId, status: payment.status })
    } else if (payment.status === 'refunded' || payment.status === 'disputed') {
      summary.flagged++
      console.warn('Reconcile: pending tip was refunded or disputed; needs review', {
        reference,
        transactionId,
        status: payment.status,
      })
    } else {
      summary.unresolved++
      console.log('Reconcile: no final status yet', { reference, transactionId, status: payment.status })
    }
  }

  if (summary.checked) console.log('Reconcile: run finished', summary)
  return summary
}
