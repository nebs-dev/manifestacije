CREATE TYPE "EventRevisionStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

CREATE TABLE "EventRevision" (
  "id" SERIAL NOT NULL,
  "eventId" INTEGER NOT NULL,
  "organizerId" INTEGER NOT NULL,
  "submittedByUserId" INTEGER,
  "reviewedByUserId" INTEGER,
  "status" "EventRevisionStatus" NOT NULL DEFAULT 'PENDING',
  "version" INTEGER NOT NULL DEFAULT 1,
  "baseUpdatedAt" TIMESTAMP(3) NOT NULL,
  "baseFingerprint" TEXT NOT NULL,
  "original" JSONB NOT NULL,
  "proposed" JSONB NOT NULL,
  "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewedAt" TIMESTAMP(3),
  "rejectionReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EventRevision_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "EventRevision_version_positive" CHECK ("version" > 0),
  CONSTRAINT "EventRevision_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "EventRevision_organizerId_fkey" FOREIGN KEY ("organizerId") REFERENCES "Organizer"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "EventRevision_submittedByUserId_fkey" FOREIGN KEY ("submittedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "EventRevision_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "EventRevision_one_pending_per_event" ON "EventRevision"("eventId") WHERE "status" = 'PENDING';
CREATE INDEX "EventRevision_status_submittedAt_idx" ON "EventRevision"("status", "submittedAt");
CREATE INDEX "EventRevision_eventId_status_idx" ON "EventRevision"("eventId", "status");
CREATE INDEX "EventRevision_organizerId_idx" ON "EventRevision"("organizerId");
CREATE INDEX "EventRevision_submittedByUserId_idx" ON "EventRevision"("submittedByUserId");
CREATE INDEX "EventRevision_reviewedByUserId_idx" ON "EventRevision"("reviewedByUserId");
