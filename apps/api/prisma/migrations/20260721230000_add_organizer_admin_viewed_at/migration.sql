ALTER TABLE "Organizer" ADD COLUMN "adminViewedAt" TIMESTAMP(3);

UPDATE "Organizer"
SET "adminViewedAt" = NOW()
WHERE status = 'UNCLAIMED';
