import { prisma } from '../../utils/prisma'
import { requireRole } from '../../utils/auth'
import { adminAuditQuerySchema, parseOrThrow } from '../../utils/validation'
import { serializeBigInt } from '../../utils/serialize'

export default defineEventHandler(async (event) => {
  requireRole(event, 'ADMIN')

  const { page, perPage, action, entityType } = parseOrThrow(
    adminAuditQuerySchema,
    getQuery(event),
  )

  const where = {
    ...(action ? { action: { contains: action, mode: 'insensitive' as const } } : {}),
    ...(entityType ? { entityType } : {}),
  }

  const [total, logs] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * perPage,
      take: perPage,
      include: { user: { select: { email: true, firstName: true, lastName: true } } },
    }),
  ])

  return serializeBigInt({
    logs,
    pagination: { page, perPage, total, pages: Math.ceil(total / perPage) },
  })
})
