import { prisma } from '../../utils/prisma'
import { createSession, verifyPassword } from '../../utils/auth'
import { loginSchema, parseOrThrow } from '../../utils/validation'
import { recordAuditSafe } from '../../services/audit'

/** Same message for "no such user" and "wrong password" — no account enumeration. */
const INVALID_CREDENTIALS = 'Incorrect email or password'

/**
 * A real Argon2id hash of a value nobody can supply. Verified against when the
 * email is unknown so the handler burns the same CPU either way — a fake or
 * malformed hash would fail instantly and leak account existence via latency.
 */
const TIMING_EQUALIZER_HASH =
  '$argon2id$v=19$m=19456,t=2,p=1$1uv2nSjN2+7tKB/WPpeFtw$lcXw/ytQ4tK5PJ7FnmB3GaXrvvEcwxDznXyc+/Z6828'

export default defineEventHandler(async (event) => {
  const input = parseOrThrow(loginSchema, await readBody(event))
  const ipAddress = getRequestIP(event, { xForwardedFor: true })

  const user = await prisma.user.findUnique({ where: { email: input.email } })

  // Hash even when the user is missing, so response time does not reveal
  // whether the address is registered.
  const passwordValid = await verifyPassword(
    user?.passwordHash ?? TIMING_EQUALIZER_HASH,
    input.password,
  )

  if (!user || !passwordValid) {
    recordAuditSafe({
      userId: user?.id ?? null,
      action: 'auth.login_failed',
      entityType: 'User',
      entityId: user?.id ?? null,
      metadata: { email: input.email },
      ipAddress,
    })

    throw createError({
      statusCode: 401,
      statusMessage: 'Invalid credentials',
      data: { errors: { form: INVALID_CREDENTIALS } },
    })
  }

  if (user.status !== 'ACTIVE') {
    throw createError({
      statusCode: 403,
      statusMessage: 'Account unavailable',
      data: {
        errors: {
          form: 'This account has been suspended. Please contact support.',
        },
      },
    })
  }

  await createSession(event, user.id)

  recordAuditSafe({
    userId: user.id,
    action: 'auth.login',
    entityType: 'User',
    entityId: user.id,
    ipAddress,
  })

  return {
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
    },
  }
})
