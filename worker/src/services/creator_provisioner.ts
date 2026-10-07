import { eq } from 'drizzle-orm'
import type { Db } from '../db/client'
import { type Creator, creators } from '../db/schema'

/** Port of app/services/creator_provisioner.ts. */

interface AuthUser {
  id: string
  name?: string | null
  email: string
}

export function slugify(input: string): string {
  const base = input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
    .slice(0, 24)
  return base || 'creator'
}

export function isUniqueViolation(err: unknown, column: string): boolean {
  const text = String((err as { cause?: unknown })?.cause ?? '') + String((err as Error)?.message ?? err)
  return text.includes('UNIQUE constraint failed') && text.includes(column)
}

/**
 * Ensure a signed-in user has a creator page. Called lazily on the first
 * authenticated request so a freshly registered user lands on a working
 * dashboard. Defaults mirror the design (managed payouts, ₦100k goal).
 *
 * D1 has no interactive transactions, so instead of "find a free handle, then
 * insert" (which races), this inserts and lets the unique index on `handle`
 * reject a taken one, then tries the next number.
 */
export async function ensureCreatorFor(db: Db, user: AuthUser): Promise<Creator> {
  const existing = await db.select().from(creators).where(eq(creators.userId, user.id)).get()
  if (existing) return existing

  const displayName = user.name?.trim() || user.email.split('@')[0]
  const base = slugify(user.name || user.email.split('@')[0])

  for (let n = 0; n < 1000; n++) {
    const handle = n === 0 ? base : `${base}${n}`
    try {
      const [created] = await db
        .insert(creators)
        .values({
          userId: user.id,
          displayName,
          handle,
          bio: null,
          location: null,
          currency: 'NGN',
          currencySymbol: '₦',
          monthlyGoal: 100000,
          brandColor: '#FF5A36',
          payoutMode: 'managed',
          processor: null,
        })
        .returning()
      return created
    } catch (err) {
      if (!isUniqueViolation(err, 'creators.handle')) throw err
    }
  }
  throw new Error(`No free handle for "${base}"`)
}
