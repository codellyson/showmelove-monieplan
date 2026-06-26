import Creator from '#models/creator'

interface AuthUser {
  id: string
  name?: string | null
  email: string
}

function slugify(input: string): string {
  const base = input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
    .slice(0, 24)
  return base || 'creator'
}

async function uniqueHandle(seed: string): Promise<string> {
  const base = slugify(seed)
  let handle = base
  let n = 1
  while (await Creator.findBy('handle', handle)) {
    handle = `${base}${n}`
    n += 1
  }
  return handle
}

/**
 * Ensure a signed-in user has a creator page. Called lazily on the first
 * authenticated request so a freshly registered user lands on a working
 * dashboard. Defaults mirror the design (managed payouts, ₦100k goal).
 */
export async function ensureCreatorFor(user: AuthUser): Promise<Creator> {
  const existing = await Creator.findBy('userId', user.id)
  if (existing) return existing

  const displayName = user.name?.trim() || user.email.split('@')[0]
  const handle = await uniqueHandle(user.name || user.email.split('@')[0])

  return Creator.create({
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
}
