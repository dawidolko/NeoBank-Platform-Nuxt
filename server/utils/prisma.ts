import { PrismaClient } from '@prisma/client'

/**
 * A single PrismaClient for the whole server process.
 *
 * Nitro's dev server re-evaluates modules on HMR, so the client is cached on
 * globalThis to avoid exhausting the Postgres connection pool with orphans.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  })

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}
