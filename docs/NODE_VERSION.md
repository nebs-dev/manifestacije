# Which Node version runs where

Short version: the repository pins Node for **development and CI only**. The
two deployed runtimes are pinned in their own dashboards, on purpose.

| Where | Pinned by | Value |
| --- | --- | --- |
| Local development | `.nvmrc` (`nvm use` in the repo) | `24` |
| CI | `NODE_VERSION` in `.github/workflows/ci.yml` | `24.22.2` |
| Web (Vercel) | Vercel project setting | `24.x` |
| API (Railway / nixpacks) | **unset — see below** | platform default |

## Why there is no `engines.node`

It was briefly added and then removed, because it is the wrong lever here:

- **nixpacks reads `engines.node` before `.nvmrc`.** Adding an `engines`
  field therefore takes the decision away from `.nvmrc` rather than
  reinforcing it.
- **nixpacks accepts only a major version.** A range such as `>=22.20.0` is
  not one, so it is not honoured and the build silently falls back to the
  platform default — the opposite of pinning.
- **Vercel also reads `engines.node`**, so a wrong value there could override
  a web runtime that is already correct in the project settings.

A field that is ignored by one platform and quietly overrides another is
worse than no field. `.nvmrc` holds a bare major for the same reason: if a
build ever does read it, `24` is a value the builder can use, while a patch
version like `24.22.2` is not.

## Pinning the API runtime (not done — needs the Railway dashboard)

The API's Node version is currently whatever nixpacks defaults to. It has
never been declared, so this is not a regression, but it should be made
explicit:

> Railway → the API service → **Variables** → add
> `NIXPACKS_NODE_VERSION` = `24`
> (a major, not `24.22.2` — nixpacks rejects patch versions)
>
> Then redeploy and confirm with `node -v` in the deploy logs or a shell.

`NIXPACKS_NODE_VERSION` has the highest precedence of the three mechanisms,
so once it is set neither `.nvmrc` nor an `engines` field can change it.

Check first that the nixpacks version Railway is running supports Node 24;
its supported list depends on the builder release. If it does not, use `22`
and change `.nvmrc` and `NODE_VERSION` in CI to match.

## Verified compatibility

The whole suite was run on three majors before any of this was chosen:

| Node | API tests | Web tests | lint + typecheck | E2E |
| --- | --- | --- | --- | --- |
| 22.13.0 | 665 pass | 539 pass | clean | not run |
| 24.22.2 | 665 pass | 539 pass | clean | 50 pass |
| 26.5.0 | 665 pass | 539 pass | clean | 50 pass |

Nothing in `apps/api` or `apps/web` needs anything newer than Node 18, and
that is deliberate: `apps/api/src/common/ssrf.ts` uses a plain
`AbortController` rather than `AbortSignal.any` (Node 20.3+) so that a
security fix cannot raise the floor of a runtime this repository does not
control.
