import { destroySession } from '../../utils/auth'
import { recordAuditSafe } from '../../services/audit'

export default defineEventHandler(async (event) => {
  const user = event.context.user as { id: string } | null

  await destroySession(event)

  if (user) {
    recordAuditSafe({
      userId: user.id,
      action: 'auth.logout',
      entityType: 'User',
      entityId: user.id,
    })
  }

  return { success: true }
})
