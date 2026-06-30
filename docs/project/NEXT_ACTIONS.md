# Next Actions

| Item | Status | Confidence | Evidence |
| --- | --- | --- | --- |
| Review public /b, report, robots, sitemap, llms, and discovery routes for crawler/human parity, 404 behavior, and unpublished-data exposure. | Inferred | High | `apps/api/src/public-feed/public-feed.controller.ts` |
| Check required production env var coverage between committed examples and deployment config. | Inferred | Medium | `.env`<br>`.env.example` |
| Target test command passed: pnpm test. Add smoke/sample checks for critical flows if not covered. | Fact | High | `package.json` |
