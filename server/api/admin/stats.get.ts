import { prisma } from '../../utils/prisma'
import { requireRole } from '../../utils/auth'
import { serializeBigInt } from '../../utils/serialize'

export default defineEventHandler(async (event) => {
  requireRole(event, 'ADMIN')

  const [users, accounts, transfers, volume, byStatus, recent] = await Promise.all([
    prisma.user.count(),
    prisma.account.count(),
    prisma.transfer.count(),
    prisma.transfer.aggregate({
      _sum: { amountCents: true },
      where: { status: 'COMPLETED' },
    }),
    prisma.transfer.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.transfer.findMany({
      orderBy: { createdAt: 'desc' },
      take: 8,
      include: {
        sourceAccount: { select: { iban: true, user: { select: { firstName: true, lastName: true } } } },
      },
    }),
  ])

  // Total assets held = sum of positive balances across the bank.
  const deposits = await prisma.account.aggregate({ _sum: { balanceCents: true } })

  return serializeBigInt({
    totals: {
      users,
      accounts,
      transfers,
      transferVolumeCents: volume._sum.amountCents ?? 0n,
      depositsCents: deposits._sum.balanceCents ?? 0n,
    },
    transfersByStatus: byStatus.map((row) => ({ status: row.status, count: row._count._all })),
    recentTransfers: recent,
  })
})
