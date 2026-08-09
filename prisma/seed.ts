/**
 * NeoBank seed data.
 *
 * Idempotent: every write is an upsert keyed on a natural identifier, and the
 * transaction history is only generated when an account has no entries yet.
 * Safe to run on every container boot.
 */
import { PrismaClient, type Account, type Currency, type Prisma } from '@prisma/client'
import argon2 from 'argon2'

const prisma = new PrismaClient()

const ARGON_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
} as const

// --- Deterministic helpers --------------------------------------------------

/**
 * Seeded PRNG (mulberry32). Demo data must be identical on every machine, so
 * Math.random() is deliberately avoided.
 */
function createRandom(seed: number) {
  let state = seed

  return () => {
    state |= 0
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const random = createRandom(20260809)

function pick<T>(items: readonly T[]): T {
  return items[Math.floor(random() * items.length)]!
}

function randomInt(min: number, max: number): number {
  return Math.floor(random() * (max - min + 1)) + min
}

// --- IBAN (mirrors server/utils/iban.ts; seed runs outside Nitro) -----------

const SORT_CODE = '10203040'

function mod97(numeric: string): number {
  let remainder = 0
  for (const char of numeric) remainder = (remainder * 10 + Number(char)) % 97
  return remainder
}

function buildIban(accountNumber: string): string {
  const bban = `${SORT_CODE}${accountNumber}`
  const numeric = `${bban}PL00`
    .split('')
    .map((char) => (/[A-Z]/.test(char) ? String(char.charCodeAt(0) - 55) : char))
    .join('')
  const checkDigits = String(98 - mod97(numeric)).padStart(2, '0')
  return `PL${checkDigits}${bban}`
}

/** Deterministic IBAN from a stable key, so re-seeding reuses the same rows. */
function ibanFor(key: string): string {
  let hash = 2166136261
  for (const char of key) {
    hash ^= char.charCodeAt(0)
    hash = Math.imul(hash, 16777619)
  }
  return buildIban(String(hash >>> 0).padStart(16, '0').slice(-16))
}

// --- Demo catalogue ---------------------------------------------------------

const SPEND_MERCHANTS = [
  'Biedronka', 'Żabka', 'Lidl', 'Allegro', 'Empik', 'Orlen', 'Uber',
  'Netflix', 'Spotify', 'Rossmann', 'Media Expert', 'IKEA', 'Decathlon',
  'Starbucks', 'Booking.com', 'PKP Intercity',
] as const

const INCOME_SOURCES = [
  'Salary — Softmind Sp. z o.o.',
  'Freelance invoice #2291',
  'Tax refund',
  'Interest payment',
] as const

const EXTERNAL_BANKS = [
  { name: 'Jan Nowak', iban: 'PL61109010140000071219812874', bank: 'Santander' },
  { name: 'Maria Wiśniewska', iban: 'DE89370400440532013000', bank: 'Deutsche Bank' },
  { name: 'Thomas Kaufmann', iban: 'NL91ABNA0417164300', bank: 'ABN AMRO' },
] as const

let referenceCounter = 1000

function nextReference(): string {
  referenceCounter += 1
  return `NB-${referenceCounter.toString(16).toUpperCase().padStart(8, '0')}`
}

// --- Ledger writer ----------------------------------------------------------

interface LedgerOptions {
  account: Account
  counterAccount?: Account
  amountCents: bigint
  title: string
  type: 'INTERNAL' | 'EXTERNAL' | 'DEPOSIT' | 'WITHDRAWAL'
  direction: 'CREDIT' | 'DEBIT'
  bookedAt: Date
  externalName?: string
  externalIban?: string
}

/**
 * Book one historical transfer with balanced entries, keeping the running
 * balance in `balances` so `balanceAfterCents` is accurate on every row.
 */
async function bookTransfer(
  tx: Prisma.TransactionClient,
  balances: Map<string, bigint>,
  options: LedgerOptions,
): Promise<void> {
  const { account, counterAccount, amountCents, direction, bookedAt } = options
  const isCredit = direction === 'CREDIT'

  const transfer = await tx.transfer.create({
    data: {
      reference: nextReference(),
      type: options.type,
      status: 'COMPLETED',
      amountCents,
      currency: account.currency,
      title: options.title,
      externalIban: options.externalIban ?? null,
      externalName: options.externalName ?? null,
      sourceAccountId: isCredit ? (counterAccount?.id ?? null) : account.id,
      destinationAccountId: isCredit ? account.id : (counterAccount?.id ?? null),
      createdAt: bookedAt,
      updatedAt: bookedAt,
    },
  })

  const current = balances.get(account.id) ?? 0n
  const balanceAfter = isCredit ? current + amountCents : current - amountCents
  balances.set(account.id, balanceAfter)

  await tx.entry.create({
    data: {
      accountId: account.id,
      transferId: transfer.id,
      direction,
      amountCents: isCredit ? amountCents : -amountCents,
      balanceAfterCents: balanceAfter,
      bookedAt,
    },
  })

  // The mirror leg only exists when both sides are NeoBank accounts.
  if (counterAccount) {
    const counterCurrent = balances.get(counterAccount.id) ?? 0n
    const counterAfter = isCredit ? counterCurrent - amountCents : counterCurrent + amountCents
    balances.set(counterAccount.id, counterAfter)

    await tx.entry.create({
      data: {
        accountId: counterAccount.id,
        transferId: transfer.id,
        direction: isCredit ? 'DEBIT' : 'CREDIT',
        amountCents: isCredit ? -amountCents : amountCents,
        balanceAfterCents: counterAfter,
        bookedAt,
      },
    })
  }
}

// --- Seed -------------------------------------------------------------------

async function main() {
  console.log('🌱 Seeding NeoBank...')

  const adminEmail = process.env.SEED_ADMIN_EMAIL || 'admin@neobank.dev'
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || 'Admin12345!'
  const customerEmail = process.env.SEED_CUSTOMER_EMAIL || 'anna.kowalska@example.com'
  const customerPassword = process.env.SEED_CUSTOMER_PASSWORD || 'Customer12345!'

  const [adminHash, customerHash] = await Promise.all([
    argon2.hash(adminPassword, ARGON_OPTIONS),
    argon2.hash(customerPassword, ARGON_OPTIONS),
  ])

  // --- Users ---------------------------------------------------------------
  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: { role: 'ADMIN', status: 'ACTIVE' },
    create: {
      email: adminEmail,
      passwordHash: adminHash,
      firstName: 'Dawid',
      lastName: 'Olko',
      role: 'ADMIN',
      phone: '+48 600 100 200',
    },
  })

  const customer = await prisma.user.upsert({
    where: { email: customerEmail },
    update: { status: 'ACTIVE' },
    create: {
      email: customerEmail,
      passwordHash: customerHash,
      firstName: 'Anna',
      lastName: 'Kowalska',
      phone: '+48 601 202 303',
    },
  })

  const secondaryCustomers = await Promise.all(
    [
      { email: 'piotr.zielinski@example.com', firstName: 'Piotr', lastName: 'Zieliński' },
      { email: 'marta.lewandowska@example.com', firstName: 'Marta', lastName: 'Lewandowska' },
      { email: 'tomasz.wojcik@example.com', firstName: 'Tomasz', lastName: 'Wójcik' },
    ].map(async (person) =>
      prisma.user.upsert({
        where: { email: person.email },
        update: {},
        create: {
          ...person,
          passwordHash: customerHash,
          phone: `+48 6${randomInt(10, 99)} ${randomInt(100, 999)} ${randomInt(100, 999)}`,
        },
      }),
    ),
  )

  console.log(`   users: ${2 + secondaryCustomers.length}`)

  // --- Accounts ------------------------------------------------------------
  const accountBlueprints: Array<{
    key: string
    userId: string
    name: string
    type: 'CHECKING' | 'SAVINGS' | 'CREDIT'
    currency: Currency
    overdraftCents?: bigint
  }> = [
    { key: `${customer.email}:main`, userId: customer.id, name: 'Everyday Account', type: 'CHECKING', currency: 'PLN' },
    { key: `${customer.email}:savings`, userId: customer.id, name: 'Savings Goal', type: 'SAVINGS', currency: 'PLN' },
    { key: `${customer.email}:eur`, userId: customer.id, name: 'Euro Travel', type: 'CHECKING', currency: 'EUR' },
    { key: `${admin.email}:main`, userId: admin.id, name: 'Operations Account', type: 'CHECKING', currency: 'PLN' },
  ]

  for (const [index, person] of secondaryCustomers.entries()) {
    accountBlueprints.push({
      key: `${person.email}:main`,
      userId: person.id,
      name: 'Personal Account',
      type: 'CHECKING',
      currency: index === 2 ? 'EUR' : 'PLN',
    })
  }

  const accounts = new Map<string, Account>()

  for (const blueprint of accountBlueprints) {
    const account = await prisma.account.upsert({
      where: { iban: ibanFor(blueprint.key) },
      update: {},
      create: {
        iban: ibanFor(blueprint.key),
        name: blueprint.name,
        type: blueprint.type,
        currency: blueprint.currency,
        userId: blueprint.userId,
        overdraftCents: blueprint.overdraftCents ?? 0n,
      },
    })
    accounts.set(blueprint.key, account)
  }

  console.log(`   accounts: ${accounts.size}`)

  // --- Cards ---------------------------------------------------------------
  const mainAccount = accounts.get(`${customer.email}:main`)!
  const savingsAccount = accounts.get(`${customer.email}:savings`)!
  const eurAccount = accounts.get(`${customer.email}:eur`)!

  const existingCards = await prisma.card.count({ where: { accountId: mainAccount.id } })

  if (existingCards === 0) {
    await prisma.card.createMany({
      data: [
        { accountId: mainAccount.id, last4: '4291', brand: 'Visa', type: 'DEBIT', expiryMonth: 8, expiryYear: 2029 },
        { accountId: mainAccount.id, last4: '7715', brand: 'Mastercard', type: 'CREDIT', expiryMonth: 3, expiryYear: 2028 },
        { accountId: eurAccount.id, last4: '9032', brand: 'Visa', type: 'DEBIT', expiryMonth: 11, expiryYear: 2027 },
      ],
    })
  }

  // --- Beneficiaries -------------------------------------------------------
  for (const beneficiary of EXTERNAL_BANKS) {
    await prisma.beneficiary.upsert({
      where: { userId_iban: { userId: customer.id, iban: beneficiary.iban } },
      update: {},
      create: {
        userId: customer.id,
        name: beneficiary.name,
        iban: beneficiary.iban,
        bankName: beneficiary.bank,
      },
    })
  }

  // --- Transaction history -------------------------------------------------
  // Only generated once; a re-run leaves existing history untouched.
  const alreadyBooked = await prisma.entry.count({ where: { accountId: mainAccount.id } })

  if (alreadyBooked > 0) {
    console.log('   history already present — skipping ledger generation')
    console.log('✅ Seed complete.')
    return
  }

  const balances = new Map<string, bigint>()
  const peerAccounts = secondaryCustomers
    .map((person) => accounts.get(`${person.email}:main`))
    .filter((account): account is Account => Boolean(account) && account!.currency === 'PLN')

  await prisma.$transaction(
    async (tx) => {
      const now = new Date()
      // Nine months of history, oldest first so running balances make sense.
      const start = new Date(now)
      start.setMonth(start.getMonth() - 9)

      // Opening balances.
      await bookTransfer(tx, balances, {
        account: mainAccount,
        amountCents: 1_250_000n, // 12 500.00 PLN
        title: 'Opening balance',
        type: 'DEPOSIT',
        direction: 'CREDIT',
        bookedAt: start,
      })
      await bookTransfer(tx, balances, {
        account: eurAccount,
        amountCents: 320_000n, // 3 200.00 EUR
        title: 'Opening balance',
        type: 'DEPOSIT',
        direction: 'CREDIT',
        bookedAt: start,
      })

      for (const peer of peerAccounts) {
        await bookTransfer(tx, balances, {
          account: peer,
          amountCents: BigInt(randomInt(400_000, 900_000)),
          title: 'Opening balance',
          type: 'DEPOSIT',
          direction: 'CREDIT',
          bookedAt: start,
        })
      }

      // Month-by-month activity.
      for (let monthsAgo = 8; monthsAgo >= 0; monthsAgo -= 1) {
        const monthStart = new Date(now)
        monthStart.setMonth(monthStart.getMonth() - monthsAgo)
        monthStart.setDate(1)

        const dayIn = (day: number, hour = 10) => {
          const date = new Date(monthStart)
          date.setDate(day)
          date.setHours(hour, randomInt(0, 59), 0, 0)
          return date > now ? now : date
        }

        // Salary on the 10th.
        await bookTransfer(tx, balances, {
          account: mainAccount,
          amountCents: BigInt(randomInt(890_000, 1_020_000)),
          title: pick(INCOME_SOURCES),
          type: 'DEPOSIT',
          direction: 'CREDIT',
          bookedAt: dayIn(10, 9),
        })

        // Rent on the 12th.
        await bookTransfer(tx, balances, {
          account: mainAccount,
          amountCents: 280_000n,
          title: 'Monthly rent',
          type: 'EXTERNAL',
          direction: 'DEBIT',
          bookedAt: dayIn(12, 8),
          externalName: 'Property Management Ltd',
          externalIban: 'PL61109010140000071219812874',
        })

        // Standing transfer to savings.
        await bookTransfer(tx, balances, {
          account: savingsAccount,
          counterAccount: mainAccount,
          amountCents: 100_000n,
          title: 'Monthly savings',
          type: 'INTERNAL',
          direction: 'CREDIT',
          bookedAt: dayIn(13, 7),
        })

        // Everyday card spending.
        for (let i = 0; i < randomInt(9, 16); i += 1) {
          await bookTransfer(tx, balances, {
            account: mainAccount,
            amountCents: BigInt(randomInt(1_200, 38_000)),
            title: pick(SPEND_MERCHANTS),
            type: 'EXTERNAL',
            direction: 'DEBIT',
            bookedAt: dayIn(randomInt(1, 28), randomInt(8, 21)),
            externalName: 'Card payment',
          })
        }

        // A peer-to-peer transfer most months.
        if (peerAccounts.length > 0 && random() > 0.35) {
          const peer = pick(peerAccounts)
          await bookTransfer(tx, balances, {
            account: peer,
            counterAccount: mainAccount,
            amountCents: BigInt(randomInt(5_000, 60_000)),
            title: pick(['Dinner split', 'Concert tickets', 'Shared gift', 'Holiday deposit']),
            type: 'INTERNAL',
            direction: 'CREDIT',
            bookedAt: dayIn(randomInt(14, 27), randomInt(12, 20)),
          })
        }

        // Occasional EUR spending.
        if (random() > 0.5) {
          await bookTransfer(tx, balances, {
            account: eurAccount,
            amountCents: BigInt(randomInt(2_000, 25_000)),
            title: pick(['Booking.com', 'Ryanair', 'Airbnb', 'Lufthansa']),
            type: 'EXTERNAL',
            direction: 'DEBIT',
            bookedAt: dayIn(randomInt(5, 25), randomInt(9, 19)),
            externalName: 'Card payment',
          })
        }
      }

      // Persist the final running balances.
      for (const [accountId, balanceCents] of balances) {
        await tx.account.update({ where: { id: accountId }, data: { balanceCents } })
      }
    },
    { timeout: 120_000, maxWait: 20_000 },
  )

  const entryCount = await prisma.entry.count()
  const transferCount = await prisma.transfer.count()

  console.log(`   transfers: ${transferCount}`)
  console.log(`   ledger entries: ${entryCount}`)
  console.log('')
  console.log('   Demo credentials')
  console.log(`   ├─ admin:    ${adminEmail} / ${adminPassword}`)
  console.log(`   └─ customer: ${customerEmail} / ${customerPassword}`)
  console.log('')
  console.log('✅ Seed complete.')
}

main()
  .catch((error) => {
    console.error('❌ Seed failed:', error)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
