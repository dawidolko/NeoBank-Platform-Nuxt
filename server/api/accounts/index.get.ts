import { prisma } from '../../utils/prisma'
import { requireUser } from '../../utils/auth'
import { serializeBigInt } from '../../utils/serialize'

export default defineEventHandler(async (event) => {
  const user = requireUser(event)

  const accounts = await prisma.account.findMany({
    where: { userId: user.id },
    orderBy: [{ createdAt: 'asc' }],
    include: {
      cards: { select: { id: true, last4: true, brand: true, type: true, status: true } },
      _count: { select: { entries: true } },
    },
  })

  return serializeBigInt({ accounts })
})
