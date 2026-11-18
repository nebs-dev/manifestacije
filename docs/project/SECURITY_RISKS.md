# Security Risks

_These are static review findings from repository evidence, not proven vulnerabilities._

Priority rules:
- High: auth/JWT, tokenized report/redirect flows, webhooks, secrets, failed tests, or other evidence where mistakes can affect access, data exposure, or external input handling.
- Medium: public routes, env/config, database/schema, redirects, or generated surfaces that need review but are not automatically critical.
- Low: advisory/static findings with weaker evidence or lower operational sensitivity.
- No manual review input is used. Priority changes only when repository evidence changes: sensitive files disappear, routes change, tests/smoke/QA artifacts appear, tests fail/pass, or deterministic Kiroq rules change.
- Kiroq cannot know a human reviewed something unless that review creates repository evidence, such as tests, smoke scripts, QA artifacts, docs, or code changes.

| Severity | Risk | Confidence | Evidence | Review |
| --- | --- | --- | --- | --- |
| High | Auth/session/token source files detected<br>Source files matching authentication/session/token patterns were found (13 evidence paths). | ▮▮▮ High | `apps/api/src/auth/auth.controller.ts`<br>`apps/api/src/auth/auth.decorators.ts`<br>`apps/api/src/auth/auth.dto.ts`<br>`apps/api/src/auth/auth.module.ts`<br>`apps/api/src/auth/auth.service.ts`<br>`apps/api/src/auth/auth.types.ts`<br>`apps/api/src/auth/jwt-auth.guard.ts`<br>`apps/api/test/auth.spec.ts`<br>`apps/web/src/components/AuthForms.tsx`<br>`apps/web/src/lib/organizer/auth.ts` | Review access control, secret handling, and data exposure.<br>Confirm tests or smoke checks cover expected security behavior. |
| Medium | Database migration/schema files detected<br>Files matching database schema/migration patterns were found (1 evidence paths). | ▮▮▯ Medium | `apps/api/prisma/schema.prisma` | Confirm migrations are reviewed and reversible.<br>Confirm generated docs match runtime schema. |
| Medium | Public or tokenized routes detected<br>Route path/source suggests public exposure or token-based access. Affected routes: GET /public/events, GET /public/events/:slug, GET /public/regions, GET /public/cities, GET /public/regions/:slug/events, GET /public/cities/:slug/events, GET /public/categories, GET /public/categories/:slug/events, GET /public/map/events, GET /public/seo/sitemap-data. | ▮▮▮ High | `apps/api/src/public-feed/public-feed.controller.ts` | Confirm token expiration.<br>Confirm unpublished data is not exposed.<br>Confirm token cannot be guessed. |
