import Creator from '#models/creator'

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

export interface ProfileResult {
  ok: boolean
  status?: number
  error?: string
}

/**
 * Validate and apply profile fields to a creator (shared by the setup wizard
 * and the Settings page). Does NOT save — caller decides; on success the
 * creator is mutated and persisted here.
 */
export async function applyProfile(creator: Creator, input: ProfileInput): Promise<ProfileResult> {
  const displayName = String(input.displayName ?? '').trim()
  const bio = String(input.bio ?? '').trim()
  const currency = String(input.currency ?? 'NGN').toUpperCase()
  const monthlyGoal = Math.max(
    0,
    Number(String(input.monthlyGoal ?? '').replace(/[^0-9]/g, '')) || 0
  )
  const handle = String(input.handle ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
    .slice(0, 24)

  if (!displayName) return { ok: false, status: 400, error: 'Add a display name.' }
  if (!handle) return { ok: false, status: 400, error: 'Pick a link.' }
  if (!(currency in CURRENCIES)) return { ok: false, status: 400, error: 'Unsupported currency.' }

  const taken = await Creator.query().where('handle', handle).whereNot('id', creator.id).first()
  if (taken) {
    return { ok: false, status: 409, error: `“${handle}” is taken — try another link.` }
  }

  creator.displayName = displayName
  creator.handle = handle
  creator.bio = bio || null
  creator.currency = currency
  creator.currencySymbol = CURRENCIES[currency]
  creator.monthlyGoal = monthlyGoal

  // Payout mode is only changed when explicitly provided (setup wizard sends it;
  // the Settings form omits it so it doesn't clobber a connected processor).
  if (input.payoutMode === 'managed' || input.payoutMode === 'byo') {
    creator.payoutMode = input.payoutMode
    if (input.payoutMode === 'managed') creator.processor = null
  }

  // Brand is optional here (the setup wizard doesn't set it).
  if (input.brandColor !== undefined) {
    const brand = String(input.brandColor)
    if (BRAND_PALETTE.includes(brand)) creator.brandColor = brand
  }

  await creator.save()
  return { ok: true }
}
