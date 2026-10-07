import { and, eq, ne } from 'drizzle-orm'
import type { Db } from '../db/client'
import { supports } from '../db/schema'
import { marketplaceSplitFrom } from './khaime'

/**
 * Applies Khaime's verdict on a tip. Shared by the webhook
 * (payment.succeeded / payment.failed) and the reconcile Cron
 * (GET /transactions/:id), which Khaime documents as returning the same
 * payment object, so both paths store exactly the same thing.
 *
 * Rules:
 * - Only Khaime's word moves a tip off `pending`; never optimistic.
 * - A succeeded tip never goes back. Written as a condition on the UPDATE
 *   (D1 has no interactive transactions), so duplicate or late deliveries
 *   can't race each other.
 * - The marketplace split is stored, and mismatches between the top-level
 *   fields and marketplace_settlement are logged.
 */
export async function applyPaymentOutcome(
  db: Db,
  reference: string,
  outcome: 'succeeded' | 'failed',
  metadata: Record<string, any> | undefined
): Promise<void> {
  const split = marketplaceSplitFrom(metadata)
  if (split?.mismatches.length) {
    console.warn('Khaime marketplace split: top-level fields disagree with marketplace_settlement', {
      reference,
      mismatches: split.mismatches,
      split,
    })
  }
  await db.batch([
    db
      .update(supports)
      .set({ status: outcome })
      .where(and(eq(supports.reference, reference), ne(supports.status, 'succeeded'))),
    ...(split
      ? [db.update(supports).set({ khaimeSplit: JSON.stringify(split) }).where(eq(supports.reference, reference))]
      : []),
  ])
}
