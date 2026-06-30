# Release Log

Local git commit/merge timeline inferred from repository history.

Kiroq can infer commits and merge commits from local git. Remote push/release boundaries are Unknown unless a future integration records them.

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
- Affected features: AI/Crawler Discovery Surface, Data Imports, Locations, Business Profiles, Trust Signals
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

- 2026-06-30T12:09:16.602Z: baseline; git e614dccc; docs 16; test passed via pnpm test
