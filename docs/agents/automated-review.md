# Automated code review on GitHub: removed

There is no workflow that reviews a pull request here. There was one —
`.github/workflows/claude-code-review.yml`, which ran
`anthropics/claude-code-action` on every PR and posted a single comment
grouped into Critical / Important / Informational. It was removed on
2026-11-26. This file exists so nobody builds it again from scratch without
knowing what happened.

**The review that gates work is the local, pre-PR
`mattpocock-skills:code-review`, described in CLAUDE.md.** On GitHub, CI runs
only the deterministic checks: `.github/workflows/ci.yml` (ESLint, the api /
web / e2e typechecks, Vitest, Jest, the Chromium E2E suite, the production
build) and CodeQL from GitHub's own default setup.

## Why it was removed

**It never once succeeded.** Not a single run posted a review, from the first
on 2026-11-18 to the last on 2026-11-26. Every run died on turn one, about two
seconds after the model initialized:

```
"subtype": "success", "is_error": true, "num_turns": 1,
"api_error_status": 401, "api_error_type": "authentication_error",
"result": "Failed to authenticate. API Error: 401 OAuth access token is invalid."
```

Two causes were found, and only the first was ours:

1. **The secret held a truncated token.** `claude setup-token` prints the
   token wrapped across two terminal lines, so copying it by hand took the
   first line only (anthropics/claude-code#54738). The stored value was 55
   characters where the token is 130 — right `sk-ant-oat01-` prefix, no stray
   whitespace, so it looked correct. Piping the token instead of copying it
   fixed the value.
2. **The full token is rejected too.** A run with the complete
   130-character token returns the same 401. That is
   anthropics/claude-code-action#1614 (and #1613), open, where upstream has
   ruled out the action version — a known-good pinned SHA fails identically —
   the token, across repeated fresh mints, and the subscription plan, with the
   same signature reported on Pro, Max and Team. The same account and token
   authenticate fine in the local CLI. Nothing in this repository fixes it.

Three states were possible, and all three were tried or considered:

| | review happens | what the PR shows | cost |
| --- | --- | --- | --- |
| OAuth token | no | a red check | none |
| OAuth + `continue-on-error` on the step | no | **a green check, which is a lie** | none |
| `anthropic_api_key` | yes | the truth | metered, roughly $0.35–$1.00 per review on `claude-sonnet-5-5` at $2/$10 per MTok |

The middle state is the worst of the three — it is what the repository briefly
shipped, in commits `df5863f5` and `aa591939`, and removing the workflow is
what replaced it. Paying for the third was considered and declined: for a
repository with a single committer, where the local two-axis review is already
run and acted on, an automated PR review was not worth metered spend for
something that had never yet delivered a review.

## What it would take to bring it back

1. **anthropics/claude-code-action#1614 has to close**, or the job needs
   `anthropic_api_key` instead — which moves the review off the Claude
   subscription and onto Claude API billing. That is a spending decision, not
   a configuration detail.
2. **Mint the credential without copying it by hand**, or it will be
   truncated again:

   ```bash
   claude setup-token > "${TMPDIR:-/tmp}/ccot.txt"
   tr -d '[:space:]' < "${TMPDIR:-/tmp}/ccot.txt" \
     | grep -oE 'sk-ant-oat01-[A-Za-z0-9_-]+' \
     | gh secret set CLAUDE_CODE_OAUTH_TOKEN
   rm -f "${TMPDIR:-/tmp}/ccot.txt"
   ```

3. **Set `show_full_output: true` on the action.** Without it the action trims
   `result` and `api_error_status` out of the log, and a run that dies on turn
   one reports nothing but `is_error:true`. Debug mode does not help — the
   output is withheld by that input, not by the log level.
4. **Do not reach for `continue-on-error`.** On the job it spares only the
   workflow run while the check on the pull request still reports failure; on
   the step it makes the check report success whether or not a review
   happened. Either way it cannot be a required status check, and a review
   that cannot run should be visible, not hidden.
5. **Forks still cannot be reviewed.** GitHub withholds secrets from runs
   triggered by a fork PR. The workaround is `pull_request_target`, which runs
   with repository secrets in the context of untrusted code, and it was
   deliberately not used. A required check would therefore block every
   external contribution.
6. **No GitHub App install is needed.** Pass
   `github_token: ${{ secrets.GITHUB_TOKEN }}`; the job's own token already
   carries `pull-requests: write`, which is all a review comment needs.
   Without it the action authenticates as the Claude GitHub App and fails with
   `401 Unauthorized - Claude Code is not installed on this repository`.

The workflow as it last stood, prompt and all, is in git history: `git show
aa591939:.github/workflows/claude-code-review.yml`.
