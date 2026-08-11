import { prisma } from '../../utils/prisma'
import { requireUser } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  const current = requireUser(event)

  const user = await prisma.user.findUniqueOrThrow({
    where: { id: current.id },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      phone: true,
      role: true,
      status: true,
      createdAt: true,
      _count: { select: { accounts: true, beneficiaries: true } },
    },
  })

  return { user }
})
