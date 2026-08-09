import { prisma } from '../utils/prisma'
import { requireUser } from '../utils/auth'
import { serializeBigInt } from '../utils/serialize'

/** Everything the customer dashboard needs, in one round trip. */
export default defineEventHandler(async (event) => {
  const user = requireUser(event)

  const accounts = await prisma.account.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'asc' },
  })
  const accountIds = accounts.map((account) => account.id)

  const recentEntries = accountIds.length
    ? await prisma.entry.findMany({
        where: { accountId: { in: accountIds } },
        orderBy: { bookedAt: 'desc' },
        take: 8,
        include: {
          account: { select: { name: true, currency: true } },
          transfer: {
            select: {
              reference: true,
              title: true,
              type: true,
              status: true,
              externalName: true,
              externalIban: true,
            },
          },
        },
      })
    : []

  // Totals are grouped by currency — summing across currencies would be wrong.
  const balancesByCurrency = accounts.reduce<Record<string, bigint>>((acc, account) => {
    acc[account.currency] = (acc[account.currency] ?? 0n) + account.balanceCents
    return acc
  }, {})

  const since = new Date()
  since.setDate(since.getDate() - 30)

  const monthlyFlow = accountIds.length
    ? await prisma.entry.groupBy({
        by: ['direction'],
        where: { accountId: { in: accountIds }, bookedAt: { gte: since } },
        _sum: { amountCents: true },
      })
    : []

  const inflowCents = monthlyFlow.find((row) => row.direction === 'CREDIT')?._sum.amountCents ?? 0n
  const outflowCents = monthlyFlow.find((row) => row.direction === 'DEBIT')?._sum.amountCents ?? 0n

  return serializeBigInt({
    accounts,
    recentEntries,
    summary: {
      balancesByCurrency,
      inflowCents,
      // Debit entries are stored negative; report the magnitude.
      outflowCents: outflowCents < 0n ? -outflowCents : outflowCents,
      accountCount: accounts.length,
    },
  })
})
