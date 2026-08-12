import { prisma } from '../utils/prisma'
import { requireUser } from '../utils/auth'
import { serializeBigInt } from '../utils/serialize'

const RECENT_ENTRY_LIMIT = 8
const FLOW_WINDOW_DAYS = 30
/** Points on the balance sparkline. */
const TREND_DAYS = 30

/** Everything the customer dashboard needs, in one round trip. */
export default defineEventHandler(async (event) => {
  const user = requireUser(event)

  const accounts = await prisma.account.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'asc' },
  })
  const openAccounts = accounts.filter((account) => account.status !== 'CLOSED')
  const accountIds = accounts.map((account) => account.id)
  const currencyOf = new Map(accounts.map((account) => [account.id, account.currency]))

  const recentEntries = accountIds.length
    ? await prisma.entry.findMany({
        where: { accountId: { in: accountIds } },
        orderBy: [{ bookedAt: 'desc' }, { id: 'desc' }],
        take: RECENT_ENTRY_LIMIT,
        include: {
          account: { select: { id: true, name: true, currency: true } },
          transfer: {
            select: {
              reference: true,
              title: true,
              type: true,
              status: true,
              externalName: true,
              externalIban: true,
              sourceAccount: {
                select: { name: true, user: { select: { firstName: true, lastName: true } } },
              },
              destinationAccount: {
                select: { name: true, user: { select: { firstName: true, lastName: true } } },
              },
            },
          },
        },
      })
    : []

  // Totals are grouped by currency — summing across currencies would be wrong.
  const balancesByCurrency = openAccounts.reduce<Record<string, bigint>>((acc, account) => {
    acc[account.currency] = (acc[account.currency] ?? 0n) + account.balanceCents
    return acc
  }, {})

  const since = new Date()
  since.setDate(since.getDate() - FLOW_WINDOW_DAYS)

  // Grouped by account (not just direction) so each entry can be attributed to
  // its own currency. Adding EUR cents onto a PLN total would silently produce
  // a figure that is not money in any currency.
  const flowRows = accountIds.length
    ? await prisma.entry.groupBy({
        by: ['accountId', 'direction'],
        where: { accountId: { in: accountIds }, bookedAt: { gte: since } },
        _sum: { amountCents: true },
      })
    : []

  const flowByCurrency: Record<string, { inflowCents: bigint; outflowCents: bigint }> = {}

  for (const currency of new Set(accounts.map((account) => account.currency))) {
    flowByCurrency[currency] = { inflowCents: 0n, outflowCents: 0n }
  }

  for (const row of flowRows) {
    const currency = currencyOf.get(row.accountId)
    const bucket = currency ? flowByCurrency[currency] : undefined
    const amount = row._sum.amountCents ?? 0n

    if (!bucket) continue

    if (row.direction === 'CREDIT') {
      bucket.inflowCents += amount
    } else {
      // Debits are stored negative; report the magnitude.
      bucket.outflowCents += amount < 0n ? -amount : amount
    }
  }

  // Daily closing balance per currency, for the dashboard trend chart.
  const trendSince = new Date()
  trendSince.setDate(trendSince.getDate() - TREND_DAYS)

  const trendEntries = accountIds.length
    ? await prisma.entry.findMany({
        where: { accountId: { in: accountIds }, bookedAt: { gte: trendSince } },
        orderBy: [{ bookedAt: 'asc' }, { id: 'asc' }],
        select: { accountId: true, amountCents: true, bookedAt: true },
      })
    : []

  // Walk backwards from today's balance to reconstruct the opening position,
  // then forwards again to produce one closing figure per day.
  const primaryCurrency =
    Object.entries(balancesByCurrency).sort(([, a], [, b]) => (b > a ? 1 : -1))[0]?.[0] ?? 'PLN'

  const inPrimary = accounts.filter((account) => account.currency === primaryCurrency)
  const primaryIds = new Set(inPrimary.map((account) => account.id))
  const closingBalance = inPrimary.reduce((sum, account) => sum + account.balanceCents, 0n)
  const movements = trendEntries.filter((entry) => primaryIds.has(entry.accountId))
  const netMovement = movements.reduce((sum, entry) => sum + entry.amountCents, 0n)

  let running = closingBalance - netMovement
  const byDay = new Map<string, bigint>()
  const firstDay = new Date(trendSince)

  for (let offset = 0; offset <= TREND_DAYS; offset += 1) {
    const day = new Date(firstDay)
    day.setDate(day.getDate() + offset)
    byDay.set(day.toISOString().slice(0, 10), 0n)
  }

  for (const entry of movements) {
    running += entry.amountCents
    byDay.set(entry.bookedAt.toISOString().slice(0, 10), running)
  }

  // Carry the last known balance across days with no activity.
  let carried = closingBalance - netMovement
  const balanceTrend = [...byDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, value]) => {
      if (value !== 0n) carried = value
      return { date, balanceCents: carried }
    })

  return serializeBigInt({
    accounts,
    recentEntries,
    summary: {
      balancesByCurrency,
      flowByCurrency,
      primaryCurrency,
      balanceTrend,
      accountCount: openAccounts.length,
    },
  })
})
