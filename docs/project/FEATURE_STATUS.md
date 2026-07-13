# Feature Status

_Status = operational completeness estimate. Confidence = confidence Kiroq detected the feature from static evidence._

| Feature | Status | Confidence | Last changed | Related risks | Evidence | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| Data Imports | Done | ▮▮▮ High | 2026-07-06T16:48:32+02:00 | None | `apps/api/src/admin/admin.controller.ts`<br>`apps/api/src/organizers/organizer.controller.ts`<br>`apps/api/test/uploads.spec.ts`<br>`apps/api/src/admin/uploads.service.ts` | 2 backend routes/controllers, 0 frontend pages, 0 DB models, 1 tests, 0 docs matched.<br>Done because implementation has route/UI/storage signals plus test, smoke, sample, seed, QA, or workflow evidence.<br>Done is an operational completeness estimate, not commercial/product readiness. |
| Locations | Partial | ▮▮▮ High | 2026-07-06T11:31:18+02:00 | Medium: Database migration/schema files detected | `apps/web/app/gradovi/[citySlug]/page.tsx`<br>`apps/api/prisma/schema.prisma`<br>`apps/web/src/components/ui/location-autocomplete.tsx` | 0 backend routes/controllers, 1 frontend pages, 1 DB models, 0 tests, 0 docs matched.<br>Frontend page detected, but clear backend/storage proof is incomplete.<br>No related test/spec evidence found. |
| AI/Crawler Discovery Surface | Partial | ▮▮▯ Medium | 2026-07-03T19:18:55+02:00 | Medium: Public or tokenized routes detected | `apps/api/src/public-feed/public-feed.controller.ts`<br>`apps/web/app/robots.ts`<br>`apps/web/app/sitemap.ts`<br>`apps/web/src/components/public/discovery-explorer.tsx`<br>`apps/web/src/components/public/discovery-map.tsx` | 1 backend routes/controllers, 0 frontend pages, 0 DB models, 0 tests, 0 docs matched.<br>Backend route/controller detected, but storage/test/sample evidence is incomplete.<br>Conservative feature: no explicit test, smoke, sample, seed, QA, or workflow proof found.<br>No related test/spec evidence found. |

## Detected code areas

_Detected code areas are single-signal matches (e.g. a package with source files). They are not named product features and carry no status._

| Area | Evidence |
| --- | --- |
| Api | `apps/api/package.json`<br>`apps/api/src/admin/admin.controller.ts`<br>`apps/api/src/admin/admin.dto.ts`<br>`apps/api/src/admin/admin.module.ts`<br>`apps/api/src/admin/admin.service.ts`<br>`apps/api/src/admin/revalidate.service.ts` |
| Web | `apps/web/package.json`<br>`apps/web/app/admin/categories/page.tsx`<br>`apps/web/app/admin/duplicates/page.tsx`<br>`apps/web/app/admin/events/[id]/page.tsx`<br>`apps/web/app/admin/events/new/page.tsx`<br>`apps/web/app/admin/events/page.tsx` |
| Shared | `packages/shared/package.json`<br>`packages/shared/src/index.ts` |
| Organizer | `apps/api/src/organizers/organizer.controller.ts` |
