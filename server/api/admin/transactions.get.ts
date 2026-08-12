import type { Prisma } from '@prisma/client'
import { paginate } from '../../utils/pagination'
import { prisma } from '../../utils/prisma'
import { requireRole } from '../../utils/auth'
import { adminTransferQuerySchema, parseOrThrow } from '../../utils/validation'
import { serializeBigInt } from '../../utils/serialize'

/** Bank-wide transfer ledger — every transfer, regardless of owner. */
export default defineEventHandler(async (event) => {
  requireRole(event, 'ADMIN')

  const { page, perPage, search, status } = parseOrThrow(
    adminTransferQuerySchema,
    getQuery(event),
  )

  const where: Prisma.TransferWhereInput = {
    ...(status ? { status } : {}),
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

  const total = await prisma.transfer.count({ where })
  const pagination = paginate(total, page, perPage)

  const transfers = await prisma.transfer.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: pagination.skip,
      take: pagination.perPage,
      include: {
        sourceAccount: {
          select: { iban: true, name: true, user: { select: { firstName: true, lastName: true, email: true } } },
        },
        destinationAccount: {
          select: { iban: true, name: true, user: { select: { firstName: true, lastName: true, email: true } } },
        },
      },
    })

  return serializeBigInt({
    transfers,
    pagination: {
      page: pagination.page,
      perPage: pagination.perPage,
      total: pagination.total,
      pages: pagination.pages,
    },
  })
})
