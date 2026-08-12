import { prisma } from '../../utils/prisma'
import { hashPassword, requireUser, verifyPassword, SESSION_COOKIE, hashSessionToken } from '../../utils/auth'
import { enforceRateLimit } from '../../utils/rateLimit'
import { parseOrThrow, passwordChangeSchema } from '../../utils/validation'
import { recordAudit } from '../../services/audit'

export default defineEventHandler(async (event) => {
  const current = requireUser(event)

  enforceRateLimit(event, { key: 'password-change', limit: 5, windowMs: 600000, identifier: current.id })
  const input = parseOrThrow(passwordChangeSchema, await readBody(event))

  const user = await prisma.user.findUniqueOrThrow({ where: { id: current.id } })

  if (!(await verifyPassword(user.passwordHash, input.currentPassword))) {
    throw createError({
      statusCode: 422,
      statusMessage: 'Validation failed',
      data: { errors: { currentPassword: 'That is not your current password' } },
    })
  }

  if (await verifyPassword(user.passwordHash, input.newPassword)) {
    throw createError({
      statusCode: 422,
      statusMessage: 'Validation failed',
      data: { errors: { newPassword: 'Choose a password you have not used before' } },
    })
  }

  const passwordHash = await hashPassword(input.newPassword)
  const currentToken = getCookie(event, SESSION_COOKIE)

  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: user.id }, data: { passwordHash } })

    // Every other device is signed out; the caller keeps their own session.
    await tx.session.deleteMany({
      where: {
        userId: user.id,
        ...(currentToken ? { NOT: { tokenHash: hashSessionToken(currentToken) } } : {}),
      },
    })

    await recordAudit(tx, {
      userId: user.id,
      action: 'password.changed',
      entityType: 'User',
      entityId: user.id,
      ipAddress: getRequestIP(event, { xForwardedFor: true }),
    })
  })

  return { success: true }
})
