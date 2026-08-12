import { z } from 'zod'
import { prisma } from '../../utils/prisma'
import { requireUser } from '../../utils/auth'
import { parseOrThrow, requireUuidParam } from '../../utils/validation'
import { serializeBigInt } from '../../utils/serialize'
import { recordAudit } from '../../services/audit'

const updateSchema = z.object({ status: z.enum(['ACTIVE', 'PAUSED', 'CANCELLED']) })

export default defineEventHandler(async (event) => {
  const user = requireUser(event)
  const id = requireUuidParam(getRouterParam(event, 'id'), 'Standing order')
  const input = parseOrThrow(updateSchema, await readBody(event))

  const existing = await prisma.standingOrder.findFirst({ where: { id, userId: user.id } })

  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: 'Standing order not found' })
  }

  const order = await prisma.$transaction(async (tx) => {
    const updated = await tx.standingOrder.update({
      where: { id: existing.id },
      data: {
        status: input.status,
        // Resuming clears the failure counter, otherwise a previously exhausted
        // order would pause again on its very next hiccup.
        ...(input.status === 'ACTIVE' ? { failureCount: 0, lastError: null } : {}),
      },
    })

    await recordAudit(tx, {
      userId: user.id,
      action: `standing_order.${input.status.toLowerCase()}`,
      entityType: 'StandingOrder',
      entityId: updated.id,
    })

    return updated
  })

  return serializeBigInt({ order })
})
