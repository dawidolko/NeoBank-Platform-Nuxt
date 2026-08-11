import { prisma } from '../../utils/prisma'
import { requireUser } from '../../utils/auth'
import { parseOrThrow, profileUpdateSchema } from '../../utils/validation'
import { recordAudit } from '../../services/audit'

export default defineEventHandler(async (event) => {
  const current = requireUser(event)
  const input = parseOrThrow(profileUpdateSchema, await readBody(event))

  const user = await prisma.$transaction(async (tx) => {
    const updated = await tx.user.update({
      where: { id: current.id },
      data: {
        firstName: input.firstName,
        lastName: input.lastName,
        phone: input.phone ?? null,
      },
      select: { id: true, email: true, firstName: true, lastName: true, phone: true, role: true },
    })

    await recordAudit(tx, {
      userId: current.id,
      action: 'profile.updated',
      entityType: 'User',
      entityId: current.id,
      ipAddress: getRequestIP(event, { xForwardedFor: true }),
    })

    return updated
  })

  return { user }
})
