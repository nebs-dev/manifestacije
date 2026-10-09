CREATE TABLE "EmailDelivery" (
 "id" TEXT PRIMARY KEY, "template" TEXT NOT NULL, "provider" TEXT NOT NULL,
 "userId" INTEGER, "messageId" TEXT, "status" TEXT NOT NULL DEFAULT 'submitting',
 "statusRank" INTEGER NOT NULL DEFAULT 0, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updatedAt" TIMESTAMP(3) NOT NULL, "acceptedAt" TIMESTAMP(3), "lastEventAt" TIMESTAMP(3)
);
CREATE UNIQUE INDEX "EmailDelivery_messageId_key" ON "EmailDelivery"("messageId");
CREATE INDEX "EmailDelivery_userId_createdAt_idx" ON "EmailDelivery"("userId", "createdAt");
CREATE INDEX "EmailDelivery_template_createdAt_idx" ON "EmailDelivery"("template", "createdAt");
CREATE TABLE "EmailDeliveryEvent" (
 "id" TEXT PRIMARY KEY, "messageId" TEXT NOT NULL, "type" TEXT NOT NULL, "statusRank" INTEGER NOT NULL,
 "occurredAt" TIMESTAMP(3) NOT NULL, "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "EmailDeliveryEvent_messageId_statusRank_occurredAt_idx" ON "EmailDeliveryEvent"("messageId", "statusRank", "occurredAt");
