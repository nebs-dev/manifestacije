# Which Node version runs where

Short version: the repository pins Node for **development and CI only**. The
two deployed runtimes are pinned in their own dashboards, on purpose.

| Where | Pinned by | Value |
| --- | --- | --- |
| Local development | `.nvmrc` (`nvm use` in the repo) | `22` |
| CI | `NODE_VERSION` in `.github/workflows/ci.yml` | `22.23.4` |
| Web (Vercel) | Vercel project setting | `24.x` |
| API (Railway) | railpack's own detection | **22.23.4**, read from the build log |

## How the API's version was established

Not by assumption. The Railway build log for the `manifestacije` service in
project `exquisite-wonder` says:

```
⚠ No node package manager detected, using npm
↳ Detected Node
node │ 22.23.4 │ previous installed version (22)
```

Two things worth knowing from that:

- **Railway builds this service with `railpack`, not nixpacks.** Advice about
  `NIXPACKS_NODE_VERSION` and nixpacks' `engines`-over-`.nvmrc` precedence
  does not apply to it. An earlier version of this document said it did; it
  was wrong.
- **The builder does not detect pnpm** and falls back to npm, even though this
  is a pnpm workspace. That works today and is out of scope here, but it is
  worth fixing separately.

`.nvmrc` and CI therefore both say 22, which is what the API already runs.
Nothing about the deployed runtime changes.

## Why there is no `engines.node`

An `engines.node` field was briefly added and then removed. Vercel reads it,
and the web project's runtime is already set correctly to 24.x in its own
settings — so the field could only override a correct value with a guess. A
range such as `>=22.20.0` is not a version any builder can pin to anyway.

The deployed runtimes are each pinned where they are actually decided: Vercel
in its project settings, Railway by its builder's detection. The repository
pins only what it owns, which is development and CI.

## If you later want the API on Node 24

Verified to work (see the table below), but it is a deliberate change rather
than a side effect of a test branch. Do it on its own:

> Railway → the `manifestacije` service → **Variables** →
> `RAILPACK_NODE_VERSION` = `24`
>
> then redeploy and re-read the build log to confirm.

Change `.nvmrc` and `NODE_VERSION` in CI to match in the same change, so CI
keeps testing what production runs.

## Verified compatibility

The whole suite was run on three majors before any of this was chosen:

| Node | API tests | Web tests | lint + typecheck | E2E |
| --- | --- | --- | --- | --- |
| 22.13.0 | 665 pass | 539 pass | clean | not run |
| **22.23.4** (production) | 665 pass | 539 pass | clean | 28 Chromium pass |
| 24.22.2 | 665 pass | 539 pass | clean | 50 pass |
| 26.5.0 | 665 pass | 539 pass | clean | 50 pass |

Nothing in `apps/api` or `apps/web` needs anything newer than Node 18, and
that is deliberate: `apps/api/src/common/ssrf.ts` uses a plain
`AbortController` rather than `AbortSignal.any` (Node 20.3+) so that a
security fix cannot raise the floor of a runtime this repository does not
control.
