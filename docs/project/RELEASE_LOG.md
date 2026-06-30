# Release Log

Local git commit/merge timeline inferred from repository history.

Kiroq can infer commits and merge commits from local git. Remote push/release boundaries are Unknown unless a future integration records them.

## 2026-06-30 16:42 - commit ca8dccd7

feat: event location autocomplete, coordinates, and display fixes

- Changed files: 40
- Changed areas: Database / Schema, Verification / Tests
- Affected features: Locations, AI/Crawler Discovery Surface
- Review focus: Public routes, Database / Prisma

Evidence files:

- `apps/api/dist/admin/admin.dto.js`
- `apps/api/dist/admin/admin.service.js`
- `apps/api/dist/ai-parser/ai-event-parser.service.js`
- `apps/api/dist/events/event.dto.js`
- `apps/api/dist/events/events.service.js`
- `apps/api/dist/public-feed/public-feed.service.js`
- `apps/api/prisma/migrations/20260630100000_add_event_categories/migration.sql`
- `apps/api/prisma/migrations/20260630200000_event_location_fields/migration.sql`

## 2026-06-30 14:36 - commit 9cc4d5b0

polish public UI: diacritics, card layout, seed data, fallback images

- Changed files: 7
- Changed areas: Database / Schema
- Affected features: Unknown
- Review focus: Public routes, Database / Prisma

Evidence files:

- `apps/api/prisma/seed.ts`
- `apps/web/app/eventi/page.tsx`
- `apps/web/app/page.tsx`
- `apps/web/src/components/public/event-card.tsx`
- `apps/web/src/components/public/results-grid.tsx`
- `apps/web/src/components/public/section-heading.tsx`
- `apps/web/src/lib/public-api.ts`

## 2026-06-30 13:37 - commit a7a02e18

fix prisma seed

- Changed files: 2
- Changed areas: Database / Schema
- Affected features: Unknown
- Review focus: Database / Prisma

Evidence files:

- `DEPLOYMENT.md`
- `apps/api/prisma/seed.ts`

## 2026-06-30 13:18 - commit 556537ef

prepare manifestacije for staging deploy

- Changed files: 8
- Changed areas: Database / Schema, Env / Config
- Affected features: Unknown
- Review focus: Env / Config, Database / Prisma

Evidence files:

- `.env.example`
- `.gitignore`
- `DEPLOYMENT.md`
- `apps/api/dist/app.module.js`
- `apps/api/dist/main.js`
- `apps/api/prisma/seed.ts`
- `apps/api/src/app.module.ts`
- `apps/api/src/main.ts`

## 2026-06-30 13:10 - commit 8b183fe9

feat: integrate public UI and improve admin event workflow

- Changed files: 117
- Changed areas: Public Discovery Pages, Auth / Access Control, Database / Schema, Env / Config, Verification / Tests, Dependencies
- Affected features: AI/Crawler Discovery Surface, Trust Signals
- Review focus: Auth / JWT, Public routes, Env / Config, Database / Prisma

Evidence files:

- `apps/api/dist/admin/admin.controller.js`
- `apps/api/dist/admin/admin.dto.js`
- `apps/api/dist/admin/admin.service.js`
- `apps/api/dist/ai-parser/ai-event-parser.service.js`
- `apps/api/dist/events/event.dto.js`
- `apps/api/dist/events/events.service.js`
- `apps/api/dist/main.js`
- `apps/api/prisma/seed.ts`

## 2026-06-30 12:08 - commit e614dccc

fix admin UI: table overflow, delete buttons, taxonomy pages

- Changed files: 10
- Changed areas: Unclassified
- Affected features: Trust Signals
- Review focus: None detected

Evidence files:

- `apps/api/src/admin/admin.controller.ts`
- `apps/api/src/admin/admin.service.ts`
- `apps/web/app/admin/categories/page.tsx`
- `apps/web/app/admin/events/page.tsx`
- `apps/web/app/admin/organizers/page.tsx`
- `apps/web/app/admin/regions/page.tsx`
- `apps/web/src/components/admin/events-table.tsx`
- `apps/web/src/components/admin/pending-events-table.tsx`

## 2026-06-30 11:59 - commit b6d1c3a9

improve Visit Slavonija batch parser quality

- Changed files: 2
- Changed areas: Verification / Tests
- Affected features: Unknown
- Review focus: None detected

Evidence files:

- `apps/api/src/ai-parser/ai-event-parser.service.ts`
- `apps/api/test/ai-parser.spec.ts`

## 2026-06-30 11:39 - commit 17b77fd6

fix sources/[id] page crash and add ingestion smoke test

- Changed files: 4
- Changed areas: Verification / Tests, Dependencies
- Affected features: Unknown
- Review focus: None detected

Evidence files:

- `apps/web/app/admin/sources/[id]/page.tsx`
- `docs/qa/INGESTION_SMOKE.md`
- `package.json`
- `scripts/smoke-ingestion.mjs`

## 2026-06-30 11:33 - commit 650b8158

add admin event-source ingestion, AI parser, and admin UI

- Changed files: 59
- Changed areas: Auth / Access Control, Verification / Tests, Dependencies
- Affected features: Trust Signals
- Review focus: Auth / JWT

Evidence files:

- `.gitignore`
- `apps/api/package.json`
- `apps/api/src/admin/admin.controller.ts`
- `apps/api/src/admin/admin.dto.ts`
- `apps/api/src/admin/admin.service.ts`
- `apps/api/src/ai-parser/ai-event-parser.service.ts`
- `apps/api/src/main.ts`
- `apps/api/test/ai-parser.spec.ts`

## 2026-06-30 08:45 - commit fa137667

initial manifestacije app and landing page

- Changed files: 241
- Changed areas: Public Discovery Pages, Auth / Access Control, Database / Schema, Env / Config, Verification / Tests, Dependencies
- Affected features: Locations, AI/Crawler Discovery Surface, Business Profiles, Trust Signals
- Review focus: Auth / JWT, Public routes, Env / Config, Database / Prisma

Evidence files:

- `.env.example`
- `.gitignore`
- `.npmrc`
- `apps/api/dist/admin/admin.controller.js`
- `apps/api/dist/admin/admin.dto.js`
- `apps/api/dist/admin/admin.module.js`
- `apps/api/dist/admin/admin.service.js`
- `apps/api/dist/ai-parser/ai-event-parser.service.js`

## Kiroq Scan Audit Trail

- 2026-06-30T17:53:35.026Z: baseline; git ca8dccd7; docs 16; test passed via pnpm test
