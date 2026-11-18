# Release Log

Local git commit/merge timeline inferred from repository history.

Kiroq can infer commits and merge commits from local git. Remote push/release boundaries are Unknown unless a future integration records them.

## 2026-07-15 15:46 - commit af22027e

test: add regression coverage for category fallback, endsAt clearing, and poster image fallback chain

- Changed files: 4
- Changed areas: Verification / Tests
- Affected features: Unknown
- Review focus: Public routes

Evidence files:

- `apps/api/test/events-images.spec.ts`
- `apps/web/src/components/public/event-poster.test.ts`
- `apps/web/src/components/public/event-poster.tsx`
- `apps/web/src/lib/admin/adapters.test.ts`

## 2026-07-15 15:38 - commit 32974203

feat: SEO overhaul, admin inline edit, event geocoding fixes

- Changed files: 26
- Changed areas: Env / Config, Verification / Tests
- Affected features: Data Imports, Locations
- Review focus: Public routes, Env / Config

Evidence files:

- `apps/api/src/admin/admin.controller.ts`
- `apps/api/src/admin/admin.dto.ts`
- `apps/api/src/admin/admin.service.ts`
- `apps/api/src/public-feed/public-feed.service.ts`
- `apps/web/app/error.tsx`
- `apps/web/app/eventi/[eventSlug]/page.tsx`
- `apps/web/app/eventi/page.tsx`
- `apps/web/app/gradovi/[citySlug]/page.tsx`

## 2026-07-15 14:09 - commit c12f555f

google analytics

- Changed files: 18
- Changed areas: Public Discovery Pages, Env / Config, Dependencies
- Affected features: Locations, AI/Crawler Discovery Surface
- Review focus: Public routes, Env / Config

Evidence files:

- `.env.example`
- `apps/api/src/common/croatia-geo.ts`
- `apps/api/src/events/events.service.ts`
- `apps/web/app/admin/layout.tsx`
- `apps/web/app/danas/page.tsx`
- `apps/web/app/gradovi/[citySlug]/page.tsx`
- `apps/web/app/kategorije/[categorySlug]/page.tsx`
- `apps/web/app/layout.tsx`

## 2026-07-15 12:55 - commit f8e3be01

new google places api for address

- Changed files: 12
- Changed areas: Env / Config, Dependencies
- Affected features: Data Imports
- Review focus: Env / Config

Evidence files:

- `.env.example`
- `apps/api/src/admin/admin.controller.ts`
- `apps/api/src/admin/admin.service.ts`
- `apps/api/src/events/event.dto.ts`
- `apps/api/src/events/events.service.ts`
- `apps/web/app/api/geocode/route.ts`
- `apps/web/app/organizer/events/page.tsx`
- `apps/web/app/organizer/layout.tsx`

## 2026-07-14 21:57 - commit 8554deb9

fix: coalesce null organizer filter value from base-ui Select

- Changed files: 1
- Changed areas: Unclassified
- Affected features: Unknown
- Review focus: None detected

Evidence files:

- `apps/web/src/components/admin/events-table.tsx`

## 2026-07-14 21:50 - commit a5a9368d

fix city name null

- Changed files: 2
- Changed areas: Unclassified
- Affected features: Unknown
- Review focus: None detected

Evidence files:

- `apps/web/app/organizer/events/page.tsx`
- `apps/web/src/lib/organizer/api.ts`

## 2026-07-14 21:43 - commit b5b91303

fix: add labels and cursor pointer to event filters

- Changed files: 1
- Changed areas: Unclassified
- Affected features: Unknown
- Review focus: None detected

Evidence files:

- `apps/web/src/components/admin/events-table.tsx`

## 2026-07-14 21:41 - commit 0eeba7d7

feat: add organizer filter to events table

- Changed files: 1
- Changed areas: Unclassified
- Affected features: Unknown
- Review focus: None detected

Evidence files:

- `apps/web/src/components/admin/events-table.tsx`

## 2026-07-14 21:21 - commit f2d00837

feat: add password visibility toggle to admin forms

- Changed files: 2
- Changed areas: Unclassified
- Affected features: Unknown
- Review focus: None detected

Evidence files:

- `apps/web/app/admin/login/page.tsx`
- `apps/web/app/admin/organizers/page.tsx`

## 2026-07-14 21:19 - commit b05e705f

feat: add password visibility toggle to organizer auth forms

- Changed files: 2
- Changed areas: Unclassified
- Affected features: Unknown
- Review focus: None detected

Evidence files:

- `apps/web/app/organizer/login/page.tsx`
- `apps/web/app/organizer/register/page.tsx`

## 2026-07-14 21:15 - commit 0220ee5e

feat: add password visibility toggle with eye icon

- Changed files: 1
- Changed areas: Auth / Access Control
- Affected features: Unknown
- Review focus: Auth / JWT

Evidence files:

- `apps/web/src/components/AuthForms.tsx`

## 2026-07-14 21:14 - commit f8548de0

fix: use reliable ISO date formatting instead of Intl.DateTimeFormat

- Changed files: 1
- Changed areas: Unclassified
- Affected features: Unknown
- Review focus: Public routes

Evidence files:

- `apps/web/src/lib/public-api.ts`

## 2026-07-13 17:19 - commit 8ff1881f

Update page metadata for social sharing (eventi, kalendar)

- Changed files: 2
- Changed areas: Unclassified
- Affected features: Unknown
- Review focus: None detected

Evidence files:

- `apps/web/app/eventi/page.tsx`
- `apps/web/app/kalendar/page.tsx`

## 2026-07-13 17:00 - commit 069afbb9

refactor: narrow scope from Croatia to Slavonia and Baranja

- Changed files: 22
- Changed areas: Unclassified
- Affected features: Unknown
- Review focus: Public routes

Evidence files:

- `CLAUDE.md`
- `apps/api/src/admin/admin.service.ts`
- `apps/api/src/events/events.service.ts`
- `apps/web/app/api/geocode/route.ts`
- `apps/web/app/page.tsx`
- `apps/web/src/components/public/site-footer.tsx`
- `docs/project/API_REFERENCE.md`
- `docs/project/API_ROUTES.md`

## 2026-07-13 12:32 - commit dd2da5ae

fix: stay on source page after creating event from candidate; enhance health endpoint with db check

- Changed files: 3
- Changed areas: Verification / Tests
- Affected features: Unknown
- Review focus: None detected

Evidence files:

- `apps/api/src/app.module.ts`
- `apps/api/test/health.spec.ts`
- `apps/web/src/components/admin/parsed-candidate-card.tsx`

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

## Kiroq Scan Audit Trail

- 2026-07-15T15:46:28.892Z: baseline; git af22027e; docs 0; test not executed
