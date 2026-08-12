import { prisma } from '../utils/prisma'
import { executeTransfer, TransferError } from './transfers'
import { notify } from './notifications'
import { recordAudit } from './audit'

/** How many consecutive failures before an order stops retrying. */
const MAX_FAILURES = 3

/**
 * Advance a due date by one interval.
 *
 * Anchored to the previous due date rather than to "now", so an order that runs
 * late does not permanently drift later. A monthly order on the 31st lands on
 * the last day of shorter months instead of overflowing into the next one.
 */
export function nextDueDate(from: Date, interval: 'WEEKLY' | 'MONTHLY'): Date {
  const next = new Date(from)

  if (interval === 'WEEKLY') {
    next.setDate(next.getDate() + 7)
    return next
  }

  const targetDay = from.getDate()

  next.setDate(1)
  next.setMonth(next.getMonth() + 1)

  const daysInMonth = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate()

  next.setDate(Math.min(targetDay, daysInMonth))

  return next
}

export interface RunSummary {
  processed: number
  succeeded: number
  failed: number
}

/**
 * Execute every standing order that has fallen due.
 *
 * Each order is processed independently: one failure never blocks the queue,
 * and the money movement itself still goes through `executeTransfer`, so the
 * locking and balancing rules are identical to a manual transfer.
 */
export async function runDueStandingOrders(now = new Date()): Promise<RunSummary> {
  const due = await prisma.standingOrder.findMany({
    where: { status: 'ACTIVE', nextRunAt: { lte: now } },
    orderBy: { nextRunAt: 'asc' },
    take: 100,
  })

  const summary: RunSummary = { processed: 0, succeeded: 0, failed: 0 }

  for (const order of due) {
    summary.processed += 1

    try {
      const transfer = await executeTransfer({
        userId: order.userId,
        sourceAccountId: order.sourceAccountId,
        destinationIban: order.destinationIban,
        amountCents: order.amountCents,
        title: order.title,
        externalName: order.recipientName,
      })

      await prisma.$transaction(async (tx) => {
        await tx.standingOrder.update({
          where: { id: order.id },
          data: {
            lastRunAt: now,
            nextRunAt: nextDueDate(order.nextRunAt, order.interval),
            failureCount: 0,
            lastError: null,
          },
        })

        await notify(tx, {
          userId: order.userId,
          kind: 'STANDING_ORDER',
          title: 'Standing order paid',
          body: `${order.title} — sent to ${order.recipientName}.`,
          link: `/standing-orders`,
        })

        await recordAudit(tx, {
          userId: order.userId,
          action: 'standing_order.executed',
          entityType: 'StandingOrder',
          entityId: order.id,
          metadata: { reference: transfer.reference },
        })
      })

      summary.succeeded += 1
    } catch (error) {
      summary.failed += 1

      const failures = order.failureCount + 1
      const reason = error instanceof TransferError ? error.message : 'Unexpected error'
      // Give up after repeated failures rather than retrying forever — an
      // order against a closed account would otherwise fail every single run.
      const exhausted = failures >= MAX_FAILURES

      await prisma.$transaction(async (tx) => {
        await tx.standingOrder.update({
          where: { id: order.id },
          data: {
            failureCount: failures,
            lastError: reason,
            status: exhausted ? 'PAUSED' : 'ACTIVE',
            nextRunAt: exhausted
              ? order.nextRunAt
              : nextDueDate(order.nextRunAt, order.interval),
          },
        })

        await notify(tx, {
          userId: order.userId,
          kind: 'STANDING_ORDER',
          title: exhausted ? 'Standing order paused' : 'Standing order failed',
          body: exhausted
            ? `${order.title} was paused after ${failures} failed attempts: ${reason}`
            : `${order.title} could not be paid: ${reason}`,
          link: '/standing-orders',
        })
      })
    }
  }

  return summary
}
