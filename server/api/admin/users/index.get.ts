import type { Prisma } from '@prisma/client'
import { prisma } from '../../../utils/prisma'
import { requireRole } from '../../../utils/auth'
import { adminUserQuerySchema, parseOrThrow } from '../../../utils/validation'
import { serializeBigInt } from '../../../utils/serialize'

export default defineEventHandler(async (event) => {
  requireRole(event, 'ADMIN')

  const { page, perPage, search } = parseOrThrow(adminUserQuerySchema, getQuery(event))

  const where: Prisma.UserWhereInput = search
    ? {
        OR: [
          { email: { contains: search, mode: 'insensitive' } },
          { firstName: { contains: search, mode: 'insensitive' } },
          { lastName: { contains: search, mode: 'insensitive' } },
        ],
      }
    : {}

  const [total, users] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * perPage,
      take: perPage,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        status: true,
        createdAt: true,
        accounts: { select: { id: true, balanceCents: true, currency: true } },
      },
    }),
  ])

  return serializeBigInt({
    users,
    pagination: { page, perPage, total, pages: Math.ceil(total / perPage) },
  })
})
