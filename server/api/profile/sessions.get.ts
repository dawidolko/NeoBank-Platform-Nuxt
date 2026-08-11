import { prisma } from '../../utils/prisma'
import { requireUser, SESSION_COOKIE, hashSessionToken } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  const user = requireUser(event)
  const token = getCookie(event, SESSION_COOKIE)
  const currentHash = token ? hashSessionToken(token) : null

  const sessions = await prisma.session.findMany({
    where: { userId: user.id, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      tokenHash: true,
      userAgent: true,
      ipAddress: true,
      createdAt: true,
      expiresAt: true,
    },
  })

  return {
    sessions: sessions.map(({ tokenHash, ...session }) => ({
      ...session,
      current: tokenHash === currentHash,
    })),
  }
})
