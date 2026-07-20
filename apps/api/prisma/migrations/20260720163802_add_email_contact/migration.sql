-- CreateEnum
CREATE TYPE "EmailContactSource" AS ENUM ('REGISTRATION', 'EVENT_SUBMISSION', 'SOURCE_SUBMISSION', 'PROFILE_CLAIM', 'EXISTING_ENGAGED_ORGANIZER_BACKFILL');

-- CreateEnum
CREATE TYPE "EmailContactSyncStatus" AS ENUM ('PENDING', 'SYNCED', 'FAILED', 'UNSUBSCRIBED');

-- CreateTable
CREATE TABLE "EmailContact" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "organizerId" INTEGER,
    "userId" INTEGER,
    "source" "EmailContactSource" NOT NULL,
    "resendContactId" TEXT,
    "syncStatus" "EmailContactSyncStatus" NOT NULL DEFAULT 'PENDING',
    "isUnsubscribed" BOOLEAN NOT NULL DEFAULT false,
    "unsubscribedAt" TIMESTAMP(3),
    "lastSyncedAt" TIMESTAMP(3),
    "syncError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailContact_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EmailContact_email_key" ON "EmailContact"("email");

-- CreateIndex
CREATE INDEX "EmailContact_organizerId_idx" ON "EmailContact"("organizerId");

-- CreateIndex
CREATE INDEX "EmailContact_userId_idx" ON "EmailContact"("userId");

-- CreateIndex
CREATE INDEX "EmailContact_syncStatus_idx" ON "EmailContact"("syncStatus");

-- AddForeignKey
ALTER TABLE "EmailContact" ADD CONSTRAINT "EmailContact_organizerId_fkey" FOREIGN KEY ("organizerId") REFERENCES "Organizer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailContact" ADD CONSTRAINT "EmailContact_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
