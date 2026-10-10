import { env } from 'cloudflare:workers'
import { DateTime } from 'luxon'
import { beforeEach, describe, expect, it } from 'vitest'
import { createDb } from '../src/db/client'
import { supports } from '../src/db/schema'
import { applyProfile } from '../src/services/creator_profile'
import { presentCreator, presentSupporters } from '../src/services/creator_presenter'
import { ensureCreatorFor } from '../src/services/creator_provisioner'

const db = createDb(env.DB)

beforeEach(async () => {
  await env.DB.exec('DELETE FROM supports')
  await env.DB.exec('DELETE FROM creators')
})

describe('ensureCreatorFor', () => {
  it('creates a creator with the design defaults, once per user', async () => {
    const first = await ensureCreatorFor(db, { id: 'u1', name: 'Ada Obi', email: 'ada@example.test' })
    const again = await ensureCreatorFor(db, { id: 'u1', name: 'Ada Obi', email: 'ada@example.test' })

    expect(again.id).toBe(first.id)
    expect(first).toMatchObject({
      handle: 'adaobi',
      displayName: 'Ada Obi',
      currency: 'NGN',
      currencySymbol: '₦',
      monthlyGoal: 100000,
      payoutMode: 'managed',
    })
    expect(first.createdAt).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)
  })

  it('numbers the handle on collision and falls back to the email', async () => {
    const a = await ensureCreatorFor(db, { id: 'u1', name: 'Ada', email: 'a@example.test' })
    const b = await ensureCreatorFor(db, { id: 'u2', name: 'Ada', email: 'b@example.test' })
    const c = await ensureCreatorFor(db, { id: 'u3', name: 'Ada', email: 'c@example.test' })
    const d = await ensureCreatorFor(db, { id: 'u4', name: null, email: 'chi.di@example.test' })
    expect([a.handle, b.handle, c.handle, d.handle]).toEqual(['ada', 'ada1', 'ada2', 'chidi'])
    expect(d.displayName).toBe('chi.di')
  })
})

describe('applyProfile', () => {
  it('validates input', async () => {
    const creator = await ensureCreatorFor(db, { id: 'u1', name: 'Ada', email: 'a@example.test' })
    expect(await applyProfile(db, creator, { displayName: ' ', handle: 'x' })).toMatchObject({ status: 400 })
    expect(await applyProfile(db, creator, { displayName: 'A', handle: '!!' })).toMatchObject({ status: 400 })
    expect(await applyProfile(db, creator, { displayName: 'A', handle: 'a', currency: 'EUR' })).toMatchObject({
      status: 400,
      error: 'Unsupported currency.',
    })
  })

  it('rejects a handle another creator has', async () => {
    await ensureCreatorFor(db, { id: 'u1', name: 'Ada', email: 'a@example.test' })
    const bo = await ensureCreatorFor(db, { id: 'u2', name: 'Bo', email: 'b@example.test' })
    expect(await applyProfile(db, bo, { displayName: 'Bo', handle: 'ADA' })).toMatchObject({ ok: false, status: 409 })
  })

  it('saves the profile, keeping the processor unless payoutMode is managed', async () => {
    const creator = await ensureCreatorFor(db, { id: 'u1', name: 'Ada', email: 'a@example.test' })
    const result = await applyProfile(db, { ...creator, processor: 'stripe' }, {
      displayName: ' Ada O ',
      handle: 'Ada-O',
      bio: '',
      currency: 'usd',
      monthlyGoal: '$2,500',
      brandColor: '#000000',
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.creator).toMatchObject({
      displayName: 'Ada O',
      handle: 'adao',
      bio: null,
      currency: 'USD',
      currencySymbol: '$',
      monthlyGoal: 2500,
      brandColor: '#FF5A36',
    })

    const managed = await applyProfile(db, result.creator, {
      displayName: 'Ada O',
      handle: 'adao',
      payoutMode: 'managed',
      brandColor: '#2A6FDB',
    })
    expect(managed).toMatchObject({ ok: true, creator: { processor: null, payoutMode: 'managed', brandColor: '#2A6FDB' } })
  })
})

describe('presenter', () => {
  const sql = (d: DateTime) => d.toUTC().toFormat('yyyy-MM-dd HH:mm:ss')

  it('aggregates succeeded supports only, with month and week deltas', async () => {
    const creator = await ensureCreatorFor(db, { id: 'u1', name: 'Ada', email: 'a@example.test' })
    const now = DateTime.fromISO('2026-10-20T12:00:00Z', { zone: 'utc' })
    const row = (amount: number, at: DateTime, status: 'succeeded' | 'pending' = 'succeeded', name: string | null = 'Kemi') => ({
      creatorId: creator.id,
      amount,
      status,
      supporterName: name,
      reference: `sml_${amount}_${at.toMillis()}`,
      createdAt: sql(at),
      updatedAt: sql(at),
    })
    await db.insert(supports).values([
      row(5000, now.minus({ days: 2 })),
      row(2000, now.minus({ days: 10 }), 'succeeded', null),
      row(1500, DateTime.fromISO('2026-09-15T09:00:00Z')),
      row(9999, now.minus({ days: 1 }), 'pending'),
    ])

    const view = await presentCreator(db, creator, now)
    expect(view).toMatchObject({
      raised: 8500,
      raisedLabel: '₦8,500',
      raisedShort: '₦9k',
      supporters: 3,
      goalLabel: '₦100,000',
      goalPct: 9,
      remainingLabel: '₦91,500',
      totalDeltaLabel: '↑ ₦6k vs last month',
      totalDeltaUp: true,
      supportersDeltaLabel: '↑ 1 this week',
      isEmpty: false,
      isByo: false,
    })
    expect(view.notes.map((n) => [n.name, n.initial, n.amountLabel])).toEqual([
      ['Kemi', 'K', '₦5,000'],
      ['Anonymous', '?', '₦2,000'],
      ['Kemi', 'K', '₦1,500'],
    ])
    expect(view.notes[0].timeAgo).toBe('2 days ago')

    const all = await presentSupporters(db, creator)
    expect(all).toMatchObject({ count: 3, raisedLabel: '₦8,500' })
  })

  it('reads ISO timestamps as well as SQL ones', async () => {
    const creator = await ensureCreatorFor(db, { id: 'u1', name: 'Ada', email: 'a@example.test' })
    const now = DateTime.fromISO('2026-10-20T12:00:00Z', { zone: 'utc' })
    await db.insert(supports).values({
      creatorId: creator.id,
      amount: 100,
      status: 'succeeded',
      reference: 'sml_iso',
      createdAt: '2026-10-19T12:00:00.000Z',
      updatedAt: '2026-10-19T12:00:00.000Z',
    })
    const view = await presentCreator(db, creator, now)
    expect(view.supportersDeltaLabel).toBe('↑ 1 this week')
  })
})
