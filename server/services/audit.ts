import type { Prisma, PrismaClient } from '@prisma/client'
import { prisma } from '../utils/prisma'

export interface AuditInput {
  userId?: string | null
  action: string
  entityType: string
  entityId?: string | null
  metadata?: Prisma.InputJsonValue
  ipAddress?: string | null
}

type Client = PrismaClient | Prisma.TransactionClient

/**
 * Append an audit record.
 *
 * Pass the transaction client when the audited change is part of a
 * transaction — the log must commit or roll back with the thing it describes.
 */
export async function recordAudit(client: Client, input: AuditInput): Promise<void> {
  await client.auditLog.create({
    data: {
      userId: input.userId ?? null,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      metadata: input.metadata,
      ipAddress: input.ipAddress ?? null,
    },
  })
}

/** Fire-and-forget variant for side-effects outside a transaction (e.g. logins). */
export function recordAuditSafe(input: AuditInput): void {
  void recordAudit(prisma, input).catch(() => undefined)
}
