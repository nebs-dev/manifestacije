# FAQ

Kiroq generated this FAQ from product explanation, project state, API/DB summaries, open questions, and static evidence.

## What does this repo appear to be?
full-stack web application. Kiroq inferred this from detected features, routes, models, packages, and docs. Confidence: Medium.

Evidence:
  - `package.json`
  - `apps/api/package.json`
  - `apps/web/package.json`

## What are the main detected product areas?
- Data Imports (Done, High)
- Locations (Partial, High)
- AI/Crawler Discovery Surface (Partial, Medium)
- Business Profiles (Partial, Low)
- Trust Signals (Partial, Low)

## What public surfaces were detected?
- GET `/public/events` from `apps/api/src/public-feed/public-feed.controller.ts` (Public (Inferred))
- GET `/public/events/:slug` from `apps/api/src/public-feed/public-feed.controller.ts` (Public (Inferred))
- GET `/public/regions` from `apps/api/src/public-feed/public-feed.controller.ts` (Public (Inferred))
- GET `/public/regions/:slug/events` from `apps/api/src/public-feed/public-feed.controller.ts` (Public (Inferred))
- GET `/public/cities/:slug/events` from `apps/api/src/public-feed/public-feed.controller.ts` (Public (Inferred))
- GET `/public/categories` from `apps/api/src/public-feed/public-feed.controller.ts` (Public (Inferred))
- GET `/public/categories/:slug/events` from `apps/api/src/public-feed/public-feed.controller.ts` (Public (Inferred))
- GET `/public/map/events` from `apps/api/src/public-feed/public-feed.controller.ts` (Public (Inferred))
- GET `/public/seo/sitemap-data` from `apps/api/src/public-feed/public-feed.controller.ts` (Public (Inferred))

## What API surface exists?
Kiroq detected 77 route candidates. See `API_ROUTES.md` for inventory and `API_REFERENCE.md` for grouped endpoint notes.

## What data model exists?
Kiroq detected 12 Prisma models. Top detected models: `User`, `Organizer`, `Region`, `County`, `City`, `Venue`, `Category`, `EventCategory`, `Event`, `EventSource`.

## What commands are likely useful?
- `pnpm --dir apps/api dev`
- `pnpm --dir apps/api build`
- `pnpm --dir apps/api start`
- `pnpm --dir apps/api test`
- `pnpm --dir apps/api lint`
- `pnpm --dir apps/web dev`
- `pnpm --dir apps/web build`
- `pnpm --dir apps/web start`
- `pnpm --dir apps/web test`
- `pnpm --dir apps/web lint`
- `pnpm dev`
- `pnpm build`

## Is runtime behavior verified?
Partially. Kiroq ran `pnpm test` and it passed, but this does not prove smoke/sample/client QA coverage.

## What are the main review areas?
- High: auth related files detected. File paths include risk-sensitive keyword "auth" (12 evidence paths).
- High: jwt related files detected. File paths include risk-sensitive keyword "jwt" (1 evidence paths).
- Medium: public related files detected. File paths include review keyword "public" (35 evidence paths).
- Medium: env related files detected. File paths include review keyword "env" (3 evidence paths).
- Medium: config related files detected. File paths include review keyword "config" (8 evidence paths).
- Medium: prisma/schema.prisma related files detected. File paths include review keyword "prisma/schema.prisma" (12 evidence paths).
- Medium: Public or tokenized routes detected. Route path/source suggests public exposure or token-based access. Affected routes: GET /public/events, GET /public/events/:slug, GET /public/regions, GET /public/regions/:slug/events, GET /public/cities/:slug/events, GET /public/categories, GET /public/categories/:slug/events, GET /public/map/events, GET /public/seo/sitemap-data.

## What is still unknown?
- Is billing intentionally out of scope? (Medium)
- Are public crawlable pages production-ready, including 404 behavior and unpublished-data protection? (High)
- Are deployment env vars complete and aligned with .env.example? (Medium)

## What should happen next?
- Review public /b, report, robots, sitemap, llms, and discovery routes for crawler/human parity, 404 behavior, and unpublished-data exposure. (High)
- Check required production env var coverage between committed examples and deployment config. (Medium)
- Target test command passed: pnpm test. Add smoke/sample checks for critical flows if not covered. (High)

## How reliable is this FAQ?
It is evidence-first but static. It should guide review, not replace runtime tests, smoke checks, QA, or human architecture review.
