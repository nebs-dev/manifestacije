# Next Actions

| Item | Status | Confidence | Evidence |
| --- | --- | --- | --- |
| Review public /b, report, robots, sitemap, llms, and discovery routes for crawler/human parity, 404 behavior, and unpublished-data exposure. | Inferred | ▮▮▮ High | `apps/api/src/public-feed/public-feed.controller.ts` |
| Check required production env var coverage between committed examples and deployment config. | Inferred | ▮▮▯ Medium | `.env`<br>`.env.example` |
| Run target test/build commands manually or re-run Kiroq with --run-tests evidence. | Open question | ▯▯▯ Unknown | `apps/api/package.json`<br>`apps/web/package.json`<br>`package.json`<br>`packages/shared/package.json` |
