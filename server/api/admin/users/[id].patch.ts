import { z } from 'zod'
import { prisma } from '../../../utils/prisma'
import { requireRole } from '../../../utils/auth'
import { parseOrThrow } from '../../../utils/validation'
import { recordAudit } from '../../../services/audit'

const updateSchema = z.object({
  status: z.enum(['ACTIVE', 'SUSPENDED', 'CLOSED']).optional(),
  role: z.enum(['CUSTOMER', 'ADMIN']).optional(),
})

export default defineEventHandler(async (event) => {
  const admin = requireRole(event, 'ADMIN')
  const id = getRouterParam(event, 'id')
  const input = parseOrThrow(updateSchema, await readBody(event))

  if (!input.status && !input.role) {
    throw createError({ statusCode: 422, statusMessage: 'Nothing to update' })
  }

  // An admin locking or demoting themselves would strand the panel.
  if (id === admin.id) {
    throw createError({
      statusCode: 422,
      statusMessage: 'You cannot change your own role or status',
      data: { errors: { form: 'You cannot change your own role or status' } },
    })
  }

  const target = await prisma.user.findUnique({ where: { id } })

  if (!target) {
    throw createError({ statusCode: 404, statusMessage: 'User not found' })
  }

  const user = await prisma.$transaction(async (tx) => {
    const updated = await tx.user.update({
      where: { id },
      data: { ...(input.status ? { status: input.status } : {}), ...(input.role ? { role: input.role } : {}) },
      select: { id: true, email: true, role: true, status: true },
    })

    // Revoking access must also kill live sessions, not just future logins.
    if (input.status && input.status !== 'ACTIVE') {
      await tx.session.deleteMany({ where: { userId: updated.id } })
    }

    await recordAudit(tx, {
      userId: admin.id,
      action: 'admin.user_updated',
      entityType: 'User',
      entityId: updated.id,
      metadata: {
        from: { role: target.role, status: target.status },
        to: { role: updated.role, status: updated.status },
      },
      ipAddress: getRequestIP(event, { xForwardedFor: true }),
    })

    return updated
  })

  return { user }
})
