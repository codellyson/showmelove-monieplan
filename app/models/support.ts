import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Creator from '#models/creator'

export type SupportStatus = 'pending' | 'succeeded' | 'failed'

export default class Support extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare creatorId: number

  /** Null means an anonymous supporter (PRD: no supporter account required). */
  @column()
  declare supporterName: string | null

  @column()
  declare message: string | null

  /** Amount in major currency units. */
  @column()
  declare amount: number

  @column()
  declare currency: string

  /** Monthly (recurring) is managed-mode only in v1. */
  @column()
  declare recurring: boolean

  @column()
  declare status: SupportStatus

  /** Amount charged to the supporter, in minor units of chargeCurrency. */
  @column()
  declare chargeAmount: number | null

  @column()
  declare chargeCurrency: string | null

  /** Marketplace split from Khaime's payment.succeeded webhook, as JSON. */
  @column()
  declare khaimeSplit: string | null

  /** Reference returned by the payment rail. */
  @column()
  declare reference: string

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => Creator)
  declare creator: BelongsTo<typeof Creator>
}
