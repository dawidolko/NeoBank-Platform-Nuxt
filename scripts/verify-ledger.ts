/**
 * Reconciles the ledger against itself.
 *
 * Every rule the transfer engine exists to protect is re-checked here straight
 * from SQL, independently of the application code that wrote the rows. Run it
 * in CI after seeding, or against a real database to audit live data.
 *
 *   npx tsx scripts/verify-ledger.ts
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

interface Check {
  name: string
  detail: string
  run: () => Promise<{ ok: boolean; found: number; sample?: string }>
}

async function countRows(query: Promise<Array<{ id: string }>>) {
  const rows = await query

  return { ok: rows.length === 0, found: rows.length, sample: rows[0]?.id }
}

const checks: Check[] = [
  {
    name: 'balances match entries',
    detail: 'every account balance equals the sum of its ledger entries',
    run: () =>
      countRows(prisma.$queryRaw<Array<{ id: string }>>`
        SELECT a.id
        FROM accounts a
        LEFT JOIN entries e ON e."accountId" = a.id
        GROUP BY a.id, a."balanceCents"
        HAVING COALESCE(SUM(e."amountCents"), 0) <> a."balanceCents"
      `),
  },
  {
    name: 'internal transfers balance',
    detail: 'both legs of an internal transfer sum to zero',
    run: () =>
      countRows(prisma.$queryRaw<Array<{ id: string }>>`
        SELECT t.id
        FROM transfers t
        JOIN entries e ON e."transferId" = t.id
        WHERE t.type = 'INTERNAL'
        GROUP BY t.id
        HAVING SUM(e."amountCents") <> 0
      `),
  },
  {
    name: 'internal transfers have two legs',
    detail: 'an internal transfer writes exactly one debit and one credit',
    run: () =>
      countRows(prisma.$queryRaw<Array<{ id: string }>>`
        SELECT t.id
        FROM transfers t
        JOIN entries e ON e."transferId" = t.id
        WHERE t.type = 'INTERNAL'
        GROUP BY t.id
        HAVING COUNT(e.id) <> 2
      `),
  },
  {
    name: 'overdraft limits respected',
    detail: 'no account is further negative than its overdraft allows',
    run: () =>
      countRows(prisma.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM accounts WHERE "balanceCents" < -"overdraftCents"
      `),
  },
  {
    name: 'entry directions match their sign',
    detail: 'debits are negative and credits are positive',
    run: () =>
      countRows(prisma.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM entries
        WHERE (direction = 'DEBIT' AND "amountCents" > 0)
           OR (direction = 'CREDIT' AND "amountCents" < 0)
      `),
  },
  {
    name: 'no orphaned entries',
    detail: 'every entry belongs to a transfer and an account',
    run: () =>
      countRows(prisma.$queryRaw<Array<{ id: string }>>`
        SELECT e.id
        FROM entries e
        LEFT JOIN transfers t ON t.id = e."transferId"
        LEFT JOIN accounts a ON a.id = e."accountId"
        WHERE t.id IS NULL OR a.id IS NULL
      `),
  },
  {
    name: 'completed transfers are booked',
    detail: 'a completed transfer always has at least one entry',
    run: () =>
      countRows(prisma.$queryRaw<Array<{ id: string }>>`
        SELECT t.id
        FROM transfers t
        LEFT JOIN entries e ON e."transferId" = t.id
        WHERE t.status = 'COMPLETED'
        GROUP BY t.id
        HAVING COUNT(e.id) = 0
      `),
  },
  {
    name: 'running balances form an unbroken chain',
    detail: 'every entry starts from a balance another entry left behind',
    run: () =>
      // `bookedAt` is not a total order — both legs of an internal transfer
      // share a timestamp, and the seeder clamps same-day events onto one
      // instant — so the chain is verified by linkage rather than by ordering:
      // the balance before each entry (balanceAfter - amount) must equal either
      // zero (the account's first entry) or the balanceAfter of some other
      // entry on the same account. A miscomputed balance links to nothing.
      countRows(prisma.$queryRaw<Array<{ id: string }>>`
        SELECT e.id
        FROM entries e
        WHERE (e."balanceAfterCents" - e."amountCents") <> 0
          AND NOT EXISTS (
            SELECT 1 FROM entries p
            WHERE p."accountId" = e."accountId"
              AND p.id <> e.id
              AND p."balanceAfterCents" = e."balanceAfterCents" - e."amountCents"
          )
      `),
  },
]

async function main() {
  console.log('Verifying ledger integrity...\n')

  let failed = 0

  for (const check of checks) {
    const result = await check.run()

    if (result.ok) {
      console.log(`  ✅ ${check.name} — ${check.detail}`)
    } else {
      failed += 1
      console.error(
        `  ❌ ${check.name} — ${result.found} violation(s)` +
          (result.sample ? ` (first: ${result.sample})` : ''),
      )
    }
  }

  const [accounts, transfers, entries] = await Promise.all([
    prisma.account.count(),
    prisma.transfer.count(),
    prisma.entry.count(),
  ])

  console.log(
    `\n${accounts} accounts · ${transfers} transfers · ${entries} entries checked`,
  )

  if (failed > 0) {
    console.error(`\n${failed} check(s) failed. The ledger does not reconcile.`)
    process.exit(1)
  }

  console.log('All checks passed. The ledger reconciles.')
}

main()
  .catch((error) => {
    console.error('Verification failed to run:', error)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
