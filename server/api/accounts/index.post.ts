import { prisma } from '../../utils/prisma'
import { requireUser } from '../../utils/auth'
import { accountCreateSchema, parseOrThrow } from '../../utils/validation'
import { generateIban } from '../../utils/iban'
import { serializeBigInt } from '../../utils/serialize'
import { recordAudit } from '../../services/audit'

const MAX_ACCOUNTS_PER_USER = 10

export default defineEventHandler(async (event) => {
  const user = requireUser(event)
  const input = parseOrThrow(accountCreateSchema, await readBody(event))

  const existingCount = await prisma.account.count({ where: { userId: user.id } })

  if (existingCount >= MAX_ACCOUNTS_PER_USER) {
    throw createError({
      statusCode: 422,
      statusMessage: 'Account limit reached',
      data: { errors: { form: `You can hold at most ${MAX_ACCOUNTS_PER_USER} accounts.` } },
    })
  }

  const account = await prisma.$transaction(async (tx) => {
    const created = await tx.account.create({
      data: {
        iban: generateIban(),
        name: input.name,
        type: input.type,
        currency: input.currency,
        userId: user.id,
        // A credit account is the only kind that may run negative.
        overdraftCents: input.type === 'CREDIT' ? 500_000n : 0n,
      },
    })

    await recordAudit(tx, {
      userId: user.id,
      action: 'account.opened',
      entityType: 'Account',
      entityId: created.id,
      metadata: { iban: created.iban, type: created.type, currency: created.currency },
    })

    return created
  })

  setResponseStatus(event, 201)

  return serializeBigInt({ account })
})
