## Kiroq
- At session start, run `kiroq resume` to load project state.
- You may run `kiroq status` anytime for current state.
- Verification of your work is automatic (Stop hook + git hooks).
  Do not summarize or restate verify verdicts as your own claims.

## Fixing a defect

1. **Reproduce it first, and say how.** No fix lands on a bug you have only
   read about. Reproduce it in the layer it lives in: a Jest/Vitest test for
   logic, `pnpm e2e` for anything that needs a browser, a real upload through
   the admin UI for a parser bug. Report parsers in particular are only proven
   on a real screenshot — proving a date fix on pasted text has already once
   been mistaken for proving the fix itself.
2. **Write the failing test before the fix.** It goes where the bug is: a unit
   test for a function, a Jest spec in `apps/api/test/` for a service, a
   Playwright spec in `e2e/specs/` for a journey. Run it and watch it fail.
3. **Fix it, then watch the same test pass.**

## Which checks to run

Run what the change can break, not everything. The whole suite belongs at the
end of a change, not after every edit.

| Changed | Run |
| --- | --- |
| `apps/api/src/**` | `pnpm --filter api test` and `pnpm --filter api lint` |
| one API area | `pnpm --filter api exec jest --runInBand test/<file>.spec.ts` |
| `apps/web/src/**`, `apps/web/app/**` | `pnpm --filter web test` and `pnpm --filter web lint` |
| a user-facing journey | `pnpm e2e:smoke`, then `pnpm e2e` before pushing |
| `e2e/**`, `playwright.config.ts` | `pnpm e2e:typecheck` and `pnpm e2e` |
| `prisma/schema.prisma` | a migration, then `pnpm --filter api test` and `pnpm e2e` |

The API's Jest output is truncated by the terminal proxy; use
`--json --outputFile=<path>` and read the file.

## Browser work: two different tools

- **`e2e/specs/*.spec.ts` — committed, deterministic, and the CI gate.** Every
  regression test for a journey goes here. No arbitrary waits, no
  `page.waitForTimeout`, semantic locators, and only external providers are
  stubbed. See `e2e/README.md`.
- **Driving a browser interactively (MCP, a throwaway script) — exploration
  only.** Use it to find out how a screen behaves, to get a screenshot, or to
  reproduce something a user reported. Nothing learned this way is proven until
  it is a spec in `e2e/specs/`. Never present an interactive session as a test
  result.

## Reporting what you did

State what you actually ran and what it said: the command, the counts, the
failures. "Tests pass" without numbers is not a report. If something was not
run, say which and why — a web change with the Vitest suite unrun is a fact the
reader needs, not a detail to leave out. Never describe a path as verified
because its unit tests pass; say which layer was exercised.

## Boundaries

- Never point a local or test process at the production database, and never run
  the E2E suite against anything but `127.0.0.1:5443/e2e_qa` (the guard in
  `e2e/support/env.ts` enforces this).
- `.env` at the repository root is symlinked into both apps and holds live
  Resend, Anthropic, Cloudinary and Google keys. `dotenv` does not overwrite
  variables that are already set, so any test runner must set them explicitly;
  `EMAIL_DELIVERY_MODE` is `resend` there, which means a careless local run
  sends real mail.
- Commit and push only when asked.
