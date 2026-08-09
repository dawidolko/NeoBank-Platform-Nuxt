import { prisma } from '../utils/prisma'

/** Liveness + database readiness. Used by the container HEALTHCHECK. */
export default defineEventHandler(async (event) => {
  try {
    await prisma.$queryRaw`SELECT 1`

    return {
      status: 'ok',
      database: 'connected',
      timestamp: new Date().toISOString(),
    }
  } catch {
    setResponseStatus(event, 503)

    return {
      status: 'degraded',
      database: 'unreachable',
      timestamp: new Date().toISOString(),
    }
  }
})
