import { prisma } from '../../utils/prisma'
import { requireUser } from '../../utils/auth'
import { requireUuidParam } from '../../utils/validation'
import { serializeBigInt } from '../../utils/serialize'

/** Single ledger entry with its full transfer context. Scoped to the owner. */
export default defineEventHandler(async (event) => {
  const user = requireUser(event)
  const id = requireUuidParam(getRouterParam(event, 'id'), 'Transaction')

  const entry = await prisma.entry.findFirst({
    where: { id, account: { userId: user.id } },
    include: {
      account: { select: { id: true, name: true, iban: true, currency: true } },
      transfer: {
        include: {
          sourceAccount: {
            select: { iban: true, name: true, user: { select: { firstName: true, lastName: true } } },
          },
          destinationAccount: {
            select: { iban: true, name: true, user: { select: { firstName: true, lastName: true } } },
          },
        },
      },
    },
  })

  if (!entry) {
    throw createError({ statusCode: 404, statusMessage: 'Transaction not found' })
  }

  return serializeBigInt({ entry })
})
