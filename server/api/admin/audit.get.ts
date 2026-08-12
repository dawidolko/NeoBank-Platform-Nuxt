import { paginate } from '../../utils/pagination'
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

  const total = await prisma.auditLog.count({ where })
  const pagination = paginate(total, page, perPage)

  const logs = await prisma.auditLog.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: pagination.skip,
      take: pagination.perPage,
      include: { user: { select: { email: true, firstName: true, lastName: true } } },
    })

  return serializeBigInt({
    logs,
    pagination: {
      page: pagination.page,
      perPage: pagination.perPage,
      total: pagination.total,
      pages: pagination.pages,
    },
  })
})
