import type { NotificationKind, Prisma, PrismaClient } from '@prisma/client'
import { prisma } from '../utils/prisma'

type Client = PrismaClient | Prisma.TransactionClient

export interface NotificationInput {
  userId: string
  kind: NotificationKind
  title: string
  body: string
  link?: string
}

/**
 * Append an in-app notification.
 *
 * Pass the transaction client when the notification describes something being
 * written in that transaction, so it commits or rolls back with it — a user
 * must never be told about a transfer that was subsequently rolled back.
 */
export async function notify(client: Client, input: NotificationInput): Promise<void> {
  await client.notification.create({
    data: {
      userId: input.userId,
      kind: input.kind,
      title: input.title,
      body: input.body,
      link: input.link ?? null,
    },
  })
}

/** Fire-and-forget variant for side effects outside a transaction. */
export function notifySafe(input: NotificationInput): void {
  void notify(prisma, input).catch(() => undefined)
}

/**
 * Raise a low-balance alert if the account just crossed its threshold.
 *
 * Only fires on the crossing, not on every subsequent transaction below it —
 * otherwise a customer running a low balance would be notified all day.
 */
export async function checkLowBalance(
  client: Client,
  params: { accountId: string; userId: string; accountName: string; before: bigint; after: bigint },
): Promise<void> {
  const account = await client.account.findUnique({
    where: { id: params.accountId },
    select: { lowBalanceCents: true, currency: true },
  })

  const threshold = account?.lowBalanceCents

  if (threshold === null || threshold === undefined) return
  if (params.before < threshold || params.after >= threshold) return

  await notify(client, {
    userId: params.userId,
    kind: 'LOW_BALANCE',
    title: 'Low balance',
    body: `${params.accountName} has dropped below your alert threshold.`,
    link: `/accounts/${params.accountId}`,
  })
}
