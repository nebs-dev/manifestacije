# Technical Overview

## Packages
- app: api at `apps/api` (High) evidence: `apps/api/package.json`
- app: web at `apps/web` (High) evidence: `apps/web/package.json`
- root: manifestacije at `.` (High) evidence: `package.json`
- package: @manifestacije/shared at `packages/shared` (High) evidence: `packages/shared/package.json`

## Config Files
| Item | Status | Confidence | Evidence |
| --- | --- | --- | --- |
| apps/api/nest-cli.json | Fact | High | `apps/api/nest-cli.json` |
| apps/api/package.json | Fact | High | `apps/api/package.json` |
| apps/api/tsconfig.json | Fact | High | `apps/api/tsconfig.json` |
| apps/web/next.config.js | Fact | High | `apps/web/next.config.js` |
| apps/web/package.json | Fact | High | `apps/web/package.json` |
| apps/web/tsconfig.json | Fact | High | `apps/web/tsconfig.json` |
| package.json | Fact | High | `package.json` |
| packages/shared/package.json | Fact | High | `packages/shared/package.json` |
| packages/shared/tsconfig.json | Fact | High | `packages/shared/tsconfig.json` |
| pnpm-workspace.yaml | Fact | High | `pnpm-workspace.yaml` |

## Source Files
| Item | Status | Confidence | Evidence |
| --- | --- | --- | --- |
| apps/api/jest.config.js | Fact | High | `apps/api/jest.config.js` |
| apps/api/prisma/seed.ts | Fact | High | `apps/api/prisma/seed.ts` |
| apps/api/src/admin/admin.controller.ts | Fact | High | `apps/api/src/admin/admin.controller.ts` |
| apps/api/src/admin/admin.dto.ts | Fact | High | `apps/api/src/admin/admin.dto.ts` |
| apps/api/src/admin/admin.module.ts | Fact | High | `apps/api/src/admin/admin.module.ts` |
| apps/api/src/admin/admin.service.ts | Fact | High | `apps/api/src/admin/admin.service.ts` |
| apps/api/src/ai-parser/ai-event-parser.service.ts | Fact | High | `apps/api/src/ai-parser/ai-event-parser.service.ts` |
| apps/api/src/ai-parser/ai-parser.module.ts | Fact | High | `apps/api/src/ai-parser/ai-parser.module.ts` |
| apps/api/src/app.module.ts | Fact | High | `apps/api/src/app.module.ts` |
| apps/api/src/auth/auth.controller.ts | Fact | High | `apps/api/src/auth/auth.controller.ts` |
| apps/api/src/auth/auth.decorators.ts | Fact | High | `apps/api/src/auth/auth.decorators.ts` |
| apps/api/src/auth/auth.dto.ts | Fact | High | `apps/api/src/auth/auth.dto.ts` |
| apps/api/src/auth/auth.module.ts | Fact | High | `apps/api/src/auth/auth.module.ts` |
| apps/api/src/auth/auth.service.ts | Fact | High | `apps/api/src/auth/auth.service.ts` |
| apps/api/src/auth/auth.types.ts | Fact | High | `apps/api/src/auth/auth.types.ts` |
| apps/api/src/auth/jwt-auth.guard.ts | Fact | High | `apps/api/src/auth/jwt-auth.guard.ts` |
| apps/api/src/categories/categories.module.ts | Fact | High | `apps/api/src/categories/categories.module.ts` |
| apps/api/src/cities/cities.module.ts | Fact | High | `apps/api/src/cities/cities.module.ts` |
| apps/api/src/common/slug.ts | Fact | High | `apps/api/src/common/slug.ts` |
| apps/api/src/counties/counties.module.ts | Fact | High | `apps/api/src/counties/counties.module.ts` |
| apps/api/src/duplicates/duplicates.module.ts | Fact | High | `apps/api/src/duplicates/duplicates.module.ts` |
| apps/api/src/duplicates/duplicates.service.ts | Fact | High | `apps/api/src/duplicates/duplicates.service.ts` |
| apps/api/src/event-sources/event-sources.module.ts | Fact | High | `apps/api/src/event-sources/event-sources.module.ts` |
| apps/api/src/events/event.dto.ts | Fact | High | `apps/api/src/events/event.dto.ts` |
| apps/api/src/events/events.module.ts | Fact | High | `apps/api/src/events/events.module.ts` |
| apps/api/src/events/events.service.ts | Fact | High | `apps/api/src/events/events.service.ts` |
| apps/api/src/ingestion/ingestion.module.ts | Fact | High | `apps/api/src/ingestion/ingestion.module.ts` |
| apps/api/src/main.ts | Fact | High | `apps/api/src/main.ts` |
| apps/api/src/organizers/organizer.controller.ts | Fact | High | `apps/api/src/organizers/organizer.controller.ts` |
| apps/api/src/organizers/organizer.dto.ts | Fact | High | `apps/api/src/organizers/organizer.dto.ts` |
| apps/api/src/organizers/organizer.service.ts | Fact | High | `apps/api/src/organizers/organizer.service.ts` |
| apps/api/src/organizers/organizers.module.ts | Fact | High | `apps/api/src/organizers/organizers.module.ts` |
| apps/api/src/prisma/prisma.service.ts | Fact | High | `apps/api/src/prisma/prisma.service.ts` |
| apps/api/src/public-feed/public-feed.controller.ts | Fact | High | `apps/api/src/public-feed/public-feed.controller.ts` |
| apps/api/src/public-feed/public-feed.module.ts | Fact | High | `apps/api/src/public-feed/public-feed.module.ts` |
| apps/api/src/public-feed/public-feed.service.ts | Fact | High | `apps/api/src/public-feed/public-feed.service.ts` |
| apps/api/src/regions/regions.module.ts | Fact | High | `apps/api/src/regions/regions.module.ts` |
| apps/api/src/users/users.module.ts | Fact | High | `apps/api/src/users/users.module.ts` |
| apps/api/src/venues/venues.module.ts | Fact | High | `apps/api/src/venues/venues.module.ts` |
| apps/api/test/ai-parser.spec.js | Fact | High | `apps/api/test/ai-parser.spec.js` |
| apps/api/test/ai-parser.spec.ts | Fact | High | `apps/api/test/ai-parser.spec.ts` |
| apps/api/test/duplicates.spec.js | Fact | High | `apps/api/test/duplicates.spec.js` |
| apps/api/test/duplicates.spec.ts | Fact | High | `apps/api/test/duplicates.spec.ts` |
| apps/web/app/admin/categories/page.tsx | Fact | High | `apps/web/app/admin/categories/page.tsx` |
| apps/web/app/admin/duplicates/page.tsx | Fact | High | `apps/web/app/admin/duplicates/page.tsx` |
| apps/web/app/admin/events/[id]/page.tsx | Fact | High | `apps/web/app/admin/events/[id]/page.tsx` |
| apps/web/app/admin/events/page.tsx | Fact | High | `apps/web/app/admin/events/page.tsx` |
| apps/web/app/admin/events/pending/page.tsx | Fact | High | `apps/web/app/admin/events/pending/page.tsx` |
| apps/web/app/admin/layout.tsx | Fact | High | `apps/web/app/admin/layout.tsx` |
| apps/web/app/admin/login/page.tsx | Fact | High | `apps/web/app/admin/login/page.tsx` |

## Tests
| Item | Status | Confidence | Evidence |
| --- | --- | --- | --- |
| apps/api/test/ai-parser.spec.js | Fact | High | `apps/api/test/ai-parser.spec.js` |
| apps/api/test/ai-parser.spec.ts | Fact | High | `apps/api/test/ai-parser.spec.ts` |
| apps/api/test/duplicates.spec.js | Fact | High | `apps/api/test/duplicates.spec.js` |
| apps/api/test/duplicates.spec.ts | Fact | High | `apps/api/test/duplicates.spec.ts` |

## Test Run
- Status: passed
- Attempted: yes
- Command: pnpm test
- Confidence: High
- Duration: 2582ms
- Output summary:
  - apps/api test: PASS test/duplicates.spec.ts
  - apps/api test: Test Suites: 2 passed, 2 total
  - apps/api test: Tests:       36 passed, 36 total
  - apps/api test: Snapshots:   0 total
  - apps/api test: Time:        1.541 s, estimated 2 s
  - apps/api test: Ran all test suites.
  - apps/api test: Done
  - apps/web test$ echo web ok

## Env
| Item | Status | Confidence | Evidence |
| --- | --- | --- | --- |
| .env | Fact | High | `.env` |
| .env.example | Fact | High | `.env.example` |

## Docs
| Item | Status | Confidence | Evidence |
| --- | --- | --- | --- |
| .kiro/skills/cavecrew/README.md | Fact | High | `.kiro/skills/cavecrew/README.md` |
| .kiro/skills/caveman/README.md | Fact | High | `.kiro/skills/caveman/README.md` |
| .kiro/skills/caveman-commit/README.md | Fact | High | `.kiro/skills/caveman-commit/README.md` |
| .kiro/skills/caveman-compress/README.md | Fact | High | `.kiro/skills/caveman-compress/README.md` |
| .kiro/skills/caveman-help/README.md | Fact | High | `.kiro/skills/caveman-help/README.md` |
| .kiro/skills/caveman-review/README.md | Fact | High | `.kiro/skills/caveman-review/README.md` |
| .kiro/skills/caveman-stats/README.md | Fact | High | `.kiro/skills/caveman-stats/README.md` |
| docs/qa/INGESTION_SMOKE.md | Fact | High | `docs/qa/INGESTION_SMOKE.md` |
