import { createExecutionContext, createScheduledController, waitOnExecutionContext } from 'cloudflare:test'
import { env } from 'cloudflare:workers'
import { eq } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createDb } from '../src/db/client'
import { creators, supports } from '../src/db/schema'
import worker from '../src/index'
import { BATCH, reconcilePending } from '../src/jobs/reconcile_pending'
import { createKhaime } from '../src/services/khaime'

const db = createDb(env.DB)
let creatorId: number
/** Khaime's answer per transaction id; anything missing is a 404. */
let transactions: Record<string, unknown>
let warned: ReturnType<typeof vi.spyOn>

/** UTC 'YYYY-MM-DD HH:MM:SS', the format CURRENT_TIMESTAMP writes. */
function ago(minutes: number): string {
  return new Date(Date.now() - minutes * 60_000).toISOString().slice(0, 19).replace('T', ' ')
}

async function tip(reference: string, minutesAgo: number, extra: Partial<typeof supports.$inferInsert> = {}) {
  await db.insert(supports).values({
    creatorId,
    amount: 5000,
    reference,
    status: 'pending',
    khaimeTransactionId: `tx_${reference}`,
    createdAt: ago(minutesAgo),
    updatedAt: ago(minutesAgo),
    ...extra,
  })
}

async function statusOf(reference: string) {
  return (await db.select().from(supports).where(eq(supports.reference, reference)).get())?.status
}

beforeEach(async () => {
  await env.DB.exec('DELETE FROM supports')
  await env.DB.exec('DELETE FROM creators')
  const [creator] = await db.insert(creators).values({ displayName: 'Ada', handle: 'ada', khaimeMerchantId: '900' }).returning()
  creatorId = creator.id
  transactions = {}
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const id = decodeURIComponent(String(input).split('/transactions/')[1] ?? '')
    const payment = transactions[id]
    if (!payment) return Response.json({ success: false, message: 'ORDER_NOT_FOUND' }, { status: 404 })
    return Response.json({ success: true, data: payment })
  })
  vi.spyOn(console, 'log').mockImplementation(() => {})
  warned = vi.spyOn(console, 'warn').mockImplementation(() => {})
})

afterEach(() => vi.restoreAllMocks())

const payment = (reference: string, status: string, metadata: Record<string, unknown> = {}) => ({
  object: 'payment',
  id: `tx_${reference}`,
  status,
  metadata: { partner_reference: reference, ...metadata },
})

const run = () => reconcilePending(db, createKhaime(env))

describe('reconcilePending', () => {
  it('applies succeeded and failed outcomes the webhook missed', async () => {
    await tip('sml_paid', 30)
    await tip('sml_declined', 30)
    transactions = {
      tx_sml_paid: payment('sml_paid', 'succeeded', {
        marketplace_commission_amount: 250,
        marketplace_settlement: { marketplace_commission_amount: 250 },
      }),
      tx_sml_declined: payment('sml_declined', 'failed'),
    }

    expect(await run()).toEqual({ checked: 2, succeeded: 1, failed: 1, flagged: 0, unresolved: 0 })
    expect(await statusOf('sml_paid')).toBe('succeeded')
    expect(await statusOf('sml_declined')).toBe('failed')
    const paid = await db.select().from(supports).where(eq(supports.reference, 'sml_paid')).get()
    expect(JSON.parse(paid!.khaimeSplit!).reported).toEqual({ marketplace_commission_amount: '250' })
    expect(String(vi.mocked(fetch).mock.calls[0][0])).toMatch(/^https:\/\/khaime\.test\/api\/v1\/transactions\/tx_sml_/)
  })

  it('leaves refunded, disputed, unknown and not-found transactions pending', async () => {
    for (const ref of ['sml_r', 'sml_d', 'sml_x', 'sml_404']) await tip(ref, 30)
    transactions = {
      tx_sml_r: payment('sml_r', 'refunded'),
      tx_sml_d: payment('sml_d', 'disputed'),
      tx_sml_x: payment('sml_x', 'processing'),
    }

    expect(await run()).toEqual({ checked: 4, succeeded: 0, failed: 0, flagged: 2, unresolved: 2 })
    for (const ref of ['sml_r', 'sml_d', 'sml_x', 'sml_404']) expect(await statusOf(ref)).toBe('pending')
    expect(warned).toHaveBeenCalledWith(
      'Reconcile: pending tip was refunded or disputed; needs review',
      expect.objectContaining({ reference: 'sml_r', status: 'refunded' })
    )
  })

  it('skips a transaction that reports a different reference', async () => {
    await tip('sml_mine', 30)
    transactions = { tx_sml_mine: payment('sml_someone_else', 'succeeded') }
    expect((await run()).unresolved).toBe(1)
    expect(await statusOf('sml_mine')).toBe('pending')
  })

  it('only looks at pending tips with a transaction id, past the grace period, inside the lookback', async () => {
    await tip('sml_fresh', 2) // webhook still has time
    await tip('sml_old', 5 * 24 * 60) // older than the lookback
    await tip('sml_legacy', 30, { khaimeTransactionId: null }) // created before migration 0002
    await tip('sml_done', 30, { status: 'succeeded' })
    await tip('sml_due', 30)
    transactions = { tx_sml_due: payment('sml_due', 'succeeded') }

    expect(await run()).toMatchObject({ checked: 1, succeeded: 1 })
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1)
  })

  it('never un-pays a tip the webhook confirmed while the job ran', async () => {
    await tip('sml_race', 30)
    transactions = { tx_sml_race: payment('sml_race', 'failed') }
    vi.mocked(fetch).mockImplementationOnce(async () => {
      // The webhook lands between the job's lookup and its write.
      await db.update(supports).set({ status: 'succeeded' }).where(eq(supports.reference, 'sml_race'))
      return Response.json({ success: true, data: transactions.tx_sml_race })
    })
    await run()
    expect(await statusOf('sml_race')).toBe('succeeded')
  })

  it('caps each run and checks the newest first', async () => {
    for (let i = 0; i < BATCH + 5; i++) await tip(`sml_${String(i).padStart(3, '0')}`, 20 + i)
    expect((await run()).checked).toBe(BATCH)
    const looked = vi.mocked(fetch).mock.calls.map((c) => String(c[0]).split('/transactions/')[1])
    expect(looked[0]).toBe('tx_sml_000')
    expect(looked).not.toContain(`tx_sml_${String(BATCH + 4).padStart(3, '0')}`)
  })

  it('does nothing when Khaime is not configured', async () => {
    await tip('sml_due', 30)
    expect(await reconcilePending(db, createKhaime({ ...env, KHAIME_API_KEY: '' }))).toMatchObject({ checked: 0 })
    expect(fetch).not.toHaveBeenCalled()
  })
})

it('runs from the Cron Trigger', async () => {
  await tip('sml_cron', 30)
  transactions = { tx_sml_cron: payment('sml_cron', 'succeeded') }
  const ctx = createExecutionContext()
  await worker.scheduled(createScheduledController({ cron: '*/10 * * * *', scheduledTime: Date.now() }), env, ctx)
  await waitOnExecutionContext(ctx)
  expect(await statusOf('sml_cron')).toBe('succeeded')
})

it('stores the transaction id when a tip is created', async () => {
  // Covered end to end in routes.test.ts; here just the column round-trip.
  await tip('sml_col', 1)
  const row = await db.select().from(supports).where(eq(supports.reference, 'sml_col')).get()
  expect(row?.khaimeTransactionId).toBe('tx_sml_col')
})
