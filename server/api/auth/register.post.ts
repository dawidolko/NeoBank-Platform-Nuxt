import { prisma } from '../../utils/prisma'
import { createSession, hashPassword } from '../../utils/auth'
import { parseOrThrow, registerSchema } from '../../utils/validation'
import { generateIban } from '../../utils/iban'
import { recordAudit } from '../../services/audit'

export default defineEventHandler(async (event) => {
  const input = parseOrThrow(registerSchema, await readBody(event))

  const existing = await prisma.user.findUnique({ where: { email: input.email } })

  if (existing) {
    throw createError({
      statusCode: 422,
      statusMessage: 'Validation failed',
      data: { errors: { email: 'An account with this email already exists' } },
    })
  }

  const passwordHash = await hashPassword(input.password)

  // Every new customer gets a primary checking account so the dashboard is
  // never empty on first login.
  const user = await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: {
        email: input.email,
        passwordHash,
        firstName: input.firstName,
        lastName: input.lastName,
        phone: input.phone ?? null,
        accounts: {
          create: {
            iban: generateIban(),
            name: 'Personal Account',
            type: 'CHECKING',
            currency: 'PLN',
          },
        },
      },
    })

    await recordAudit(tx, {
      userId: created.id,
      action: 'user.registered',
      entityType: 'User',
      entityId: created.id,
      ipAddress: getRequestIP(event, { xForwardedFor: true }),
    })

    return created
  })

  await createSession(event, user.id)

  setResponseStatus(event, 201)

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
