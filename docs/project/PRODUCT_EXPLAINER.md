# Product Explainer

Kiroq inferred this from deterministic repository evidence only.

## Inferred Product Category
This appears to be an full-stack web application.

It appears to include ai/crawler discovery surface, data imports, locations, attribution / lead tracking, business profiles, trust signals.

## Main Actors / Users
- Authenticated users/admins (inferred from User model and auth routes).
- Public visitors and crawlers (inferred from public routes).

## Main Workflows
- Manage tenant/business profiles and publishing state.
- Manage services, locations, and crawlable public business pages.
- Track redirects, attribution sessions, lead events, and conversion webhooks.
- Expose discovery/search documents, robots, sitemap, and llms surfaces for crawlers.

## Layers
- Public layer: `/public/events`, `/public/events/:slug`, `/public/regions`, `/public/regions/:slug/events`, `/public/cities/:slug/events`, `/public/categories`, `/public/categories/:slug/events`, `/public/map/events`
- Admin/UI layer: `/admin/events/pending`, `/admin/events`, `/admin/events/:id`, `/admin/events/:id`, `/admin/events/:id/approve`, `/admin/events/:id/reject`, `/admin/events/:id/publish`, `/admin/events/:id/archive`
- API layer: `/admin/events/pending`, `/admin/events`, `/admin/events/:id`, `/admin/events/:id`, `/admin/events/:id/approve`, `/admin/events/:id/reject`, `/admin/events/:id/publish`, `/admin/events/:id/archive`
- Data layer: `User`, `Organizer`, `Region`, `County`, `City`, `Venue`, `Category`, `Event`, `EventSource`, `EventDuplicateCandidate`, `IngestionJob`

## Important Unknowns
- Runtime behavior is not verified unless tests, smoke, sample, seed, QA, or workflow evidence exists.
- Commercial readiness and target customer are not proven by static repository scan.
- Is billing intentionally out of scope?
- Are public crawlable pages production-ready, including 404 behavior and unpublished-data protection?
- Are deployment env vars complete and aligned with .env.example?

## Evidence
  - `package.json`
  - `apps/api/package.json`
  - `apps/web/package.json`
  - `apps/web/v0-import/admin-ui-import/package.json`
  - `apps/web/v0-import/event-discovery-platform/package.json`
  - `apps/api/src/public-feed/public-feed.controller.ts`
  - `apps/web/v0-import/event-discovery-platform/app/dogadanja/[slug]/page.tsx`
  - `apps/web/v0-import/event-discovery-platform/app/dogadanja/page.tsx`
  - `apps/web/v0-import/event-discovery-platform/app/karta/page.tsx`
  - `apps/web/v0-import/event-discovery-platform/app/kategorija/[slug]/page.tsx`
  - `apps/web/v0-import/event-discovery-platform/app/regija/[slug]/page.tsx`
  - `apps/web/app/robots.ts`
  - `apps/web/app/sitemap.ts`
  - `apps/web/src/components/public/discovery-explorer.tsx`
  - `apps/web/src/components/public/discovery-map.tsx`
  - `apps/web/v0-import/event-discovery-platform/app/layout.tsx`
  - `apps/web/v0-import/event-discovery-platform/app/page.tsx`
  - `apps/web/v0-import/event-discovery-platform/components/badges.tsx`
  - `apps/web/v0-import/event-discovery-platform/components/category-strip.tsx`
  - `apps/web/v0-import/event-discovery-platform/components/date-badge.tsx`
  - `apps/web/v0-import/event-discovery-platform/components/discovery-explorer.tsx`
  - `apps/web/v0-import/event-discovery-platform/components/discovery-map.tsx`
  - `apps/web/v0-import/event-discovery-platform/components/event-card.tsx`
  - `apps/web/v0-import/event-discovery-platform/components/event-filters.tsx`
  - `apps/web/v0-import/event-discovery-platform/components/event-poster.tsx`
