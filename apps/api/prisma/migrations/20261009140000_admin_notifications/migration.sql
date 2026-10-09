-- Additive migration: old shared viewed timestamps are retained for older clients.
CREATE TABLE "AdminNotification" (
  "id" SERIAL PRIMARY KEY, "kind" TEXT NOT NULL, "entityId" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "AdminNotification_kind_entityId_key" ON "AdminNotification"("kind", "entityId");
CREATE INDEX "AdminNotification_createdAt_id_idx" ON "AdminNotification"("createdAt", "id");
CREATE TABLE "AdminNotificationRead" (
  "userId" INTEGER NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "key" TEXT NOT NULL, "readAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("userId", "key")
);

-- Capture only creation, atomically with the underlying operation. Updates,
-- admin event imports and status toggles never create notices. New monitored
-- discoveries are captured here and filtered for outstanding candidates below.
CREATE FUNCTION capture_admin_notification() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_TABLE_NAME = 'User' THEN
    IF NEW."role" = 'ORGANIZER' AND NEW."organizerId" IS NOT NULL THEN
      INSERT INTO "AdminNotification" ("kind", "entityId", "createdAt")
      VALUES ('organizer', NEW."organizerId", NEW."createdAt") ON CONFLICT DO NOTHING;
    END IF;
  ELSIF TG_TABLE_NAME = 'Event' THEN
    IF NEW."sourceType" = 'ORGANIZER_FORM' AND NEW."status" IN ('PENDING_REVIEW', 'PUBLISHED')
      AND EXISTS (SELECT 1 FROM "User" u WHERE u."id" = NEW."createdByUserId" AND u."role" = 'ORGANIZER' AND u."organizerId" = NEW."organizerId") THEN
      INSERT INTO "AdminNotification" ("kind", "entityId", "createdAt")
      VALUES (CASE WHEN NEW."status" = 'PUBLISHED' THEN 'autoPublished' ELSE 'submission' END, NEW."id", NEW."createdAt")
      ON CONFLICT DO NOTHING;
    END IF;
  ELSIF TG_TABLE_NAME = 'EventSource' THEN
    IF NEW."type" = 'SCRAPE_DISCOVERY' OR NEW."organizerId" IS NOT NULL THEN
      INSERT INTO "AdminNotification" ("kind", "entityId", "createdAt")
      VALUES (CASE WHEN NEW."type" = 'SCRAPE_DISCOVERY' THEN 'discovery' ELSE 'source' END, NEW."id", NEW."createdAt")
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER admin_notification_user AFTER INSERT ON "User" FOR EACH ROW EXECUTE FUNCTION capture_admin_notification();
CREATE TRIGGER admin_notification_event AFTER INSERT ON "Event" FOR EACH ROW EXECUTE FUNCTION capture_admin_notification();
CREATE TRIGGER admin_notification_source AFTER INSERT ON "EventSource" FOR EACH ROW EXECUTE FUNCTION capture_admin_notification();

-- Seed existing actionable records. Do not guess which historical publications
-- were automatic, and do not copy another admin's shared legacy read state.
INSERT INTO "AdminNotification" ("kind", "entityId", "createdAt")
SELECT 'organizer', "organizerId", MIN("createdAt") FROM "User"
WHERE "role" = 'ORGANIZER' AND "organizerId" IS NOT NULL GROUP BY "organizerId" ON CONFLICT DO NOTHING;
INSERT INTO "AdminNotification" ("kind", "entityId", "createdAt")
SELECT 'submission', "id", "createdAt" FROM "Event" WHERE "sourceType" = 'ORGANIZER_FORM' AND "status" = 'PENDING_REVIEW' ON CONFLICT DO NOTHING;
INSERT INTO "AdminNotification" ("kind", "entityId", "createdAt")
SELECT CASE WHEN "type" = 'SCRAPE_DISCOVERY' THEN 'discovery' ELSE 'source' END, "id", "createdAt"
FROM "EventSource" WHERE "type" = 'SCRAPE_DISCOVERY' OR "organizerId" IS NOT NULL ON CONFLICT DO NOTHING;

-- Revisions reuse the existing pending queue. Versioned keys make a replacement
-- proposal unread without ever creating a second revision notification.
CREATE VIEW "ActiveAdminNotification" AS
SELECT 'notice:' || n."id" AS "key", n."kind", n."entityId", n."createdAt", o."name" AS "title",
  '/admin/organizers?organizerId=' || o."id" AS "href", false AS "requiresAction"
FROM "AdminNotification" n JOIN "Organizer" o ON o."id" = n."entityId"
WHERE n."kind" = 'organizer' AND EXISTS (SELECT 1 FROM "User" u WHERE u."organizerId" = o."id" AND u."role" = 'ORGANIZER')
UNION ALL
SELECT 'notice:' || n."id", n."kind", n."entityId", n."createdAt", e."title", '/admin/events/' || e."id", n."kind" = 'submission'
FROM "AdminNotification" n JOIN "Event" e ON e."id" = n."entityId"
WHERE (n."kind" = 'submission' AND e."status" = 'PENDING_REVIEW') OR (n."kind" = 'autoPublished' AND e."status" = 'PUBLISHED')
UNION ALL
SELECT 'notice:' || n."id", n."kind", n."entityId", n."createdAt",
  COALESCE(s."parsedJson"->'candidates'->0->>'title', s."rawEmailSubject", s."sourceUrl", 'Zaprimljeni sadržaj'),
  '/admin/sources/' || s."id", true
FROM "AdminNotification" n JOIN "EventSource" s ON s."id" = n."entityId"
WHERE n."kind" IN ('source', 'discovery') AND s."eventId" IS NULL AND s."status" IN ('NEW', 'PARSED', 'NEEDS_REVIEW')
AND CASE WHEN jsonb_typeof(s."parsedJson"->'candidates') = 'array' THEN
  EXISTS (SELECT 1 FROM jsonb_array_elements(s."parsedJson"->'candidates') c
    WHERE COALESCE(c->>'_status', '') NOT IN ('created', 'ignored')
      AND (n."kind" <> 'discovery' OR c->>'_existingEventId' IS NULL))
  ELSE COALESCE(s."parsedJson"->>'_status', '') NOT IN ('created', 'ignored')
    AND (n."kind" <> 'discovery' OR s."parsedJson"->>'_existingEventId' IS NULL) END
UNION ALL
SELECT 'revision:' || r."id" || ':' || r."version", 'revision', r."id", r."submittedAt", e."title",
  '/admin/event-revisions/' || r."id", true
FROM "EventRevision" r JOIN "Event" e ON e."id" = r."eventId" WHERE r."status" = 'PENDING';
