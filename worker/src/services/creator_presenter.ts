import { and, desc, eq } from 'drizzle-orm'
import { DateTime } from 'luxon'
import type { Db } from '../db/client'
import { type Creator, type Support, supports } from '../db/schema'

/** Port of app/services/creator_presenter.ts. */

const NOTE_COLORS = ['var(--brand)', '#F4A93C', '#1C1714', '#F4A93C']

export interface PresentedNote {
  name: string
  initial: string
  anonymous: boolean
  message: string | null
  amountLabel: string
  timeAgo: string
  color: string
}

export interface CreatorView {
  creator: Creator
  sym: string
  raised: number
  raisedLabel: string
  raisedShort: string
  supporters: number
  goalLabel: string
  goalShort: string
  goalPct: number
  remainingLabel: string
  totalDeltaLabel: string
  totalDeltaUp: boolean
  supportersDeltaLabel: string
  supportersDeltaUp: boolean
  notes: PresentedNote[]
  isEmpty: boolean
  isByo: boolean
}

export interface SupportersView {
  sym: string
  count: number
  raisedLabel: string
  notes: PresentedNote[]
}

/**
 * Timestamps are stored as SQLite text in UTC: `YYYY-MM-DD HH:MM:SS` from Lucid
 * and CURRENT_TIMESTAMP. Accept ISO too, in case a row was written that way.
 */
export function parseTimestamp(value: string): DateTime {
  const sql = DateTime.fromSQL(value, { zone: 'utc' })
  return sql.isValid ? sql : DateTime.fromISO(value, { zone: 'utc' })
}

function money(sym: string, amount: number): string {
  return sym + amount.toLocaleString('en-US')
}

function short(sym: string, amount: number): string {
  if (amount >= 1000) {
    const k = Math.round(amount / 1000)
    return `${sym}${k}k`
  }
  return money(sym, amount)
}

function toNote(s: Support, i: number, sym: string, now: DateTime): PresentedNote {
  const anonymous = !s.supporterName
  const name = s.supporterName ?? 'Anonymous'
  return {
    name,
    initial: anonymous ? '?' : name.charAt(0).toUpperCase(),
    anonymous,
    message: s.message,
    amountLabel: money(sym, s.amount),
    timeAgo: parseTimestamp(s.createdAt).toRelative({ base: now }) ?? '',
    color: NOTE_COLORS[i % NOTE_COLORS.length],
  }
}

function succeededFor(db: Db, creatorId: number) {
  return db
    .select()
    .from(supports)
    .where(and(eq(supports.creatorId, creatorId), eq(supports.status, 'succeeded')))
    .orderBy(desc(supports.createdAt))
}

/**
 * Compute the display model for a creator from their succeeded supports.
 * Aggregates (raised, supporters, goal progress) drive both the dashboard and
 * the public page — the single source of truth is the supports table.
 */
export async function presentCreator(db: Db, creator: Creator, now: DateTime = DateTime.utc()): Promise<CreatorView> {
  const succeeded = await succeededFor(db, creator.id)

  const raised = succeeded.reduce((sum, s) => sum + s.amount, 0)
  const supporters = succeeded.length
  const sym = creator.currencySymbol
  const goal = creator.monthlyGoal
  const goalPct = goal > 0 ? Math.min(100, Math.round((raised / goal) * 100)) : 0
  const remaining = Math.max(0, goal - raised)

  // Real deltas: month-over-month raised, and new supporters in the last 7 days.
  const startOfMonth = now.startOf('month')
  const startOfLastMonth = startOfMonth.minus({ months: 1 })
  const weekAgo = now.minus({ days: 7 })

  let thisMonth = 0
  let lastMonth = 0
  let newThisWeek = 0
  for (const s of succeeded) {
    const at = parseTimestamp(s.createdAt)
    if (at >= startOfMonth) thisMonth += s.amount
    else if (at >= startOfLastMonth) lastMonth += s.amount
    if (at >= weekAgo) newThisWeek += 1
  }

  const monthDelta = thisMonth - lastMonth
  const totalDeltaUp = monthDelta >= 0
  const totalDeltaLabel =
    monthDelta === 0
      ? 'No change vs last month'
      : `${monthDelta > 0 ? '↑' : '↓'} ${short(sym, Math.abs(monthDelta))} vs last month`

  const supportersDeltaUp = newThisWeek > 0
  const supportersDeltaLabel = supportersDeltaUp ? `↑ ${newThisWeek} this week` : 'No new supporters this week'

  const notes = succeeded.slice(0, 4).map((s, i) => toNote(s, i, sym, now))

  return {
    creator,
    sym,
    raised,
    raisedLabel: money(sym, raised),
    raisedShort: short(sym, raised),
    supporters,
    goalLabel: money(sym, goal),
    goalShort: short(sym, goal),
    goalPct,
    remainingLabel: money(sym, remaining),
    totalDeltaLabel,
    totalDeltaUp,
    supportersDeltaLabel,
    supportersDeltaUp,
    notes,
    isEmpty: supporters === 0,
    isByo: creator.payoutMode === 'byo',
  }
}

/** Every succeeded support for a creator, newest first (the Supporters page). */
export async function presentSupporters(db: Db, creator: Creator, now: DateTime = DateTime.utc()): Promise<SupportersView> {
  const succeeded = await succeededFor(db, creator.id)
  const sym = creator.currencySymbol
  const raised = succeeded.reduce((sum, s) => sum + s.amount, 0)
  return {
    sym,
    count: succeeded.length,
    raisedLabel: money(sym, raised),
    notes: succeeded.map((s, i) => toNote(s, i, sym, now)),
  }
}
