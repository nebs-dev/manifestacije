-- Per-event identity for the Sources workflow.
--
-- Before this, a re-check of a listing page re-queued every event on it: the
-- only dedup key was a hash of the whole page. Production held 3 179 candidate
-- cards for 748 distinct events.

-- Provenance for a review row, nulled rather than cascaded so a deleted
-- monitored source no longer makes its queue rows anonymous.
ALTER TABLE "EventSource" ADD COLUMN "monitoredSourceId" INTEGER;
ALTER TABLE "EventSource"
  ADD CONSTRAINT "EventSource_monitoredSourceId_fkey"
  FOREIGN KEY ("monitoredSourceId") REFERENCES "MonitoredSource"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "EventSource_type_createdAt_idx" ON "EventSource"("type", "createdAt");

CREATE TABLE "DiscoveredEvent" (
  "id" SERIAL PRIMARY KEY,
  "identityKey" TEXT NOT NULL,
  "sourceScope" TEXT NOT NULL,
  "monitoredSourceId" INTEGER,
  "contentHash" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "titleKey" TEXT NOT NULL DEFAULT '',
  "startsAt" TIMESTAMP(3),
  "cityName" TEXT,
  "detailUrl" TEXT,
  "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "timesSeen" INTEGER NOT NULL DEFAULT 1,
  "timesQueued" INTEGER NOT NULL DEFAULT 1,
  "lastEventSourceId" INTEGER,
  "importedEventId" INTEGER,
  "ignoredAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX "DiscoveredEvent_identityKey_key" ON "DiscoveredEvent"("identityKey");
CREATE INDEX "DiscoveredEvent_sourceScope_lastSeenAt_idx" ON "DiscoveredEvent"("sourceScope", "lastSeenAt");
CREATE INDEX "DiscoveredEvent_sourceScope_titleKey_idx" ON "DiscoveredEvent"("sourceScope", "titleKey");
CREATE INDEX "DiscoveredEvent_monitoredSourceId_idx" ON "DiscoveredEvent"("monitoredSourceId");
CREATE INDEX "DiscoveredEvent_importedEventId_idx" ON "DiscoveredEvent"("importedEventId");

-- Every reference is SET NULL: the record of what was discovered, and of the
-- decision taken on it, must outlive the source, the review row and the event.
ALTER TABLE "DiscoveredEvent"
  ADD CONSTRAINT "DiscoveredEvent_monitoredSourceId_fkey"
  FOREIGN KEY ("monitoredSourceId") REFERENCES "MonitoredSource"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DiscoveredEvent"
  ADD CONSTRAINT "DiscoveredEvent_lastEventSourceId_fkey"
  FOREIGN KEY ("lastEventSourceId") REFERENCES "EventSource"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DiscoveredEvent"
  ADD CONSTRAINT "DiscoveredEvent_importedEventId_fkey"
  FOREIGN KEY ("importedEventId") REFERENCES "Event"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
