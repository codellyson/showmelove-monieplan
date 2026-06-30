import { DateTime } from 'luxon'
import Creator from '#models/creator'
import Support from '#models/support'

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

function toNote(s: Support, i: number, sym: string): PresentedNote {
  const anonymous = !s.supporterName
  const name = s.supporterName ?? 'Anonymous'
  return {
    name,
    initial: anonymous ? '?' : name.charAt(0).toUpperCase(),
    anonymous,
    message: s.message,
    amountLabel: money(sym, s.amount),
    timeAgo: s.createdAt.toRelative() ?? '',
    color: NOTE_COLORS[i % NOTE_COLORS.length],
  }
}

/**
 * Compute the display model for a creator from their succeeded supports.
 * Aggregates (raised, supporters, goal progress) drive both the dashboard and
 * the public page — the single source of truth is the supports table.
 */
export async function presentCreator(creator: Creator): Promise<CreatorView> {
  const succeeded = await Support.query()
    .where('creator_id', creator.id)
    .andWhere('status', 'succeeded')
    .orderBy('created_at', 'desc')

  const raised = succeeded.reduce((sum, s) => sum + s.amount, 0)
  const supporters = succeeded.length
  const sym = creator.currencySymbol
  const goal = creator.monthlyGoal
  const goalPct = goal > 0 ? Math.min(100, Math.round((raised / goal) * 100)) : 0
  const remaining = Math.max(0, goal - raised)

  // Real deltas: month-over-month raised, and new supporters in the last 7 days.
  const now = DateTime.now()
  const startOfMonth = now.startOf('month')
  const startOfLastMonth = startOfMonth.minus({ months: 1 })
  const weekAgo = now.minus({ days: 7 })

  let thisMonth = 0
  let lastMonth = 0
  let newThisWeek = 0
  for (const s of succeeded) {
    const at = s.createdAt
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
  const supportersDeltaLabel = supportersDeltaUp
    ? `↑ ${newThisWeek} this week`
    : 'No new supporters this week'

  const notes: PresentedNote[] = succeeded.slice(0, 4).map((s, i) => toNote(s, i, sym))

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

export interface SupportersView {
  sym: string
  count: number
  raisedLabel: string
  notes: PresentedNote[]
}

/** Every succeeded support for a creator, newest first (the Supporters page). */
export async function presentSupporters(creator: Creator): Promise<SupportersView> {
  const succeeded = await Support.query()
    .where('creator_id', creator.id)
    .andWhere('status', 'succeeded')
    .orderBy('created_at', 'desc')
  const sym = creator.currencySymbol
  const raised = succeeded.reduce((sum, s) => sum + s.amount, 0)
  return {
    sym,
    count: succeeded.length,
    raisedLabel: money(sym, raised),
    notes: succeeded.map((s, i) => toNote(s, i, sym)),
  }
}
