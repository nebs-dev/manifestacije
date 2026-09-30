-- AlterTable
ALTER TABLE "Event" ADD COLUMN "createdByUserId" INTEGER;

-- CreateIndex
CREATE INDEX "Event_createdByUserId_createdAt_idx" ON "Event"("createdByUserId", "createdAt");

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
