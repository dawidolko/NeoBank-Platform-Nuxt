import type { Prisma } from '@prisma/client'
import { paginate } from '../../utils/pagination'
import { prisma } from '../../utils/prisma'
import { requireUser } from '../../utils/auth'
import { parseOrThrow, transactionQuerySchema } from '../../utils/validation'
import { serializeBigInt } from '../../utils/serialize'

/**
 * Statement view: every ledger entry touching one of the caller's accounts,
 * newest first. Reading entries (not transfers) means an internal transfer
 * between two own accounts correctly appears twice — once per leg.
 */
export default defineEventHandler(async (event) => {
  const user = requireUser(event)
  const query = parseOrThrow(transactionQuerySchema, getQuery(event))

  const accountIds = (
    await prisma.account.findMany({ where: { userId: user.id }, select: { id: true } })
  ).map((account) => account.id)

  if (accountIds.length === 0) {
    return { transactions: [], pagination: { page: 1, perPage: query.perPage, total: 0, pages: 0 } }
  }

  // Narrow to one account only when the caller actually owns it.
  const scopedIds =
    query.accountId && accountIds.includes(query.accountId) ? [query.accountId] : accountIds

  const where: Prisma.EntryWhereInput = {
    accountId: { in: scopedIds },
    ...(query.from || query.to
      ? {
          bookedAt: {
            ...(query.from ? { gte: new Date(`${query.from}T00:00:00.000Z`) } : {}),
            ...(query.to ? { lte: new Date(`${query.to}T23:59:59.999Z`) } : {}),
          },
        }
      : {}),
    ...(query.type || query.status || query.search
      ? {
          transfer: {
            ...(query.type ? { type: query.type } : {}),
            ...(query.status ? { status: query.status } : {}),
            ...(query.search
              ? {
                  OR: [
                    { title: { contains: query.search, mode: 'insensitive' } },
                    { reference: { contains: query.search, mode: 'insensitive' } },
                    { externalName: { contains: query.search, mode: 'insensitive' } },
                  ],
                }
              : {}),
          },
        }
      : {}),
  }

  const total = await prisma.entry.count({ where })
  const pagination = paginate(total, query.page, query.perPage)

  const entries = await prisma.entry.findMany({
      where,
      orderBy: [{ bookedAt: 'desc' }, { id: 'desc' }],
      skip: pagination.skip,
      take: pagination.perPage,
      include: {
        account: { select: { id: true, name: true, iban: true, currency: true } },
        transfer: {
          include: {
            sourceAccount: { select: { iban: true, name: true, user: { select: { firstName: true, lastName: true } } } },
            destinationAccount: { select: { iban: true, name: true, user: { select: { firstName: true, lastName: true } } } },
          },
        },
      },
    })

  return serializeBigInt({
    transactions: entries,
    pagination: {
      page: pagination.page,
      perPage: pagination.perPage,
      total: pagination.total,
      pages: pagination.pages,
    },
  })
})
