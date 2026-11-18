# Automated code review

Two layers, and they are not the same thing.

| | Where | What starts it | Guarantee |
| --- | --- | --- | --- |
| **GitHub review** | `.github/workflows/claude-code-review.yml` | the `pull_request` event | **deterministic** — GitHub runs the workflow |
| **Local review** | `mattpocock-skills:code-review` before `gh pr create` | the agent decides, steered by `CLAUDE.md` | **not guaranteed** — a model's judgement |

The local one catches things before a PR exists and costs a round trip less.
The GitHub one is the one that always happens.

## What the GitHub review does

Runs on `opened`, `synchronize`, `ready_for_review` and `reopened`, so a new
push to an open PR gets a new review of the new commit. `concurrency` with
`cancel-in-progress` cancels the in-flight review when another push lands, so
no verdict is posted about code that has already been replaced. Each comment
opens with `AI code review — commit <sha>` so it is obvious which commit it
describes.

It posts one comment grouping findings as **Critical**, **Important** and
**Informational**, and posts even when it finds nothing. It never edits code.
The prompt tells it not to repeat what ESLint, the typechecks, Vitest, Jest,
Playwright or CodeQL already report.

It runs the `mattpocock-skills:code-review` skill itself — installed on the
runner through `plugin_marketplaces` and `plugins` — not a re-implementation
of it. The prompt overrides one part of that skill: its own instructions let
it skip a PR it judges trivial, or one that already carries a comment from a
previous review. Both are wrong here, so both are overridden.

## Cost

Nothing beyond what already exists, which is why it is built this way:

- **Runner**: GitHub-hosted standard runner. Free for public repositories, and
  this repository is public.
- **Model**: authenticated with `CLAUDE_CODE_OAUTH_TOKEN`. Anthropic's own
  documentation is explicit — "If you authenticate with an OAuth token, runs
  use your Claude subscription instead of API billing"
  ([github-actions](https://code.claude.com/docs/en/github-actions)). It draws
  on the existing subscription's quota.
- There is deliberately **no** `ANTHROPIC_API_KEY` in the workflow. Adding one
  would move the cost to Claude API billing.
- `--model claude-sonnet-5-5` and `timeout-minutes: 20` cap what a single run
  can consume, with `concurrency` cancelling a run the next push supersedes.
  There is deliberately no `--max-turns`: Anthropic's documentation still
  lists that flag, but the current Claude Code CLI does not have it
  (2.1.327 offers `--max-budget-usd` instead) and an unknown option aborts
  the run. One review per commit, never a loop: the workflow does not trigger
  on comments, and it never pushes.

Heavy quota use still shows up as subscription rate limiting, not as a bill.
If reviews start hitting limits, lower `timeout-minutes` or narrow the
triggers.

## One-time setup

Needed once, by a repository admin, and never again:

```bash
claude setup-token                      # prints a long-lived OAuth token
gh secret set CLAUDE_CODE_OAUTH_TOKEN   # paste it when prompted
```

The token is tied to the subscription of whoever runs `claude setup-token`.
Nothing reads it except the workflow; it is never echoed, and the workflow
fails loudly rather than quietly passing when it is absent.

The `anthropics/claude-code-action` step authenticates to GitHub as the Claude
GitHub App by default. If the app is not installed on this repository, install
it from <https://github.com/apps/claude>.

## Limits

- **Fork pull requests are not reviewed.** GitHub withholds secrets from runs
  triggered by a fork PR, so the job is skipped by an `if` on the head repo.
  It is skipped, not passed: a skipped job never reports success. The fix for
  this is `pull_request_target`, which would run with repository secrets in
  the context of untrusted code, and it is deliberately not used.
- **Draft PRs** are reviewed from the moment they are marked ready, and on any
  push while in draft.
- A review that cannot run **fails the job**. There is no path where the check
  is green without a review of the current commit having completed.

## Making it a required check

Not required yet, on purpose: a required check is added after the workflow has
proven itself on real pull requests, not before. Once a few PRs have been
reviewed cleanly, add **AI code review / Claude review** to the ruleset on
`main` alongside the three existing required checks.

Think about forks before doing it: with the job skipped on fork PRs, a
required check would block every external contribution. For a repository with
no external contributors that is not a problem; the day there is one, it is.
