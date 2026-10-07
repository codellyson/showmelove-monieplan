import { and, eq, ne } from 'drizzle-orm'
import type { Db } from '../db/client'
import { type Creator, creators } from '../db/schema'
import { isUniqueViolation } from './creator_provisioner'

/** Port of app/services/creator_profile.ts. */

export const CURRENCIES: Record<string, string> = { NGN: '₦', USD: '$', GBP: '£' }
export const BRAND_PALETTE = ['#FF5A36', '#F4A93C', '#2A6FDB', '#1F8A5B', '#E84D8A']

export interface ProfileInput {
  displayName?: unknown
  handle?: unknown
  bio?: unknown
  currency?: unknown
  monthlyGoal?: unknown
  payoutMode?: unknown
  brandColor?: unknown
}

export type ProfileResult = { ok: true; creator: Creator } | { ok: false; status: number; error: string }

/**
 * Validate and apply profile fields to a creator (shared by the setup wizard
 * and the Settings page). On success the row is updated and the fresh creator
 * returned; the input object is not mutated (unlike the Lucid version).
 */
export async function applyProfile(db: Db, creator: Creator, input: ProfileInput): Promise<ProfileResult> {
  const displayName = String(input.displayName ?? '').trim()
  const bio = String(input.bio ?? '').trim()
  const currency = String(input.currency ?? 'NGN').toUpperCase()
  const monthlyGoal = Math.max(0, Number(String(input.monthlyGoal ?? '').replace(/[^0-9]/g, '')) || 0)
  const handle = String(input.handle ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
    .slice(0, 24)

  if (!displayName) return { ok: false, status: 400, error: 'Add a display name.' }
  if (!handle) return { ok: false, status: 400, error: 'Pick a link.' }
  if (!(currency in CURRENCIES)) return { ok: false, status: 400, error: 'Unsupported currency.' }

  const taken = () => ({ ok: false as const, status: 409, error: `“${handle}” is taken — try another link.` })

  const clash = await db
    .select({ id: creators.id })
    .from(creators)
    .where(and(eq(creators.handle, handle), ne(creators.id, creator.id)))
    .get()
  if (clash) return taken()

  const changes: Partial<typeof creators.$inferInsert> = {
    displayName,
    handle,
    bio: bio || null,
    currency,
    currencySymbol: CURRENCIES[currency],
    monthlyGoal,
  }

  // Payout mode is only changed when explicitly provided (setup wizard sends it;
  // the Settings form omits it so it doesn't clobber a connected processor).
  if (input.payoutMode === 'managed' || input.payoutMode === 'byo') {
    changes.payoutMode = input.payoutMode
    if (input.payoutMode === 'managed') changes.processor = null
  }

  // Brand is optional here (the setup wizard doesn't set it).
  if (input.brandColor !== undefined) {
    const brand = String(input.brandColor)
    if (BRAND_PALETTE.includes(brand)) changes.brandColor = brand
  }

  try {
    const [updated] = await db.update(creators).set(changes).where(eq(creators.id, creator.id)).returning()
    return { ok: true, creator: updated }
  } catch (err) {
    // Lost a race for the handle between the check above and the update.
    if (isUniqueViolation(err, 'creators.handle')) return taken()
    throw err
  }
}
