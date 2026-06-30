# Assumptions

| Item | Status | Confidence | Evidence |
| --- | --- | --- | --- |
| Generated memory is based on static repository evidence only; runtime correctness is not proven. | Inferred | Medium | `apps/api/nest-cli.json`<br>`apps/api/package.json`<br>`apps/api/tsconfig.json`<br>`apps/web/next.config.js`<br>`apps/web/package.json`<br>`apps/web/tsconfig.json`<br>`apps/web/v0-import/admin-ui-import/next.config.mjs`<br>`apps/web/v0-import/admin-ui-import/package.json`<br>`apps/web/v0-import/admin-ui-import/tsconfig.json`<br>`apps/web/v0-import/event-discovery-platform/next.config.mjs` |
| Project appears to publish crawlable public discovery pages. | Inferred | High | `apps/api/src/public-feed/public-feed.controller.ts` |
| Project appears to track redirects, attribution sessions, lead events, and conversion webhooks. | Inferred | High | `apps/web/hooks/use-mobile.ts` |
| Billing/payment/subscription surface is not detected. | Inferred | High | None |
