# Technical Overview

## Packages
- app: api at `apps/api` (High) evidence: `apps/api/package.json`
- app: web at `apps/web` (High) evidence: `apps/web/package.json`
- root: manifestacije at `.` (High) evidence: `package.json`
- package: @manifestacije/shared at `packages/shared` (High) evidence: `packages/shared/package.json`

## Config Files
| Item | Status | Confidence | Evidence |
| --- | --- | --- | --- |
| apps/api/nest-cli.json | Fact | ▮▮▮ High | `apps/api/nest-cli.json` |
| apps/api/package.json | Fact | ▮▮▮ High | `apps/api/package.json` |
| apps/api/tsconfig.json | Fact | ▮▮▮ High | `apps/api/tsconfig.json` |
| apps/web/next.config.js | Fact | ▮▮▮ High | `apps/web/next.config.js` |
| apps/web/package.json | Fact | ▮▮▮ High | `apps/web/package.json` |
| apps/web/tsconfig.json | Fact | ▮▮▮ High | `apps/web/tsconfig.json` |
| package.json | Fact | ▮▮▮ High | `package.json` |
| packages/shared/package.json | Fact | ▮▮▮ High | `packages/shared/package.json` |
| packages/shared/tsconfig.json | Fact | ▮▮▮ High | `packages/shared/tsconfig.json` |
| pnpm-workspace.yaml | Fact | ▮▮▮ High | `pnpm-workspace.yaml` |

## Source Files
| Item | Status | Confidence | Evidence |
| --- | --- | --- | --- |
| apps/api/jest.config.js | Fact | ▮▮▮ High | `apps/api/jest.config.js` |
| apps/api/prisma/seed.ts | Fact | ▮▮▮ High | `apps/api/prisma/seed.ts` |
| apps/api/src/admin/admin.controller.ts | Fact | ▮▮▮ High | `apps/api/src/admin/admin.controller.ts` |
| apps/api/src/admin/admin.dto.ts | Fact | ▮▮▮ High | `apps/api/src/admin/admin.dto.ts` |
| apps/api/src/admin/admin.module.ts | Fact | ▮▮▮ High | `apps/api/src/admin/admin.module.ts` |
| apps/api/src/admin/admin.service.ts | Fact | ▮▮▮ High | `apps/api/src/admin/admin.service.ts` |
| apps/api/src/admin/revalidate.service.ts | Fact | ▮▮▮ High | `apps/api/src/admin/revalidate.service.ts` |
| apps/api/src/admin/uploads.service.ts | Fact | ▮▮▮ High | `apps/api/src/admin/uploads.service.ts` |
| apps/api/src/ai-parser/ai-event-parser.service.ts | Fact | ▮▮▮ High | `apps/api/src/ai-parser/ai-event-parser.service.ts` |
| apps/api/src/ai-parser/ai-parser.module.ts | Fact | ▮▮▮ High | `apps/api/src/ai-parser/ai-parser.module.ts` |
| apps/api/src/ai-parser/candidate-filters.ts | Fact | ▮▮▮ High | `apps/api/src/ai-parser/candidate-filters.ts` |
| apps/api/src/app.module.ts | Fact | ▮▮▮ High | `apps/api/src/app.module.ts` |
| apps/api/src/auth/auth.controller.ts | Fact | ▮▮▮ High | `apps/api/src/auth/auth.controller.ts` |
| apps/api/src/auth/auth.decorators.ts | Fact | ▮▮▮ High | `apps/api/src/auth/auth.decorators.ts` |
| apps/api/src/auth/auth.dto.ts | Fact | ▮▮▮ High | `apps/api/src/auth/auth.dto.ts` |
| apps/api/src/auth/auth.module.ts | Fact | ▮▮▮ High | `apps/api/src/auth/auth.module.ts` |
| apps/api/src/auth/auth.service.ts | Fact | ▮▮▮ High | `apps/api/src/auth/auth.service.ts` |
| apps/api/src/auth/auth.types.ts | Fact | ▮▮▮ High | `apps/api/src/auth/auth.types.ts` |
| apps/api/src/auth/jwt-auth.guard.ts | Fact | ▮▮▮ High | `apps/api/src/auth/jwt-auth.guard.ts` |
| apps/api/src/categories/categories.module.ts | Fact | ▮▮▮ High | `apps/api/src/categories/categories.module.ts` |
| apps/api/src/cities/cities.module.ts | Fact | ▮▮▮ High | `apps/api/src/cities/cities.module.ts` |
| apps/api/src/common/city-resolver.ts | Fact | ▮▮▮ High | `apps/api/src/common/city-resolver.ts` |
| apps/api/src/common/croatia-geo.ts | Fact | ▮▮▮ High | `apps/api/src/common/croatia-geo.ts` |
| apps/api/src/common/reset-token.ts | Fact | ▮▮▮ High | `apps/api/src/common/reset-token.ts` |
| apps/api/src/common/slug.ts | Fact | ▮▮▮ High | `apps/api/src/common/slug.ts` |
| apps/api/src/common/weekend.ts | Fact | ▮▮▮ High | `apps/api/src/common/weekend.ts` |
| apps/api/src/contacts/contacts.module.ts | Fact | ▮▮▮ High | `apps/api/src/contacts/contacts.module.ts` |
| apps/api/src/contacts/resend-contacts.service.ts | Fact | ▮▮▮ High | `apps/api/src/contacts/resend-contacts.service.ts` |
| apps/api/src/counties/counties.module.ts | Fact | ▮▮▮ High | `apps/api/src/counties/counties.module.ts` |
| apps/api/src/duplicates/duplicates.module.ts | Fact | ▮▮▮ High | `apps/api/src/duplicates/duplicates.module.ts` |
| apps/api/src/duplicates/duplicates.service.ts | Fact | ▮▮▮ High | `apps/api/src/duplicates/duplicates.service.ts` |
| apps/api/src/email/email.config.ts | Fact | ▮▮▮ High | `apps/api/src/email/email.config.ts` |
| apps/api/src/email/email.module.ts | Fact | ▮▮▮ High | `apps/api/src/email/email.module.ts` |
| apps/api/src/email/email.service.ts | Fact | ▮▮▮ High | `apps/api/src/email/email.service.ts` |
| apps/api/src/email/email.types.ts | Fact | ▮▮▮ High | `apps/api/src/email/email.types.ts` |
| apps/api/src/email/format-date.ts | Fact | ▮▮▮ High | `apps/api/src/email/format-date.ts` |
| apps/api/src/email/providers/email-provider.interface.ts | Fact | ▮▮▮ High | `apps/api/src/email/providers/email-provider.interface.ts` |
| apps/api/src/email/providers/log-email.provider.ts | Fact | ▮▮▮ High | `apps/api/src/email/providers/log-email.provider.ts` |
| apps/api/src/email/providers/resend-email.provider.ts | Fact | ▮▮▮ High | `apps/api/src/email/providers/resend-email.provider.ts` |
| apps/api/src/email/templates/admin-new-organizer.template.ts | Fact | ▮▮▮ High | `apps/api/src/email/templates/admin-new-organizer.template.ts` |
| apps/api/src/email/templates/admin-new-submission.template.ts | Fact | ▮▮▮ High | `apps/api/src/email/templates/admin-new-submission.template.ts` |
| apps/api/src/email/templates/email-layout.ts | Fact | ▮▮▮ High | `apps/api/src/email/templates/email-layout.ts` |
| apps/api/src/email/templates/event-published.template.ts | Fact | ▮▮▮ High | `apps/api/src/email/templates/event-published.template.ts` |
| apps/api/src/email/templates/event-rejected.template.ts | Fact | ▮▮▮ High | `apps/api/src/email/templates/event-rejected.template.ts` |
| apps/api/src/email/templates/event-submitted.template.ts | Fact | ▮▮▮ High | `apps/api/src/email/templates/event-submitted.template.ts` |
| apps/api/src/email/templates/organizer-claim.template.ts | Fact | ▮▮▮ High | `apps/api/src/email/templates/organizer-claim.template.ts` |
| apps/api/src/email/templates/organizer-welcome.template.ts | Fact | ▮▮▮ High | `apps/api/src/email/templates/organizer-welcome.template.ts` |
| apps/api/src/email/templates/password-reset.template.ts | Fact | ▮▮▮ High | `apps/api/src/email/templates/password-reset.template.ts` |
| apps/api/src/events/event.dto.ts | Fact | ▮▮▮ High | `apps/api/src/events/event.dto.ts` |
| apps/api/src/events/events.module.ts | Fact | ▮▮▮ High | `apps/api/src/events/events.module.ts` |

## Tests
| Item | Status | Confidence | Evidence |
| --- | --- | --- | --- |
| apps/api/test/admin-event-occurrences.spec.ts | Fact | ▮▮▮ High | `apps/api/test/admin-event-occurrences.spec.ts` |
| apps/api/test/admin.service.spec.ts | Fact | ▮▮▮ High | `apps/api/test/admin.service.spec.ts` |
| apps/api/test/ai-parser.spec.js | Fact | ▮▮▮ High | `apps/api/test/ai-parser.spec.js` |
| apps/api/test/ai-parser.spec.ts | Fact | ▮▮▮ High | `apps/api/test/ai-parser.spec.ts` |
| apps/api/test/auth.spec.ts | Fact | ▮▮▮ High | `apps/api/test/auth.spec.ts` |
| apps/api/test/city-resolver.spec.ts | Fact | ▮▮▮ High | `apps/api/test/city-resolver.spec.ts` |
| apps/api/test/croatia-geo.spec.ts | Fact | ▮▮▮ High | `apps/api/test/croatia-geo.spec.ts` |
| apps/api/test/duplicates.spec.js | Fact | ▮▮▮ High | `apps/api/test/duplicates.spec.js` |
| apps/api/test/duplicates.spec.ts | Fact | ▮▮▮ High | `apps/api/test/duplicates.spec.ts` |
| apps/api/test/email.service.spec.ts | Fact | ▮▮▮ High | `apps/api/test/email.service.spec.ts` |
| apps/api/test/event-occurrences.spec.ts | Fact | ▮▮▮ High | `apps/api/test/event-occurrences.spec.ts` |
| apps/api/test/events-images.spec.ts | Fact | ▮▮▮ High | `apps/api/test/events-images.spec.ts` |
| apps/api/test/health.spec.ts | Fact | ▮▮▮ High | `apps/api/test/health.spec.ts` |
| apps/api/test/monitored-sources.spec.ts | Fact | ▮▮▮ High | `apps/api/test/monitored-sources.spec.ts` |
| apps/api/test/organizer-claim.service.spec.ts | Fact | ▮▮▮ High | `apps/api/test/organizer-claim.service.spec.ts` |
| apps/api/test/organizer.service.spec.ts | Fact | ▮▮▮ High | `apps/api/test/organizer.service.spec.ts` |
| apps/api/test/public-feed.service.spec.ts | Fact | ▮▮▮ High | `apps/api/test/public-feed.service.spec.ts` |
| apps/api/test/resend-contacts.service.spec.ts | Fact | ▮▮▮ High | `apps/api/test/resend-contacts.service.spec.ts` |
| apps/api/test/uploads.spec.ts | Fact | ▮▮▮ High | `apps/api/test/uploads.spec.ts` |
| apps/api/test/verify-resend-signature.spec.ts | Fact | ▮▮▮ High | `apps/api/test/verify-resend-signature.spec.ts` |
| apps/api/test/weekend.spec.ts | Fact | ▮▮▮ High | `apps/api/test/weekend.spec.ts` |
| apps/web/src/components/event-schedule-editor.test.ts | Fact | ▮▮▮ High | `apps/web/src/components/event-schedule-editor.test.ts` |
| apps/web/src/components/public/event-card-display.test.ts | Fact | ▮▮▮ High | `apps/web/src/components/public/event-card-display.test.ts` |
| apps/web/src/components/public/event-poster.test.ts | Fact | ▮▮▮ High | `apps/web/src/components/public/event-poster.test.ts` |
| apps/web/src/components/public/partner-swap-logic.test.ts | Fact | ▮▮▮ High | `apps/web/src/components/public/partner-swap-logic.test.ts` |
| apps/web/src/lib/admin/adapters.test.ts | Fact | ▮▮▮ High | `apps/web/src/lib/admin/adapters.test.ts` |
| apps/web/src/lib/admin/api.test.ts | Fact | ▮▮▮ High | `apps/web/src/lib/admin/api.test.ts` |
| apps/web/src/lib/analytics.test.ts | Fact | ▮▮▮ High | `apps/web/src/lib/analytics.test.ts` |
| apps/web/src/lib/calendar.test.ts | Fact | ▮▮▮ High | `apps/web/src/lib/calendar.test.ts` |
| apps/web/src/lib/city-seo.test.ts | Fact | ▮▮▮ High | `apps/web/src/lib/city-seo.test.ts` |
| apps/web/src/lib/event-image-variants.test.ts | Fact | ▮▮▮ High | `apps/web/src/lib/event-image-variants.test.ts` |
| apps/web/src/lib/event-jsonld.test.ts | Fact | ▮▮▮ High | `apps/web/src/lib/event-jsonld.test.ts` |
| apps/web/src/lib/event-schedule.test.ts | Fact | ▮▮▮ High | `apps/web/src/lib/event-schedule.test.ts` |
| apps/web/src/lib/home-calendar.test.ts | Fact | ▮▮▮ High | `apps/web/src/lib/home-calendar.test.ts` |
| apps/web/src/lib/location-display.test.ts | Fact | ▮▮▮ High | `apps/web/src/lib/location-display.test.ts` |
| apps/web/src/lib/public-api.test.ts | Fact | ▮▮▮ High | `apps/web/src/lib/public-api.test.ts` |
| apps/web/src/lib/weekend.test.ts | Fact | ▮▮▮ High | `apps/web/src/lib/weekend.test.ts` |

## Test Run
- Status: Not run
- Command: None
- Note: Re-run baseline/update with `--run-tests` to capture target test evidence.

## Env
| Item | Status | Confidence | Evidence |
| --- | --- | --- | --- |
| .env | Fact | ▮▮▮ High | `.env` |
| .env.example | Fact | ▮▮▮ High | `.env.example` |

## Docs
| Item | Status | Confidence | Evidence |
| --- | --- | --- | --- |
| .kiro/skills/cavecrew/README.md | Fact | ▮▮▮ High | `.kiro/skills/cavecrew/README.md` |
| .kiro/skills/caveman/README.md | Fact | ▮▮▮ High | `.kiro/skills/caveman/README.md` |
| .kiro/skills/caveman-commit/README.md | Fact | ▮▮▮ High | `.kiro/skills/caveman-commit/README.md` |
| .kiro/skills/caveman-compress/README.md | Fact | ▮▮▮ High | `.kiro/skills/caveman-compress/README.md` |
| .kiro/skills/caveman-help/README.md | Fact | ▮▮▮ High | `.kiro/skills/caveman-help/README.md` |
| .kiro/skills/caveman-review/README.md | Fact | ▮▮▮ High | `.kiro/skills/caveman-review/README.md` |
| .kiro/skills/caveman-stats/README.md | Fact | ▮▮▮ High | `.kiro/skills/caveman-stats/README.md` |
| docs/qa/INGESTION_SMOKE.md | Fact | ▮▮▮ High | `docs/qa/INGESTION_SMOKE.md` |
