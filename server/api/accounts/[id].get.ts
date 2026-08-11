import { prisma } from '../../utils/prisma'
import { requireUser } from '../../utils/auth'
import { requireUuidParam } from '../../utils/validation'
import { serializeBigInt } from '../../utils/serialize'

export default defineEventHandler(async (event) => {
  const user = requireUser(event)
  const id = requireUuidParam(getRouterParam(event, 'id'), 'Account')

  // Scoped by userId — an id belonging to someone else reads as 404, not 403.
  const account = await prisma.account.findFirst({
    where: { id, userId: user.id },
    include: {
      cards: true,
      entries: {
        orderBy: { bookedAt: 'desc' },
        take: 10,
        include: { transfer: true },
      },
    },
  })

  if (!account) {
    throw createError({ statusCode: 404, statusMessage: 'Account not found' })
  }

  return serializeBigInt({ account })
})
