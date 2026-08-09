import { resolveSessionUser } from '../utils/auth'

/**
 * Populates `event.context.user` for every request so handlers can call
 * `requireUser(event)` without repeating the cookie lookup.
 */
export default defineEventHandler(async (event) => {
  if (!event.path.startsWith('/api/')) return

  event.context.user = await resolveSessionUser(event)
})
