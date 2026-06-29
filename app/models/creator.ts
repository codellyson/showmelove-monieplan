import { DateTime } from 'luxon'
import { BaseModel, column, hasMany } from '@adonisjs/lucid/orm'
import type { HasMany } from '@adonisjs/lucid/types/relations'
import Support from '#models/support'

export type PayoutMode = 'managed' | 'byo'
export type Processor = 'paystack' | 'stripe' | null
/** Payout-setup lifecycle. null = nothing set up yet. */
export type PayoutStatus = 'pending' | 'action_needed' | 'ready' | null
export type PayoutProvider = 'bank' | 'stripe' | null

export default class Creator extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  /** Better Auth user id that owns this creator (null for the seeded demo). */
  @column()
  declare userId: string | null

  @column()
  declare displayName: string

  @column()
  declare handle: string

  @column()
  declare bio: string | null

  @column()
  declare location: string | null

  @column()
  declare currency: string

  @column()
  declare currencySymbol: string

  /** Monthly goal in major currency units (e.g. naira). */
  @column()
  declare monthlyGoal: number

  @column()
  declare brandColor: string

  /** PRD §4: the invisible fork — managed payouts vs bring-your-own. */
  @column()
  declare payoutMode: PayoutMode

  @column()
  declare processor: Processor

  /** Khaime marketplace sub-merchant id (managed payouts). */
  @column()
  declare khaimeMerchantId: string | null

  /** Payout-setup state — knowable without a live Khaime call. */
  @column()
  declare payoutStatus: PayoutStatus

  /** Rail the creator set up: 'bank' (local) or 'stripe' (foreign). */
  @column()
  declare payoutProvider: PayoutProvider

  /** Currency Khaime settles in, once known. */
  @column()
  declare settlementCurrency: string | null

  /** Khaime-managed Stripe Connect account id, when applicable. */
  @column()
  declare stripeAccountId: string | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @hasMany(() => Support)
  declare supports: HasMany<typeof Support>
}
