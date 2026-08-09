import { prisma } from '../../utils/prisma'
import { requireUser } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  const user = requireUser(event)

  const beneficiaries = await prisma.beneficiary.findMany({
    where: { userId: user.id },
    orderBy: { name: 'asc' },
  })

  return { beneficiaries }
})
