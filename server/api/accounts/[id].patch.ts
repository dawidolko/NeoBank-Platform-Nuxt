import { prisma } from '../../utils/prisma'
import { requireUser } from '../../utils/auth'
import { accountRenameSchema, parseOrThrow } from '../../utils/validation'
import { serializeBigInt } from '../../utils/serialize'
import { recordAudit } from '../../services/audit'

export default defineEventHandler(async (event) => {
  const user = requireUser(event)
  const id = requireUuidParam(getRouterParam(event, 'id'), 'Account')
  const input = parseOrThrow(accountRenameSchema, await readBody(event))

  const existing = await prisma.account.findFirst({ where: { id, userId: user.id } })

  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: 'Account not found' })
  }

  const account = await prisma.$transaction(async (tx) => {
    const updated = await tx.account.update({
      where: { id: existing.id },
      data: { name: input.name },
    })

    await recordAudit(tx, {
      userId: user.id,
      action: 'account.renamed',
      entityType: 'Account',
      entityId: updated.id,
      metadata: { from: existing.name, to: updated.name },
    })

    return updated
  })

  return serializeBigInt({ account })
})
