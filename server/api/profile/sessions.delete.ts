import { prisma } from '../../utils/prisma'
import { requireUser, SESSION_COOKIE, hashSessionToken } from '../../utils/auth'
import { recordAuditSafe } from '../../services/audit'

/** Sign out every other device, keeping the caller's own session alive. */
export default defineEventHandler(async (event) => {
  const user = requireUser(event)
  const token = getCookie(event, SESSION_COOKIE)

  const { count } = await prisma.session.deleteMany({
    where: {
      userId: user.id,
      ...(token ? { NOT: { tokenHash: hashSessionToken(token) } } : {}),
    },
  })

  recordAuditSafe({
    userId: user.id,
    action: 'sessions.revoked',
    entityType: 'User',
    entityId: user.id,
    metadata: { revoked: count },
    ipAddress: getRequestIP(event, { xForwardedFor: true }),
  })

  return { revoked: count }
})
