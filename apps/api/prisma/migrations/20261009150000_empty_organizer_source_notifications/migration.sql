-- Empty organizer submissions still need triage; empty monitored batches stay quiet.
CREATE OR REPLACE VIEW "ActiveAdminNotification" AS
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
  (n."kind" = 'source' AND jsonb_array_length(s."parsedJson"->'candidates') = 0) OR
  EXISTS (SELECT 1 FROM jsonb_array_elements(s."parsedJson"->'candidates') c
    WHERE COALESCE(c->>'_status', '') NOT IN ('created', 'ignored')
      AND (n."kind" <> 'discovery' OR c->>'_existingEventId' IS NULL))
  ELSE COALESCE(s."parsedJson"->>'_status', '') NOT IN ('created', 'ignored')
    AND (n."kind" <> 'discovery' OR s."parsedJson"->>'_existingEventId' IS NULL) END
UNION ALL
SELECT 'revision:' || r."id" || ':' || r."version", 'revision', r."id", r."submittedAt", e."title",
  '/admin/event-revisions/' || r."id", true
FROM "EventRevision" r JOIN "Event" e ON e."id" = r."eventId" WHERE r."status" = 'PENDING';
