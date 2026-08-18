-- CreateTable
CREATE TABLE "EventOccurrence" (
    "id" SERIAL NOT NULL,
    "eventId" INTEGER NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3),
    "isAllDay" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventOccurrence_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EventOccurrence_eventId_startsAt_idx" ON "EventOccurrence"("eventId", "startsAt");

-- CreateIndex
CREATE INDEX "EventOccurrence_eventId_endsAt_idx" ON "EventOccurrence"("eventId", "endsAt");

-- AddForeignKey
ALTER TABLE "EventOccurrence" ADD CONSTRAINT "EventOccurrence_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
