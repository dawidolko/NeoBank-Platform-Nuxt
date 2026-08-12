-- CreateEnum
CREATE TYPE "Category" AS ENUM ('GROCERIES', 'TRANSPORT', 'ENTERTAINMENT', 'SHOPPING', 'BILLS', 'HEALTH', 'TRAVEL', 'INCOME', 'TRANSFER', 'OTHER');

-- CreateEnum
CREATE TYPE "ScheduleInterval" AS ENUM ('WEEKLY', 'MONTHLY');

-- CreateEnum
CREATE TYPE "ScheduleStatus" AS ENUM ('ACTIVE', 'PAUSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "NotificationKind" AS ENUM ('TRANSFER_RECEIVED', 'TRANSFER_SENT', 'LOW_BALANCE', 'SECURITY', 'STANDING_ORDER');

-- AlterTable
ALTER TABLE "accounts" ADD COLUMN     "lowBalanceCents" BIGINT;

-- AlterTable
ALTER TABLE "transfers" ADD COLUMN     "category" "Category" NOT NULL DEFAULT 'OTHER';

-- CreateTable
CREATE TABLE "standing_orders" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sourceAccountId" TEXT NOT NULL,
    "destinationIban" TEXT NOT NULL,
    "recipientName" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "amountCents" BIGINT NOT NULL,
    "interval" "ScheduleInterval" NOT NULL DEFAULT 'MONTHLY',
    "status" "ScheduleStatus" NOT NULL DEFAULT 'ACTIVE',
    "nextRunAt" TIMESTAMP(3) NOT NULL,
    "lastRunAt" TIMESTAMP(3),
    "failureCount" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "standing_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" "NotificationKind" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "link" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "standing_orders_userId_idx" ON "standing_orders"("userId");

-- CreateIndex
CREATE INDEX "standing_orders_status_nextRunAt_idx" ON "standing_orders"("status", "nextRunAt");

-- CreateIndex
CREATE INDEX "notifications_userId_readAt_idx" ON "notifications"("userId", "readAt");

-- CreateIndex
CREATE INDEX "notifications_userId_createdAt_idx" ON "notifications"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "standing_orders" ADD CONSTRAINT "standing_orders_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "standing_orders" ADD CONSTRAINT "standing_orders_sourceAccountId_fkey" FOREIGN KEY ("sourceAccountId") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
