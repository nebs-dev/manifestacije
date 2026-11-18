## Kiroq
- At session start, run `kiroq resume` to load project state.
- You may run `kiroq status` anytime for current state.
- Verification of your work is automatic (Stop hook + git hooks).
  Do not summarize or restate verify verdicts as your own claims.

## Agent skills

The five skills below come from the `mattpocock-skills` plugin. The plugin is
installed **per machine, not through this repo**:

```bash
claude plugin install mattpocock-skills@claude-plugins-official
```

A freshly installed plugin loads on the **next** Claude Code session, not the
one that installed it. Only the configuration under `docs/agents/` and this
section are shared through Git — `git pull` does not install anything.

`code-review` collides by name with Claude Code's built-in skill. `/code-review`
is the **built-in** multi-agent reviewer; the plugin's two-axis one is
`mattpocock-skills:code-review`. Name the one you mean. The other four names
are unambiguous.

| Skill | How it fires | When |
| --- | --- | --- |
| `mattpocock-skills:code-review` | model-invocable | before calling any non-trivial change ready |
| `diagnosing-bugs` | model-invocable | any non-trivial bug or regression |
| `tdd` | model-invocable | new business logic, or changing existing behaviour |
| `mattpocock-skills:pr` | model-invocable | writing a PR body |
| `retro` | **manual only** (`/retro`) | after a serious bug, an incident, or a miss that got past the checks |

A retro's output is a **deterministic** guard — a test, a lint rule, a
typecheck, a CI step, better tooling — not another paragraph of instructions.
If the only fix on offer is prose, the finding is not yet understood.

Issue tracker and domain-doc rules the skills read: `docs/agents/issue-tracker.md`,
`docs/agents/domain.md`.

### Review before a PR

Run `mattpocock-skills:code-review` against `origin/main` using the merge-base
(`git diff origin/main...HEAD`) before declaring a non-trivial change ready.
Resolve critical and important findings before handing the work over, and say
what you did not check. Skip it only for a trivial documentation change — a
typo, a link, a reworded sentence. A documentation change that states how the
system behaves is not trivial: its claims can be wrong.

It reviews on two axes in parallel sub-agents — **Standards** (does it follow
this repo's documented rules?) and **Spec** (does it do what the issue asked?)
— and across both it must cover security, authorization, regressions, needless
complexity and missing tests.

Two things it must not do: repeat what a deterministic check already catches,
and claim to have reviewed what it did not read. ESLint, the three typechecks
(api, web, e2e), Vitest, Jest and the Chromium E2E suite run in
`.github/workflows/ci.yml`; CodeQL runs separately, from GitHub's own default
setup, not from a workflow file in this repo.

**This is a local, pre-PR review that a human triggers. Nothing reviews a PR
on GitHub automatically.** CI runs only the deterministic checks.

### Writing the PR

`mattpocock-skills:pr` gives the body's shape (Summary / Evidence / Merge
Danger). On top of its template, a PR of any size here carries:

- **why** the change is needed, not only what it does
- **evidence**: the commands actually run and what they printed. Never a
  number you did not see, never an unrun test called green
- the **code-review outcome**, including findings left unresolved
- **risk and blast radius**, and how to verify or roll back when that is not
  obvious

### What to look hardest at

A change touching any of these gets explicit attention, because each has cost
real damage before:

- editorial decisions and existing events surviving the change
- deduplication and a stable identity for discovery candidates
- date, time and location correctness (`Europe/Zagreb`, all-day, occurrences)
- admin and organizer authorization
- SSRF protection when fetching a source (`apps/api/src/common/ssrf.ts`)
- cache invalidation after a public event changes (`docs/agents/domain.md`
  points at the pieces; the webhook is `apps/web/app/api/revalidate/route.ts`)
- AI call volume and cost

### TDD and debugging

`tdd` applies to event and date parsing, candidate deduplication, editorial
status and approval, auth, API handlers, cache invalidation, and anything
security-sensitive: red → green → refactor. Not for config or docs.

`diagnosing-bugs` is the same discipline as **Fixing a defect** below, which
stays the authority on *where* a test goes for this repo. No fix is written
before the cause is proven.

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
