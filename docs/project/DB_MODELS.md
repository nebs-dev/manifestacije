# DB Models

| Model | Fields | Confidence | Evidence |
| --- | --- | --- | --- |
| User | `id`, `email`, `passwordHash`, `name`, `role`, `organizerId`, `organizer`, `createdAt`, `updatedAt` | High | `apps/api/prisma/schema.prisma` |
| Organizer | `id`, `name`, `slug`, `description`, `websiteUrl`, `facebookUrl`, `instagramUrl`, `email`, `phone`, `status`, `users`, `events`, `sources`, `createdAt`, `updatedAt` | High | `apps/api/prisma/schema.prisma` |
| Region | `id`, `name`, `slug`, `sortOrder`, `counties`, `events` | High | `apps/api/prisma/schema.prisma` |
| County | `id`, `name`, `slug`, `regionId`, `region`, `cities`, `events` | High | `apps/api/prisma/schema.prisma` |
| City | `id`, `name`, `slug`, `countyId`, `county`, `lat`, `lng`, `venues`, `events` | High | `apps/api/prisma/schema.prisma` |
| Venue | `id`, `name`, `slug`, `address`, `cityId`, `city`, `lat`, `lng`, `source`, `events`, `createdAt`, `updatedAt` | High | `apps/api/prisma/schema.prisma` |
| Category | `id`, `name`, `slug`, `parentId`, `parent`, `children`, `sortOrder`, `events` | High | `apps/api/prisma/schema.prisma` |
| Event | `id`, `title`, `slug`, `description`, `shortDescription`, `status`, `organizerId`, `organizer`, `venueId`, `venue`, `cityId`, `city`, `countyId`, `county`, `regionId`, `region`, `categoryId`, `category`, `startsAt`, `endsAt`, `isAllDay`, `isFree`, `priceText`, `ticketUrl`, `sourceUrl`, `imageUrl`, `sourceType`, `extractionConfidence`, `publishedAt`, `sources`, `duplicatesA`, `duplicatesB`, `createdAt`, `updatedAt` | High | `apps/api/prisma/schema.prisma` |
| EventSource | `id`, `eventId`, `event`, `organizerId`, `organizer`, `type`, `sourceUrl`, `rawText`, `rawHtml`, `rawEmailSubject`, `rawEmailFrom`, `rawEmailDate`, `parsedJson`, `confidence`, `status`, `createdAt`, `updatedAt` | High | `apps/api/prisma/schema.prisma` |
| EventDuplicateCandidate | `id`, `eventAId`, `eventA`, `eventBId`, `eventB`, `score`, `reason`, `status`, `createdAt`, `updatedAt` | High | `apps/api/prisma/schema.prisma` |
| IngestionJob | `id`, `type`, `status`, `payload`, `result`, `error`, `createdAt`, `updatedAt` | High | `apps/api/prisma/schema.prisma` |
