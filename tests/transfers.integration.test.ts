/**
 * Integration tests for the ledger.
 *
 * These run against a real PostgreSQL database — the concurrency and
 * isolation guarantees under test cannot be reproduced with a mock.
 * Skipped automatically when DATABASE_URL is not configured.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { PrismaClient } from '@prisma/client'
import { executeDeposit, executeTransfer, TransferError } from '../server/services/transfers'
import { generateIban } from '../server/utils/iban'

const DATABASE_AVAILABLE = Boolean(process.env.DATABASE_URL)
const prisma = new PrismaClient()

const suite = DATABASE_AVAILABLE ? describe : describe.skip

suite('ledger integrity', () => {
  let userId: string
  let otherUserId: string
  let accountA: string
  let accountB: string
  let ibanB: string
  let foreignAccountIban: string

  beforeAll(async () => {
    const stamp = `test-${Date.now()}`

    const user = await prisma.user.create({
      data: {
        email: `${stamp}@test.local`,
        passwordHash: 'x',
        firstName: 'Test',
        lastName: 'User',
        // Both accounts open at zero and are funded through the ledger below,
        // so `balanceCents` always equals the sum of that account's entries —
        // the invariant the final test asserts.
        accounts: {
          create: [
            { iban: generateIban(), name: 'A', currency: 'PLN' },
            { iban: generateIban(), name: 'B', currency: 'PLN' },
          ],
        },
      },
      include: { accounts: { orderBy: { name: 'asc' } } },
    })

    const other = await prisma.user.create({
      data: {
        email: `${stamp}-other@test.local`,
        passwordHash: 'x',
        firstName: 'Other',
        lastName: 'User',
        accounts: { create: [{ iban: generateIban(), name: 'C', currency: 'PLN' }] },
      },
      include: { accounts: true },
    })

    userId = user.id
    otherUserId = other.id
    accountA = user.accounts[0]!.id
    accountB = user.accounts[1]!.id
    ibanB = user.accounts[1]!.iban
    foreignAccountIban = other.accounts[0]!.iban

    // Opening float, booked as a real deposit.
    await executeDeposit({
      userId,
      accountId: accountA,
      amountCents: 100_000n,
      title: 'Opening balance',
    })
  })

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { id: { in: [userId, otherUserId] } } })
    await prisma.$disconnect()
  })

  it('moves money and writes two balanced entries', async () => {
    const transfer = await executeTransfer({
      userId,
      sourceAccountId: accountA,
      destinationIban: ibanB,
      amountCents: 25_000n,
      title: 'Internal move',
    })

    const [source, destination, entries] = await Promise.all([
      prisma.account.findUniqueOrThrow({ where: { id: accountA } }),
      prisma.account.findUniqueOrThrow({ where: { id: accountB } }),
      prisma.entry.findMany({ where: { transferId: transfer.id } }),
    ])

    expect(source.balanceCents).toBe(75_000n)
    expect(destination.balanceCents).toBe(25_000n)
    expect(entries).toHaveLength(2)
    // The defining property of double-entry: legs cancel out.
    expect(entries.reduce((sum, entry) => sum + entry.amountCents, 0n)).toBe(0n)
  })

  it('records balanceAfter matching the account balance', async () => {
    const entry = await prisma.entry.findFirstOrThrow({
      where: { accountId: accountA },
      orderBy: { bookedAt: 'desc' },
    })
    const account = await prisma.account.findUniqueOrThrow({ where: { id: accountA } })

    expect(entry.balanceAfterCents).toBe(account.balanceCents)
  })

  it('refuses to overdraw an account without an overdraft', async () => {
    await expect(
      executeTransfer({
        userId,
        sourceAccountId: accountA,
        destinationIban: ibanB,
        amountCents: 999_999_999n,
        title: 'Too much',
      }),
    ).rejects.toThrow(TransferError)

    const source = await prisma.account.findUniqueOrThrow({ where: { id: accountA } })

    expect(source.balanceCents).toBe(75_000n) // unchanged
  })

  it('rolls back completely on failure — no orphan transfer rows', async () => {
    const before = await prisma.transfer.count()

    await expect(
      executeTransfer({
        userId,
        sourceAccountId: accountA,
        destinationIban: ibanB,
        amountCents: 999_999_999n,
        title: 'Doomed',
      }),
    ).rejects.toThrow()

    expect(await prisma.transfer.count()).toBe(before)
  })

  it('rejects a transfer from an account the caller does not own', async () => {
    await expect(
      executeTransfer({
        userId: otherUserId, // not the owner of accountA
        sourceAccountId: accountA,
        destinationIban: ibanB,
        amountCents: 1_000n,
        title: 'Not mine',
      }),
    ).rejects.toThrow(/not found/i)
  })

  it('rejects sending to the same account', async () => {
    const account = await prisma.account.findUniqueOrThrow({ where: { id: accountA } })

    await expect(
      executeTransfer({
        userId,
        sourceAccountId: accountA,
        destinationIban: account.iban,
        amountCents: 1_000n,
        title: 'Self',
      }),
    ).rejects.toThrow(/same account/i)
  })

  it('books an external transfer as a single debit leg', async () => {
    const transfer = await executeTransfer({
      userId,
      sourceAccountId: accountA,
      destinationIban: 'GB82WEST12345698765432',
      amountCents: 5_000n,
      title: 'External payout',
      externalName: 'Jane Doe',
    })

    const entries = await prisma.entry.findMany({ where: { transferId: transfer.id } })

    expect(transfer.type).toBe('EXTERNAL')
    expect(entries).toHaveLength(1)
    expect(entries[0]!.direction).toBe('DEBIT')
  })

  it('credits an account on deposit', async () => {
    const before = await prisma.account.findUniqueOrThrow({ where: { id: accountB } })

    await executeDeposit({ userId, accountId: accountB, amountCents: 10_000n, title: 'Salary' })

    const after = await prisma.account.findUniqueOrThrow({ where: { id: accountB } })

    expect(after.balanceCents).toBe(before.balanceCents + 10_000n)
  })

  it('never lets concurrent transfers overdraw the account', async () => {
    // Top up through the ledger (not a raw balance write) so the account stays
    // reconcilable — the invariant test below compares balances against entries.
    const current = await prisma.account.findUniqueOrThrow({ where: { id: accountA } })
    const target = 30_000n // exactly 3x the transfer amount

    if (current.balanceCents < target) {
      await executeDeposit({
        userId,
        accountId: accountA,
        amountCents: target - current.balanceCents,
        title: 'Race test funding',
      })
    } else if (current.balanceCents > target) {
      await executeTransfer({
        userId,
        sourceAccountId: accountA,
        destinationIban: 'GB82WEST12345698765432',
        amountCents: current.balanceCents - target,
        title: 'Race test drawdown',
      })
    }

    const results = await Promise.allSettled(
      Array.from({ length: 10 }, () =>
        executeTransfer({
          userId,
          sourceAccountId: accountA,
          destinationIban: foreignAccountIban,
          amountCents: 10_000n,
          title: 'Race',
        }),
      ),
    )

    const succeeded = results.filter((result) => result.status === 'fulfilled').length
    const final = await prisma.account.findUniqueOrThrow({ where: { id: accountA } })

    // At most three can succeed, and the balance must never go negative.
    expect(succeeded).toBeLessThanOrEqual(3)
    expect(final.balanceCents).toBeGreaterThanOrEqual(0n)
    expect(final.balanceCents).toBe(30_000n - BigInt(succeeded) * 10_000n)
  })

  it('keeps every account consistent with the sum of its entries', async () => {
    const accounts = await prisma.account.findMany({
      where: { userId: { in: [userId, otherUserId] } },
      include: { entries: true },
    })

    for (const account of accounts) {
      const sum = account.entries.reduce((total, entry) => total + entry.amountCents, 0n)

      expect(account.balanceCents, `${account.name} drifted from its entries`).toBe(sum)
    }
  })
})
