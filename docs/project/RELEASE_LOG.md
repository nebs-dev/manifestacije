# Release Log

Local git commit/merge timeline inferred from repository history.

Kiroq can infer commits and merge commits from local git. Remote push/release boundaries are Unknown unless a future integration records them.

## 2026-07-10 07:23 - commit 14cac98c

CLOUDINARY_UPLOAD_FOLDER=manifestacije/events

- Changed files: 1
- Changed areas: Unclassified
- Affected features: Unknown
- Review focus: None detected

Evidence files:

- `apps/web/src/components/admin/events-table.tsx`

## 2026-07-07 07:32 - commit 714f2d00

fix: hide time on all-day events, fix timezone to Europe/Zagreb

- Changed files: 3
- Changed areas: Unclassified
- Affected features: Unknown
- Review focus: Public routes

Evidence files:

- `apps/web/src/components/public/calendar-explorer.tsx`
- `apps/web/src/components/public/event-card.tsx`
- `apps/web/src/lib/public-api.ts`

## 2026-07-06 14:48 - commit 0a4c4e0e

feat: admin reset organizer password + fix CORS PATCH + dashboard table truncation

- Changed files: 19
- Changed areas: Unclassified
- Affected features: Data Imports
- Review focus: Public routes

Evidence files:

- `apps/api/src/admin/admin.controller.ts`
- `apps/api/src/admin/admin.dto.ts`
- `apps/api/src/admin/admin.module.ts`
- `apps/api/src/admin/admin.service.ts`
- `apps/api/src/admin/revalidate.service.ts`
- `apps/api/src/app.module.ts`
- `apps/api/src/main.ts`
- `apps/web/app/admin/organizers/page.tsx`

## 2026-07-06 09:31 - commit d853bd3d

hero title, featured events

- Changed files: 14
- Changed areas: Database / Schema
- Affected features: Locations
- Review focus: Public routes, Database / Prisma

Evidence files:

- `apps/api/prisma/migrations/20260706092752_add_is_featured/migration.sql`
- `apps/api/prisma/schema.prisma`
- `apps/api/src/admin/admin.dto.ts`
- `apps/api/src/admin/admin.service.ts`
- `apps/api/src/events/event.dto.ts`
- `apps/api/src/events/events.service.ts`
- `apps/web/app/organizer/register/page.tsx`
- `apps/web/app/organizer/submit-link/page.tsx`

## 2026-07-06 09:19 - commit 8a5d0f74

remove regions

- Changed files: 6
- Changed areas: Unclassified
- Affected features: Unknown
- Review focus: Public routes

Evidence files:

- `apps/web/app/eventi/page.tsx`
- `apps/web/app/page.tsx`
- `apps/web/src/components/public/event-filters.tsx`
- `apps/web/src/components/public/filters-panel.tsx`
- `apps/web/src/components/public/site-footer.tsx`
- `apps/web/src/components/public/site-header.tsx`

## 2026-07-06 08:57 - commit b1b21e5f

fix BE build

- Changed files: 1
- Changed areas: Unclassified
- Affected features: Unknown
- Review focus: Public routes

Evidence files:

- `apps/api/src/public-feed/public-feed.service.ts`

## 2026-07-06 08:50 - commit d88f48e2

feat: remove isPrimary, bulk category edit, organizer on sources, date fix

- Changed files: 17
- Changed areas: Database / Schema
- Affected features: Data Imports, Locations
- Review focus: Public routes, Database / Prisma

Evidence files:

- `apps/api/prisma/migrations/20260706120000_remove_is_primary/migration.sql`
- `apps/api/prisma/schema.prisma`
- `apps/api/src/admin/admin.controller.ts`
- `apps/api/src/admin/admin.service.ts`
- `apps/api/src/events/events.service.ts`
- `apps/api/src/public-feed/public-feed.service.ts`
- `apps/web/app/admin/sources/page.tsx`
- `apps/web/src/components/admin/admin-topbar.tsx`

## 2026-07-03 18:51 - commit b95c648a

notifications

- Changed files: 3
- Changed areas: Unclassified
- Affected features: Data Imports
- Review focus: None detected

Evidence files:

- `apps/api/src/admin/admin.controller.ts`
- `apps/api/src/admin/admin.service.ts`
- `apps/web/src/components/admin/admin-topbar.tsx`

## 2026-07-03 18:46 - commit ed10974c

feat: organizer portal improvements + listing page crawler

- Changed files: 32
- Changed areas: Database / Schema, Verification / Tests
- Affected features: Data Imports, Locations
- Review focus: Public routes, Database / Prisma

Evidence files:

- `apps/api/prisma/migrations/20260703180000_remove_short_description_image_alt/migration.sql`
- `apps/api/prisma/schema.prisma`
- `apps/api/src/admin/admin.dto.ts`
- `apps/api/src/admin/admin.service.ts`
- `apps/api/src/ai-parser/ai-event-parser.service.ts`
- `apps/api/src/events/event.dto.ts`
- `apps/api/src/events/events.service.ts`
- `apps/api/src/organizers/organizer.controller.ts`

## 2026-07-03 17:18 - commit ed7e8967

feat: cityName from location, remove city dropdown & image metadata fields

- Changed files: 27
- Changed areas: Database / Schema, Verification / Tests
- Affected features: Locations, AI/Crawler Discovery Surface
- Review focus: Public routes, Database / Prisma

Evidence files:

- `apps/api/prisma/migrations/20260703165730_add_cityname_nullable_city/migration.sql`
- `apps/api/prisma/migrations/20260703170557_remove_image_credit_source_url/migration.sql`
- `apps/api/prisma/migrations/migration_lock.toml`
- `apps/api/prisma/schema.prisma`
- `apps/api/src/admin/admin.service.ts`
- `apps/api/src/events/event.dto.ts`
- `apps/api/src/events/events.service.ts`
- `apps/api/src/public-feed/public-feed.service.ts`

## 2026-07-02 16:48 - commit 3feb3945

feat: require text or screenshot for Facebook event submissions

- Changed files: 14
- Changed areas: Verification / Tests
- Affected features: Data Imports
- Review focus: None detected

Evidence files:

- `apps/api/src/admin/admin.service.ts`
- `apps/api/src/ai-parser/ai-event-parser.service.ts`
- `apps/api/src/organizers/organizer.controller.ts`
- `apps/api/src/organizers/organizer.dto.ts`
- `apps/api/src/organizers/organizer.service.ts`
- `apps/api/test/organizer.service.spec.ts`
- `apps/web/app/organizer/events/[id]/page.tsx`
- `apps/web/app/organizer/submit-link/page.tsx`

## 2026-07-02 14:53 - commit 8aed85c2

fix admin event creation, organizer auth, and public event filtering

- Changed files: 22
- Changed areas: Auth / Access Control, Verification / Tests
- Affected features: Data Imports
- Review focus: Auth / JWT, Public routes

Evidence files:

- `apps/api/src/admin/admin.controller.ts`
- `apps/api/src/admin/admin.dto.ts`
- `apps/api/src/admin/admin.service.ts`
- `apps/api/src/auth/auth.service.ts`
- `apps/api/src/events/event.dto.ts`
- `apps/api/src/events/events.service.ts`
- `apps/api/src/public-feed/public-feed.service.ts`
- `apps/api/test/admin.service.spec.ts`

## 2026-07-01 20:54 - commit cf04fca4

fix FE build

- Changed files: 2
- Changed areas: Auth / Access Control
- Affected features: Unknown
- Review focus: Auth / JWT

Evidence files:

- `apps/web/src/components/admin/event-edit-form.tsx`
- `apps/web/src/hooks/use-organizer-auth.ts`

## 2026-07-01 20:52 - commit c4b65a20

feat: organizer portal + location autocomplete + venue memory

- Changed files: 22
- Changed areas: Auth / Access Control
- Affected features: Data Imports, Locations, AI/Crawler Discovery Surface
- Review focus: Auth / JWT, Public routes

Evidence files:

- `apps/api/src/admin/admin.controller.ts`
- `apps/api/src/admin/admin.dto.ts`
- `apps/api/src/admin/admin.service.ts`
- `apps/api/src/events/events.service.ts`
- `apps/api/src/public-feed/public-feed.controller.ts`
- `apps/api/src/public-feed/public-feed.service.ts`
- `apps/web/app/api/geocode/route.ts`
- `apps/web/app/eventi/[eventSlug]/page.tsx`

## 2026-07-01 15:42 - commit 4490db78

Dodaj bulk delete na sve tablice i zaštitu od brisanja povezanih entiteta

- Changed files: 5
- Changed areas: Unclassified
- Affected features: Unknown
- Review focus: None detected

Evidence files:

- `apps/api/src/admin/admin.service.ts`
- `apps/web/app/admin/categories/page.tsx`
- `apps/web/app/admin/organizers/page.tsx`
- `apps/web/src/components/admin/events-table.tsx`
- `apps/web/src/components/admin/source-table.tsx`

## 2026-07-01 15:08 - commit 235a9982

Poboljšaj UX pregleda kandidata: kolapsibilne kartice, tab filteri i cursor pointer

- Changed files: 3
- Changed areas: Unclassified
- Affected features: Unknown
- Review focus: None detected

Evidence files:

- `apps/web/src/components/admin/parsed-candidate-card.tsx`
- `apps/web/src/components/admin/source-review.tsx`
- `apps/web/src/components/ui/button.tsx`

## 2026-07-01 14:13 - commit 6f9f6dd0

feat(admin): full CRUD for organizers, categories, regions/counties/cities

- Changed files: 10
- Changed areas: Unclassified
- Affected features: Data Imports
- Review focus: None detected

Evidence files:

- `apps/api/src/admin/admin.controller.ts`
- `apps/api/src/admin/admin.dto.ts`
- `apps/api/src/admin/admin.service.ts`
- `apps/web/app/admin/categories/page.tsx`
- `apps/web/app/admin/organizers/page.tsx`
- `apps/web/app/admin/regions/page.tsx`
- `apps/web/app/admin/sources/page.tsx`
- `apps/web/src/components/admin/parsed-candidate-card.tsx`

## 2026-07-01 13:52 - commit ecf3fc51

fix(ai-parser): fix time/city extraction from screenshots; add context hint

- Changed files: 4
- Changed areas: Unclassified
- Affected features: Unknown
- Review focus: None detected

Evidence files:

- `apps/api/src/admin/admin.dto.ts`
- `apps/api/src/admin/admin.service.ts`
- `apps/api/src/ai-parser/ai-event-parser.service.ts`
- `apps/web/src/components/admin/source-forms.tsx`

## 2026-07-01 13:35 - commit a2db6df7

feat: extract multiple events from listing pages via AI parser; fix description paragraphs

- Changed files: 2
- Changed areas: Unclassified
- Affected features: Unknown
- Review focus: None detected

Evidence files:

- `apps/api/src/ai-parser/ai-event-parser.service.ts`
- `apps/web/app/eventi/[eventSlug]/page.tsx`

## 2026-07-01 11:22 - commit 611620c2

admin events search

- Changed files: 1
- Changed areas: Unclassified
- Affected features: Unknown
- Review focus: None detected

Evidence files:

- `apps/web/src/components/admin/events-table.tsx`

## Kiroq Scan Audit Trail

- 2026-07-13T09:19:37.925Z: baseline; git 14cac98c; docs 0; test not executed
