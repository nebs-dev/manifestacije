-- Entry statistics ask two questions the data could not answer: who published
-- an event, and how many events were deleted.
--
-- Publishing was recorded as a timestamp with no author, so "tko je objavio"
-- had no answer at all. `publishedByUserId` is filled from now on; rows
-- published before this migration keep NULL and are reported as unknown
-- rather than guessed at.
ALTER TABLE "Event" ADD COLUMN "publishedByUserId" INTEGER;

ALTER TABLE "Event" ADD CONSTRAINT "Event_publishedByUserId_fkey"
  FOREIGN KEY ("publishedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Event_publishedByUserId_idx" ON "Event"("publishedByUserId");

-- Deletion stays a real delete. A soft-deleted event would have to be
-- filtered out of every query and every relation include that reaches the
-- public site, and a single missed path would put a deleted event back in
-- front of visitors. This table records the deletion instead: enough to count
-- and attribute it, deliberately not enough to restore the event.
--
-- Deletions that happened before this migration are not here and cannot be:
-- the rows are gone. The statistics page says so rather than showing zero.
CREATE TABLE "EventDeletion" (
  "id" SERIAL NOT NULL,
  "eventId" INTEGER NOT NULL,
  "title" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "startsAt" TIMESTAMP(3) NOT NULL,
  "cityName" TEXT,
  "status" "EventStatus" NOT NULL,
  "eventCreatedAt" TIMESTAMP(3) NOT NULL,
  "createdByUserId" INTEGER,
  "deletedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deletedByUserId" INTEGER,

  CONSTRAINT "EventDeletion_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "EventDeletion_deletedAt_idx" ON "EventDeletion"("deletedAt");
CREATE INDEX "EventDeletion_deletedByUserId_idx" ON "EventDeletion"("deletedByUserId");
CREATE INDEX "EventDeletion_eventId_idx" ON "EventDeletion"("eventId");

-- The author of the deletion may later be removed as a user; the record of
-- the deletion itself must survive that.
ALTER TABLE "EventDeletion" ADD CONSTRAINT "EventDeletion_deletedByUserId_fkey"
  FOREIGN KEY ("deletedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
