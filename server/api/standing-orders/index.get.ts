import { prisma } from '../../utils/prisma'
import { requireUser } from '../../utils/auth'
import { serializeBigInt } from '../../utils/serialize'

export default defineEventHandler(async (event) => {
  const user = requireUser(event)

  const orders = await prisma.standingOrder.findMany({
    where: { userId: user.id, status: { not: 'CANCELLED' } },
    orderBy: [{ status: 'asc' }, { nextRunAt: 'asc' }],
    include: {
      sourceAccount: { select: { id: true, name: true, currency: true, iban: true } },
    },
  })

  return serializeBigInt({ orders })
})
