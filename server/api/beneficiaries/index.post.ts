import { prisma } from '../../utils/prisma'
import { requireUser } from '../../utils/auth'
import { beneficiarySchema, parseOrThrow } from '../../utils/validation'

export default defineEventHandler(async (event) => {
  const user = requireUser(event)
  const input = parseOrThrow(beneficiarySchema, await readBody(event))

  const duplicate = await prisma.beneficiary.findUnique({
    where: { userId_iban: { userId: user.id, iban: input.iban } },
  })

  if (duplicate) {
    throw createError({
      statusCode: 422,
      statusMessage: 'Validation failed',
      data: { errors: { iban: 'This recipient is already saved' } },
    })
  }

  const beneficiary = await prisma.beneficiary.create({
    data: {
      userId: user.id,
      name: input.name,
      iban: input.iban,
      bankName: input.bankName ?? null,
    },
  })

  setResponseStatus(event, 201)

  return { beneficiary }
})
