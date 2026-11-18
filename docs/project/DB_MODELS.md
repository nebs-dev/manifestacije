# DB Models

| Model | Fields | Confidence | Evidence |
| --- | --- | --- | --- |
| User | `id`, `email`, `passwordHash`, `name`, `role`, `organizerId`, `organizer`, `authVersion`, `passwordResetTokens`, `emailContacts`, `createdAt`, `updatedAt` | ▮▮▮ High | `apps/api/prisma/schema.prisma` |
| PasswordResetToken | `id`, `userId`, `tokenHash`, `expiresAt`, `usedAt`, `createdAt`, `user` | ▮▮▮ High | `apps/api/prisma/schema.prisma` |
| Organizer | `id`, `name`, `slug`, `description`, `websiteUrl`, `facebookUrl`, `instagramUrl`, `email`, `phone`, `status`, `users`, `events`, `sources`, `monitoredSources`, `emailContacts`, `claims`, `adminViewedAt`, `createdAt`, `updatedAt` | ▮▮▮ High | `apps/api/prisma/schema.prisma` |
| OrganizerClaim | `id`, `organizerId`, `email`, `tokenHash`, `status`, `expiresAt`, `approvedAt`, `rejectedAt`, `completedAt`, `internalReason`, `createdAt`, `updatedAt`, `organizer` | ▮▮▮ High | `apps/api/prisma/schema.prisma` |
| EmailContact | `id`, `email`, `organizerId`, `userId`, `source`, `resendContactId`, `syncStatus`, `isUnsubscribed`, `unsubscribedAt`, `lastSyncedAt`, `syncError`, `createdAt`, `updatedAt`, `organizer`, `user` | ▮▮▮ High | `apps/api/prisma/schema.prisma` |
| Region | `id`, `name`, `slug`, `sortOrder`, `counties`, `events` | ▮▮▮ High | `apps/api/prisma/schema.prisma` |
| County | `id`, `name`, `slug`, `regionId`, `region`, `cities`, `events` | ▮▮▮ High | `apps/api/prisma/schema.prisma` |
| City | `id`, `name`, `slug`, `countyId`, `county`, `lat`, `lng`, `venues`, `events` | ▮▮▮ High | `apps/api/prisma/schema.prisma` |
| Venue | `id`, `name`, `slug`, `address`, `cityId`, `city`, `lat`, `lng`, `source`, `events`, `createdAt`, `updatedAt` | ▮▮▮ High | `apps/api/prisma/schema.prisma` |
| Category | `id`, `name`, `slug`, `parentId`, `parent`, `children`, `sortOrder`, `events`, `eventCats` | ▮▮▮ High | `apps/api/prisma/schema.prisma` |
| EventCategory | `eventId`, `categoryId`, `source`, `confidence`, `createdAt`, `event`, `category` | ▮▮▮ High | `apps/api/prisma/schema.prisma` |
| Partner | `id`, `name`, `logoUrl`, `websiteUrl`, `sortOrder`, `isActive`, `createdAt`, `updatedAt` | ▮▮▮ High | `apps/api/prisma/schema.prisma` |
| Event | `id`, `title`, `slug`, `description`, `status`, `organizerId`, `organizer`, `venueId`, `venue`, `cityName`, `cityId`, `city`, `countyId`, `county`, `regionId`, `region`, `categoryId`, `category`, `categories`, `occurrences`, `startsAt`, `endsAt`, `isAllDay`, `isFree`, `priceText`, `ticketUrl`, `sourceUrl`, `imageUrl`, `address`, `lat`, `lng`, `sourceType`, `extractionConfidence`, `isFeatured`, `publishedAt`, `sources`, `duplicatesA`, `duplicatesB`, `createdAt`, `updatedAt` | ▮▮▮ High | `apps/api/prisma/schema.prisma` |
| EventOccurrence | `id`, `eventId`, `event`, `startsAt`, `endsAt`, `isAllDay`, `createdAt`, `updatedAt` | ▮▮▮ High | `apps/api/prisma/schema.prisma` |
| EventSource | `id`, `eventId`, `event`, `organizerId`, `organizer`, `type`, `sourceUrl`, `rawText`, `rawHtml`, `rawEmailSubject`, `rawEmailFrom`, `rawEmailDate`, `parsedJson`, `confidence`, `status`, `adminViewedAt`, `discoveredItems`, `createdAt`, `updatedAt` | ▮▮▮ High | `apps/api/prisma/schema.prisma` |
| MonitoredSource | `id`, `name`, `url`, `sourceType`, `organizerId`, `organizer`, `isActive`, `checkIntervalMinutes`, `nextCheckAt`, `lastCheckedAt`, `lastSuccessAt`, `lastStatus`, `lastHttpStatus`, `etag`, `lastModified`, `contentHash`, `consecutiveFailures`, `lastError`, `checkingSince`, `discoveredItems`, `createdAt`, `updatedAt` | ▮▮▮ High | `apps/api/prisma/schema.prisma` |
| DiscoveredSourceItem | `id`, `monitoredSourceId`, `monitoredSource`, `normalizedUrl`, `sourceUrl`, `firstSeenAt`, `lastSeenAt`, `contentHash`, `parsedDetail`, `linkedEventSourceId`, `linkedEventSource`, `status`, `createdAt`, `updatedAt` | ▮▮▮ High | `apps/api/prisma/schema.prisma` |
| EventDuplicateCandidate | `id`, `eventAId`, `eventA`, `eventBId`, `eventB`, `score`, `reason`, `status`, `createdAt`, `updatedAt` | ▮▮▮ High | `apps/api/prisma/schema.prisma` |
| IngestionJob | `id`, `type`, `status`, `payload`, `result`, `error`, `createdAt`, `updatedAt` | ▮▮▮ High | `apps/api/prisma/schema.prisma` |
