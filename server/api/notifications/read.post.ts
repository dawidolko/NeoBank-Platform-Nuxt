import { prisma } from '../../utils/prisma'
import { requireUser } from '../../utils/auth'

/** Mark everything read. Per-item marking is not worth the extra round trips. */
export default defineEventHandler(async (event) => {
  const user = requireUser(event)

  const { count } = await prisma.notification.updateMany({
    where: { userId: user.id, readAt: null },
    data: { readAt: new Date() },
  })

  return { marked: count }
})
