import { prisma } from '../../utils/prisma'
import { requireRole } from '../../utils/auth'
import { serializeBigInt } from '../../utils/serialize'

export default defineEventHandler(async (event) => {
  requireRole(event, 'ADMIN')

  const query = getQuery(event)
  const page = Math.max(1, Number(query.page) || 1)
  const perPage = Math.min(100, Math.max(1, Number(query.perPage) || 30))

  const [total, logs] = await Promise.all([
    prisma.auditLog.count(),
    prisma.auditLog.findMany({
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
