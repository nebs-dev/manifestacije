-- CreateEnum
CREATE TYPE "MonitoredSourceType" AS ENUM ('LISTING_PAGE', 'EVENT_PAGE');

-- CreateEnum
CREATE TYPE "MonitoredSourceCheckStatus" AS ENUM ('OK', 'UNCHANGED', 'ERROR');

-- CreateEnum
CREATE TYPE "DiscoveredItemStatus" AS ENUM ('NEW', 'PROCESSED', 'UNCHANGED', 'GONE');

-- AlterEnum
ALTER TYPE "IngestionJobType" ADD VALUE 'SOURCE_CHECK';

-- CreateTable
CREATE TABLE "MonitoredSource" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "sourceType" "MonitoredSourceType" NOT NULL DEFAULT 'LISTING_PAGE',
    "organizerId" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "checkIntervalMinutes" INTEGER NOT NULL DEFAULT 720,
    "nextCheckAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastCheckedAt" TIMESTAMP(3),
    "lastSuccessAt" TIMESTAMP(3),
    "lastStatus" "MonitoredSourceCheckStatus",
    "lastHttpStatus" INTEGER,
    "etag" TEXT,
    "lastModified" TEXT,
    "contentHash" TEXT,
    "consecutiveFailures" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "checkingSince" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MonitoredSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiscoveredSourceItem" (
    "id" SERIAL NOT NULL,
    "monitoredSourceId" INTEGER NOT NULL,
    "normalizedUrl" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "contentHash" TEXT,
    "linkedEventSourceId" INTEGER,
    "status" "DiscoveredItemStatus" NOT NULL DEFAULT 'NEW',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DiscoveredSourceItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MonitoredSource_nextCheckAt_idx" ON "MonitoredSource"("nextCheckAt");

-- CreateIndex
CREATE INDEX "DiscoveredSourceItem_status_idx" ON "DiscoveredSourceItem"("status");

-- CreateIndex
CREATE UNIQUE INDEX "DiscoveredSourceItem_monitoredSourceId_normalizedUrl_key" ON "DiscoveredSourceItem"("monitoredSourceId", "normalizedUrl");

-- AddForeignKey
ALTER TABLE "MonitoredSource" ADD CONSTRAINT "MonitoredSource_organizerId_fkey" FOREIGN KEY ("organizerId") REFERENCES "Organizer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiscoveredSourceItem" ADD CONSTRAINT "DiscoveredSourceItem_monitoredSourceId_fkey" FOREIGN KEY ("monitoredSourceId") REFERENCES "MonitoredSource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiscoveredSourceItem" ADD CONSTRAINT "DiscoveredSourceItem_linkedEventSourceId_fkey" FOREIGN KEY ("linkedEventSourceId") REFERENCES "EventSource"("id") ON DELETE SET NULL ON UPDATE CASCADE;
