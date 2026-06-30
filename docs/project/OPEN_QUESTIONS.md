# Open Questions

| Item | Status | Confidence | Evidence |
| --- | --- | --- | --- |
| Is billing intentionally out of scope? | Open question | Medium | `apps/api/package.json`<br>`apps/web/package.json`<br>`package.json`<br>`packages/shared/package.json` |
| Are public crawlable pages production-ready, including 404 behavior and unpublished-data protection? | Open question | High | `apps/api/src/public-feed/public-feed.controller.ts` |
| Are deployment env vars complete and aligned with .env.example? | Open question | Medium | `.env`<br>`.env.example` |
