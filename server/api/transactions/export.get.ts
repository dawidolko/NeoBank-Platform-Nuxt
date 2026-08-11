import type { Prisma } from '@prisma/client'
import { prisma } from '../../utils/prisma'
import { requireUser } from '../../utils/auth'
import { parseOrThrow, statementExportSchema } from '../../utils/validation'
import { centsToDecimalString, type CurrencyCode } from '../../utils/money'

const MAX_ROWS = 10_000

/** RFC 4180 quoting so titles containing commas or quotes survive the round trip. */
function csvCell(value: string | number | null | undefined): string {
  const text = String(value ?? '')

  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

export default defineEventHandler(async (event) => {
  const user = requireUser(event)
  const query = parseOrThrow(statementExportSchema, getQuery(event))

  const owned = await prisma.account.findMany({
    where: { userId: user.id },
    select: { id: true },
  })
  const ownedIds = owned.map((account) => account.id)

  if (ownedIds.length === 0) {
    throw createError({ statusCode: 404, statusMessage: 'No accounts to export' })
  }

  const scopedIds =
    query.accountId && ownedIds.includes(query.accountId) ? [query.accountId] : ownedIds

  const where: Prisma.EntryWhereInput = {
    accountId: { in: scopedIds },
    ...(query.from || query.to
      ? {
          bookedAt: {
            ...(query.from ? { gte: new Date(`${query.from}T00:00:00.000Z`) } : {}),
            ...(query.to ? { lte: new Date(`${query.to}T23:59:59.999Z`) } : {}),
          },
        }
      : {}),
  }

  const entries = await prisma.entry.findMany({
    where,
    orderBy: { bookedAt: 'desc' },
    take: MAX_ROWS,
    include: {
      account: { select: { name: true, iban: true, currency: true } },
      transfer: {
        select: {
          reference: true,
          title: true,
          type: true,
          status: true,
          externalName: true,
          externalIban: true,
        },
      },
    },
  })

  const header = [
    'Date',
    'Reference',
    'Description',
    'Counterparty',
    'Account',
    'IBAN',
    'Type',
    'Status',
    'Direction',
    'Amount',
    'Currency',
    'Balance after',
  ]

  const rows = entries.map((entry) =>
    [
      entry.bookedAt.toISOString(),
      entry.transfer.reference,
      entry.transfer.title,
      entry.transfer.externalName ?? '',
      entry.account.name,
      entry.account.iban,
      entry.transfer.type,
      entry.transfer.status,
      entry.direction,
      centsToDecimalString(entry.amountCents, entry.account.currency as CurrencyCode),
      entry.account.currency,
      centsToDecimalString(entry.balanceAfterCents, entry.account.currency as CurrencyCode),
    ]
      .map(csvCell)
      .join(','),
  )

  const filename = `neobank-statement-${new Date().toISOString().slice(0, 10)}.csv`

  setResponseHeaders(event, {
    'content-type': 'text/csv; charset=utf-8',
    'content-disposition': `attachment; filename="${filename}"`,
    'cache-control': 'no-store',
  })

  // BOM keeps Excel from mangling non-ASCII names.
  const BOM = '\uFEFF'

  return `${BOM}${[header.join(','), ...rows].join('\r\n')}`
})
