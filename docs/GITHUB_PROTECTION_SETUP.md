# GitHub setup: branch protection and code scanning

Steps that need the repository's **Settings**, which is dashboard work rather
than anything this repository can do to itself. Written for
`github.com/nebs-dev/manifestacije`, which is public and on GitHub Free — both
Rulesets and CodeQL default setup are available on that plan for a public
repository, at no cost.

Do them **in this order**. Steps 1 and 2 must happen before step 3, because a
ruleset can only require a check GitHub has already seen run.

---

## 1. Let CI run once on a pull request

Open the pull request for `fix/ssrf-egress-guard` and wait for the workflow to
finish. The three jobs register under these exact names:

| Job | Check name as GitHub shows it |
| --- | --- |
| `checks` | `Typecheck, lint and unit tests` |
| `build` | `Production build` |
| `e2e` | `E2E (Chromium, full suite)` |

Copy them exactly when you get to step 3 — a ruleset that names a check which
never reports will block every merge forever, with no way to satisfy it.

## 2. Turn on CodeQL (default setup)

> Settings → **Code security** → **Code scanning** → **CodeQL analysis** →
> *Set up* → **Default**

Review the languages it proposes — it should find JavaScript/TypeScript — then
**Enable CodeQL**.

Default setup is the right choice here: it needs no workflow file to maintain,
it picks its own query suite, and the project has nothing unusual about its
build that a custom workflow would be needed for. Do not add a
`codeql-analysis.yml`; it would duplicate the scans and double the minutes.

The first scan starts immediately and takes a few minutes. Results appear under
**Security → Code scanning**.

**Before making CodeQL a required check**, look at what the first scan reports.
Default setup only fails a pull request for alerts it considers new and of high
enough severity, but if the existing code already has findings it is better to
see them, triage them, and only then require the check. Otherwise the first
genuine finding blocks an unrelated release.

Suggested sequence: enable now → read the findings → fix or dismiss them →
*then* add `CodeQL` to the required checks in step 3.

## 3. Protect `main` with a ruleset

> Settings → **Rules** → **Rulesets** → **New ruleset** → *New branch ruleset*

- **Name**: `main protection`
- **Enforcement status**: `Active`
- **Target branches**: Add target → *Include by pattern* → `main`

Enable these rules:

- [x] **Restrict deletions**
- [x] **Block force pushes**
- [x] **Require a pull request before merging**
  - **Required approvals: `0`** — you are the only developer, and any higher
    number is a rule you cannot satisfy on your own pull requests.
  - [x] Dismiss stale pull request approvals when new commits are pushed
  - [ ] Require review from Code Owners — leave off, there are none
- [x] **Require status checks to pass**
  - [x] Require branches to be up to date before merging
  - Add each check by its exact name from step 1:
    - `Typecheck, lint and unit tests`
    - `Production build`
    - `E2E (Chromium, full suite)`
    - `CodeQL` — only after step 2's findings are triaged

Leave **Bypass list** empty. Adding yourself to it means the protection stops
applying to the one person it is there to protect.

### What this changes about releasing

Both Railway and Vercel deploy on a push to `main`. After the ruleset is
active, `main` can only be reached through a pull request whose checks have
passed — which is the point, but it does mean no more direct pushes to `main`,
including hotfixes. The flow becomes: branch → pull request → green → merge →
deploy.

If you ever need to bypass this in an emergency, set the ruleset's enforcement
to `Disabled`, merge, and set it back to `Active`. That is visible in the audit
log, which a standing bypass entry is not.

### Do not enable yet

Leave the ruleset `Disabled`, or do not create it, until both pull requests in
this release have merged. Creating it mid-release would require checks on
branches that were opened before the workflow existed.

---

## What is deliberately not here

- **No paid tools.** No CodeRabbit, no third-party scanners, no extra services.
  CodeQL default setup and Rulesets are both free on a public repository.
- **No `pull_request_target`.** The workflow uses `pull_request`, so a fork's
  pull request runs with a read-only token and no access to secrets.
- **No secrets in CI at all.** The suite stubs the AI provider locally, logs
  email instead of sending it, and leaves the upload and geocoding keys blank,
  so there is nothing a fork's run could reach for.
- **No required reviewer.** A single-developer repository cannot satisfy one.
