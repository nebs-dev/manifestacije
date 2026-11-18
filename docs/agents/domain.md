# Domain docs

Single-context repo: one web app, one API, one database.

There is **no** `GLOSSARY.md` and **no** `docs/adr/` tree, and none should be
created. The project already documents itself, and skills that look for those
files handle their absence. Read these instead, in this order:

| Need | Read |
| --- | --- |
| How to work in this repo: defect procedure, which checks to run, boundaries | `CLAUDE.md` (root) |
| What exists today, feature by feature | `docs/project/FEATURE_STATUS.md` |
| Architecture, data flow, deployment shape | `docs/project/TECHNICAL_OVERVIEW.md` |
| Data model | `docs/project/DB_MODELS.md` |
| API surface | `docs/project/API_REFERENCE.md`, `docs/project/API_ROUTES.md` |
| Known security exposure | `docs/project/SECURITY_RISKS.md` |
| Browser-test rules and fixtures | `e2e/README.md` |
| Deployment and environment variables | `DEPLOYMENT.md`, `.env.example` |

`docs/project/*` is generated. Treat it as a map, not as a source of truth to
edit by hand, and never hand-edit it as part of a feature change.

## Words to keep as they are

Croatian is the product language and appears in code, routes and tests. This
is a short naming note, not a glossary to grow: keep these terms as they are
rather than translating them.

- **događaj / event** — one happening, with one or more **occurrences**
- **kandidat** — a parsed candidate from a source, before an editor decides
- **izvor / source** — a page, screenshot or email an event was discovered in
- **organizator** — the account that submits and claims events
- **objavljen / skica** — published / draft, the editorial statuses
- Public routes are Croatian: `/eventi`, `/kalendar`, `/gradovi`, `/regije`
