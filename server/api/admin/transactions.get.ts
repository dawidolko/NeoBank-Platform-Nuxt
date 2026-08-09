import type { Prisma } from '@prisma/client'
import { prisma } from '../../utils/prisma'
import { requireRole } from '../../utils/auth'
import { serializeBigInt } from '../../utils/serialize'

/** Bank-wide transfer ledger — every transfer, regardless of owner. */
export default defineEventHandler(async (event) => {
  requireRole(event, 'ADMIN')

  const query = getQuery(event)
  const page = Math.max(1, Number(query.page) || 1)
  const perPage = Math.min(100, Math.max(1, Number(query.perPage) || 25))
  const search = typeof query.search === 'string' ? query.search.trim() : ''
  const status = typeof query.status === 'string' ? query.status : ''

  const where: Prisma.TransferWhereInput = {
    ...(status ? { status: status as Prisma.EnumTransferStatusFilter['equals'] } : {}),
    ...(search
      ? {
          OR: [
            { reference: { contains: search, mode: 'insensitive' } },
            { title: { contains: search, mode: 'insensitive' } },
            { externalIban: { contains: search, mode: 'insensitive' } },
          ],
        }
      : {}),
  }

  const [total, transfers] = await Promise.all([
    prisma.transfer.count({ where }),
    prisma.transfer.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * perPage,
      take: perPage,
      include: {
        sourceAccount: {
          select: { iban: true, name: true, user: { select: { firstName: true, lastName: true, email: true } } },
        },
        destinationAccount: {
          select: { iban: true, name: true, user: { select: { firstName: true, lastName: true, email: true } } },
        },
      },
    }),
  ])

  return serializeBigInt({
    transfers,
    pagination: { page, perPage, total, pages: Math.ceil(total / perPage) },
  })
})
