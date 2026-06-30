# Assumptions

| Item | Status | Confidence | Evidence |
| --- | --- | --- | --- |
| Generated memory is based on static repository evidence only; runtime correctness is not proven. | Inferred | Medium | `apps/api/nest-cli.json`<br>`apps/api/package.json`<br>`apps/api/tsconfig.json`<br>`apps/web/next.config.js`<br>`apps/web/package.json`<br>`apps/web/tsconfig.json`<br>`package.json`<br>`packages/shared/package.json`<br>`packages/shared/tsconfig.json`<br>`pnpm-workspace.yaml` |
| Project appears to publish crawlable public discovery pages. | Inferred | High | `apps/api/src/public-feed/public-feed.controller.ts` |
| Billing/payment/subscription surface is not detected. | Inferred | High | None |
