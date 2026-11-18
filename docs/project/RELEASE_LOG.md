# Release Log

Local git commit/merge timeline inferred from repository history.

Kiroq can infer commits and merge commits from local git. Remote push/release boundaries are Unknown unless a future integration records them.

## 2026-08-21 09:01 - commit b2c0644e

Page the homepage category strip 3 rows at a time instead of showing all 24

- Changed files: 1
- Changed areas: Unclassified
- Affected features: Unknown
- Review focus: Public routes

Evidence files:

- `apps/web/src/components/public/category-strip.tsx`

## 2026-08-21 08:54 - commit c0254888

Show all real categories in the homepage genre strip, not a curated 8

- Changed files: 1
- Changed areas: Unclassified
- Affected features: Unknown
- Review focus: None detected

Evidence files:

- `apps/web/src/lib/data.ts`

## 2026-08-21 07:49 - commit b371e912

Add a per-row duplicate button to the event schedule editor

- Changed files: 3
- Changed areas: Verification / Tests
- Affected features: Unknown
- Review focus: None detected

Evidence files:

- `apps/web/src/components/event-schedule-editor.test.ts`
- `apps/web/src/components/event-schedule-editor.tsx`
- `apps/web/src/lib/schedule-editor-model.ts`

## 2026-08-20 09:01 - commit 5aee6904

Crop event hero from the uncropped source, anchored top, instead of a pre-cropped 4:3

- Changed files: 3
- Changed areas: Unclassified
- Affected features: Unknown
- Review focus: Public routes

Evidence files:

- `apps/web/app/eventi/[eventSlug]/page.tsx`
- `apps/web/src/components/admin/event-image-picker.tsx`
- `apps/web/src/components/public/event-poster.tsx`

## 2026-08-20 08:46 - commit c3a51c7e

Show full poster on event detail hero instead of center-cropping it

- Changed files: 2
- Changed areas: Unclassified
- Affected features: Unknown
- Review focus: Public routes

Evidence files:

- `apps/web/app/eventi/[eventSlug]/page.tsx`
- `apps/web/src/components/public/event-poster.tsx`

## 2026-08-20 08:28 - commit 37962949

perf: reduce public route server CPU

- Changed files: 5
- Changed areas: Env / Config, Verification / Tests
- Affected features: Unknown
- Review focus: Public routes, Env / Config

Evidence files:

- `apps/api/src/public-feed/public-feed.service.ts`
- `apps/api/test/public-feed.service.spec.ts`
- `apps/web/next.config.js`
- `apps/web/src/lib/public-api.test.ts`
- `apps/web/src/lib/public-api.ts`

## 2026-08-20 08:04 - commit 5965d4d9

fix: show full calendar event titles on mobile

- Changed files: 1
- Changed areas: Unclassified
- Affected features: Unknown
- Review focus: Public routes

Evidence files:

- `apps/web/src/components/public/calendar-explorer.tsx`

## 2026-08-18 11:28 - commit 4ec7264d

fix: move calendar teaser above featured events

- Changed files: 1
- Changed areas: Unclassified
- Affected features: Unknown
- Review focus: None detected

Evidence files:

- `apps/web/app/page.tsx`

## 2026-08-18 09:26 - commit 6efd0115

feat: add event schedules and calendar discovery

- Changed files: 52
- Changed areas: Database / Schema, Verification / Tests
- Affected features: Locations, AI/Crawler Discovery Surface
- Review focus: Public routes, Database / Prisma

Evidence files:

- `apps/api/prisma/migrations/20260813120000_add_event_occurrences/migration.sql`
- `apps/api/prisma/schema.prisma`
- `apps/api/src/admin/admin.dto.ts`
- `apps/api/src/admin/admin.service.ts`
- `apps/api/src/ai-parser/ai-event-parser.service.ts`
- `apps/api/src/ai-parser/candidate-filters.ts`
- `apps/api/src/common/weekend.ts`
- `apps/api/src/events/event.dto.ts`

## 2026-08-13 12:11 - commit d9af9dda

Filter past and already-imported candidates on manual URL parse, not just monitored-source checks

- Changed files: 4
- Changed areas: Unclassified
- Affected features: Unknown
- Review focus: None detected

Evidence files:

- `apps/api/src/admin/admin.service.ts`
- `apps/api/src/ai-parser/candidate-filters.ts`
- `apps/api/src/monitored-sources/monitored-sources.service.ts`
- `apps/api/src/organizers/organizer.service.ts`

## 2026-08-13 11:27 - commit 24b0960d

Extract event dates from schema.org JSON-LD before falling back to LLM parsing

- Changed files: 4
- Changed areas: Unclassified
- Affected features: Unknown
- Review focus: None detected

Evidence files:

- `apps/api/src/admin/admin.service.ts`
- `apps/api/src/ai-parser/ai-event-parser.service.ts`
- `apps/api/src/monitored-sources/monitored-sources.service.ts`
- `apps/api/src/organizers/organizer.service.ts`

## 2026-08-12 16:07 - commit f251bc1f

Fix admin Select dropdowns showing raw value instead of label before first open

- Changed files: 1
- Changed areas: Unclassified
- Affected features: Unknown
- Review focus: None detected

Evidence files:

- `apps/web/src/components/admin/events-table.tsx`

## 2026-08-12 15:58 - commit fda07582

Bring pending events admin page to feature parity with events page, default sort to newest added

- Changed files: 6
- Changed areas: Unclassified
- Affected features: Unknown
- Review focus: None detected

Evidence files:

- `apps/api/src/admin/admin.service.ts`
- `apps/web/app/admin/events/page.tsx`
- `apps/web/app/admin/events/pending/page.tsx`
- `apps/web/src/components/admin/admin-topbar.tsx`
- `apps/web/src/components/admin/events-table.tsx`
- `apps/web/src/components/admin/pending-events-table.tsx`

## 2026-08-12 15:09 - commit 4d68e577

Fix admin notification subject hardcoding 'event' for profile claim requests

- Changed files: 3
- Changed areas: Unclassified
- Affected features: Unknown
- Review focus: None detected

Evidence files:

- `apps/api/src/email/templates/admin-new-submission.template.ts`
- `apps/api/src/organizer-claims/organizer-claim.service.ts`
- `apps/api/src/organizers/organizer.service.ts`

## 2026-08-07 14:28 - commit 2ef4b8ab

Add a way to split an existing all-day event into a weekly series

- Changed files: 5
- Changed areas: Verification / Tests
- Affected features: Data Imports
- Review focus: None detected

Evidence files:

- `apps/api/src/admin/admin.controller.ts`
- `apps/api/src/admin/admin.dto.ts`
- `apps/api/src/admin/admin.service.ts`
- `apps/api/test/monitored-sources.spec.ts`
- `apps/web/src/components/admin/event-edit-form.tsx`

## 2026-08-07 14:09 - commit 3e70d2ad

Fix the homepage category strip filtering against a slug that never existed

- Changed files: 1
- Changed areas: Unclassified
- Affected features: Unknown
- Review focus: None detected

Evidence files:

- `apps/web/src/lib/data.ts`

## 2026-08-07 14:00 - commit b53831bd

Fix a dead category slug and add weekly event repetition

- Changed files: 6
- Changed areas: Verification / Tests
- Affected features: Unknown
- Review focus: None detected

Evidence files:

- `apps/api/src/admin/admin.dto.ts`
- `apps/api/src/admin/admin.service.ts`
- `apps/api/src/ai-parser/ai-event-parser.service.ts`
- `apps/api/test/ai-parser.spec.ts`
- `apps/api/test/monitored-sources.spec.ts`
- `apps/web/src/components/admin/event-create-form.tsx`

## 2026-07-30 07:44 - commit bd624422

Warn when a discovered candidate is already in the events table

- Changed files: 7
- Changed areas: Verification / Tests
- Affected features: Unknown
- Review focus: None detected

Evidence files:

- `apps/api/src/ai-parser/ai-event-parser.service.ts`
- `apps/api/src/duplicates/duplicates.service.ts`
- `apps/api/src/monitored-sources/monitored-sources.service.ts`
- `apps/api/test/monitored-sources.spec.ts`
- `apps/web/src/components/admin/parsed-candidate-card.tsx`
- `apps/web/src/lib/admin/adapters.ts`
- `apps/web/src/lib/admin/types.ts`

## 2026-07-30 07:23 - commit 963efa8b

Paginate the admin event sources list

- Changed files: 5
- Changed areas: Unclassified
- Affected features: Data Imports
- Review focus: None detected

Evidence files:

- `apps/api/src/admin/admin.controller.ts`
- `apps/api/src/admin/admin.service.ts`
- `apps/web/app/admin/page.tsx`
- `apps/web/app/admin/sources/page.tsx`
- `apps/web/src/components/admin/source-table.tsx`

## 2026-07-28 21:48 - commit fbf1e799

Stop re-parsing unchanged detail pages on every source check

- Changed files: 4
- Changed areas: Database / Schema
- Affected features: Locations, AI/Crawler Discovery Surface
- Review focus: Database / Prisma

Evidence files:

- `apps/api/prisma/migrations/20260728214409_discovered_item_parsed_detail/migration.sql`
- `apps/api/prisma/schema.prisma`
- `apps/api/src/ai-parser/ai-event-parser.service.ts`
- `apps/api/src/monitored-sources/monitored-sources.service.ts`

## Kiroq Scan Audit Trail

- 2026-08-25T10:55:45.479Z: update; git 7e566a77..b2c0644e; docs 0; test not executed
- 2026-07-21T22:28:56.336Z: baseline; git 7e566a77; docs 16; test not executed
