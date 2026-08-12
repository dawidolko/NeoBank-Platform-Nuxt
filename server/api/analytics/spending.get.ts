import { prisma } from '../../utils/prisma'
import { requireUser } from '../../utils/auth'
import { parseOrThrow, spendingQuerySchema } from '../../utils/validation'
import { serializeBigInt } from '../../utils/serialize'
import { CATEGORY_META } from '../../utils/categorize'

/**
 * Spending grouped by category for one currency.
 *
 * Scoped to a single currency on purpose: a breakdown that mixed PLN and EUR
 * into one total would not be money in either.
 */
export default defineEventHandler(async (event) => {
  const user = requireUser(event)
  const query = parseOrThrow(spendingQuerySchema, getQuery(event))

  const accounts = await prisma.account.findMany({
    where: { userId: user.id },
    select: { id: true, currency: true, balanceCents: true },
  })

  if (accounts.length === 0) {
    return {
      currency: query.currency ?? 'PLN',
      totalCents: '0',
      categories: [] as Array<{
        category: string
        label: string
        icon: string
        hue: string
        amountCents: string
        share: number
      }>,
      months: [] as Array<{ month: string; amountCents: string }>,
      days: query.days,
    }
  }

  // Default to whichever currency the customer holds most of.
  const currency =
    query.currency ??
    [...accounts]
      .sort((a, b) => (b.balanceCents > a.balanceCents ? 1 : -1))[0]!.currency

  const scoped = accounts
    .filter((account) => account.currency === currency)
    .map((account) => account.id)

  const since = new Date()
  since.setDate(since.getDate() - query.days)

  const entries = scoped.length
    ? await prisma.entry.findMany({
        where: { accountId: { in: scoped }, direction: 'DEBIT', bookedAt: { gte: since } },
        select: { amountCents: true, bookedAt: true, transfer: { select: { category: true } } },
      })
    : []

  const byCategory = new Map<string, bigint>()
  const byMonth = new Map<string, bigint>()
  let totalCents = 0n

  for (const entry of entries) {
    // Debits are stored negative; report magnitudes.
    const amount = entry.amountCents < 0n ? -entry.amountCents : entry.amountCents
    const month = entry.bookedAt.toISOString().slice(0, 7)

    byCategory.set(entry.transfer.category, (byCategory.get(entry.transfer.category) ?? 0n) + amount)
    byMonth.set(month, (byMonth.get(month) ?? 0n) + amount)
    totalCents += amount
  }

  const categories = [...byCategory.entries()]
    .map(([category, amountCents]) => {
      const meta = CATEGORY_META[category as keyof typeof CATEGORY_META]

      return {
        category,
        label: meta?.label ?? category,
        icon: meta?.icon ?? 'circle',
        hue: meta?.hue ?? '240 8% 58%',
        amountCents,
        // One decimal place, computed in integer space to avoid float drift.
        share: totalCents > 0n ? Number((amountCents * 1000n) / totalCents) / 10 : 0,
      }
    })
    .sort((a, b) => (b.amountCents > a.amountCents ? 1 : b.amountCents < a.amountCents ? -1 : 0))

  const months = [...byMonth.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, amountCents]) => ({ month, amountCents }))

  return serializeBigInt({ currency, totalCents, categories, months, days: query.days })
})
