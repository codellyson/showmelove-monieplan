import { BaseSeeder } from '@adonisjs/lucid/seeders'
import { DateTime } from 'luxon'
import Creator from '#models/creator'
import Support from '#models/support'

export default class extends BaseSeeder {
  async run() {
    // Reset so the seeder is re-runnable.
    await Support.query().delete()
    await Creator.query().delete()

    const ada = await Creator.create({
      displayName: 'Ada Obi',
      handle: 'adabuilds',
      bio: 'builds small, useful tools for Nigerian creatives',
      location: 'Lagos, NG',
      currency: 'NGN',
      currencySymbol: '₦',
      monthlyGoal: 100000,
      brandColor: '#FF5A36',
      payoutMode: 'managed',
      processor: null,
    })

    const now = DateTime.now()

    // The four featured love notes (most recent, shown across the product).
    const featured = [
      { name: 'Tunde', amount: 2000, msg: 'Your tools saved me so many late nights. Take this and keep building!', when: now.minus({ hours: 2 }) },
      { name: 'Kemi', amount: 5000, msg: 'First time supporting anyone here — you earned it. 🧡', when: now.minus({ hours: 5 }) },
      { name: null, amount: 500, msg: 'Small love, big respect.', when: now.minus({ days: 1 }) },
      { name: 'Chidinma', amount: 1000, msg: 'Keep going, please. We need more people like you.', when: now.minus({ days: 2 }) },
    ]

    // Filler supporters to reach 23 total / ₦45,000 raised.
    const fillerNames = ['Bola', 'Emeka', null, 'Zainab', 'Ife', null, 'Sade', 'Uche', 'Ngozi', 'Femi', null, 'Tari', 'Dami', 'Yemi', 'Obi', null, 'Lara', 'Kunle', 'Bisi']
    const fillerAmts = [3000, 1000, 500, 2000, 1500, 1000, 2500, 2000, 1000, 3000, 500, 2000, 1000, 1500, 2000, 1000, 2500, 2000]
    const featuredTotal = featured.reduce((s, f) => s + f.amount, 0)
    const fillerKnown = fillerAmts.reduce((s, a) => s + a, 0)
    // Last filler closes the gap to exactly ₦45,000.
    fillerAmts.push(45000 - featuredTotal - fillerKnown)

    const rows = [
      ...featured.map((f, i) => ({
        creatorId: ada.id,
        supporterName: f.name,
        message: f.msg,
        amount: f.amount,
        currency: 'NGN',
        recurring: false,
        status: 'succeeded' as const,
        reference: `seed_f${i}`,
        createdAt: f.when,
        updatedAt: f.when,
      })),
      ...fillerNames.map((name, i) => {
        const when = now.minus({ days: 3 + i * 2 })
        return {
          creatorId: ada.id,
          supporterName: name,
          message: null,
          amount: fillerAmts[i],
          currency: 'NGN',
          recurring: false,
          status: 'succeeded' as const,
          reference: `seed_g${i}`,
          createdAt: when,
          updatedAt: when,
        }
      }),
    ]

    await Support.createMany(rows)
  }
}
