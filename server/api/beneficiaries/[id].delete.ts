import { prisma } from '../../utils/prisma'
import { requireUser } from '../../utils/auth'
import { requireUuidParam } from '../../utils/validation'

export default defineEventHandler(async (event) => {
  const user = requireUser(event)
  const id = requireUuidParam(getRouterParam(event, 'id'), 'Recipient')

  const deleted = await prisma.beneficiary.deleteMany({ where: { id, userId: user.id } })

  if (deleted.count === 0) {
    throw createError({ statusCode: 404, statusMessage: 'Recipient not found' })
  }

  return { success: true }
})
