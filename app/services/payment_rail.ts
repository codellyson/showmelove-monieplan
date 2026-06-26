import Creator from '#models/creator'

/**
 * Payment seam (PRD §5).
 *
 * The product is the experience layer; payment rails sit underneath and are
 * swappable. The front half (intent -> charge -> checkout -> webhook -> record)
 * is identical for every rail. This module models that seam with a mock rail so
 * the whole flow works end-to-end without owning real payment infrastructure.
 *
 * Mode A (bring-your-own): charge on the creator's own Paystack/Stripe, 0% fee.
 * Mode B (managed): charge via the partner who custodies and pays out.
 * Both are invisible to supporters and mocked identically here.
 */

export interface SupportIntent {
  amount: number
  currency: string
  recurring: boolean
  supporterName?: string | null
  message?: string | null
}

export interface ChargeResult {
  reference: string
  checkoutUrl: string
  /** Did the (mock) charge settle? Real rails resolve this via webhook. */
  succeeded: boolean
}

export interface PaymentRail {
  readonly name: string
  createCharge(intent: SupportIntent): Promise<ChargeResult>
}

function makeReference(prefix: string): string {
  // Deterministic-enough unique-ish reference for the demo.
  const rand = Math.random().toString(36).slice(2, 10)
  return `${prefix}_${Date.now().toString(36)}${rand}`
}

/** The only rail in this build. Always "succeeds". */
export class MockRail implements PaymentRail {
  constructor(public readonly name: string) {}

  async createCharge(intent: SupportIntent): Promise<ChargeResult> {
    const reference = makeReference(this.name)
    return {
      reference,
      checkoutUrl: `/mock-checkout/${reference}`,
      succeeded: intent.amount > 0,
    }
  }
}

/**
 * Resolve the rail a creator is wired to. Real implementation would return a
 * PaystackRail / StripeRail (Mode A) or the partner rail (Mode B).
 */
export function railFor(creator: Creator): PaymentRail {
  if (creator.payoutMode === 'byo') {
    return new MockRail(creator.processor ?? 'byo')
  }
  return new MockRail('managed')
}
