# Issue tracker

Issues for this repo live in **GitHub Issues** on `nebs-dev/manifestacije`,
read and written with the `gh` CLI. No other tracker is in use; do not
introduce one.

## Reading an issue

```bash
gh issue view <number> --json number,title,body,labels,state,comments
gh issue list --state open --limit 30
```

A commit or branch that names `#123`, `Closes #45` or similar is pointing at
an issue in this repo. That is where `code-review` looks for the spec it
reviews the diff against.

## Writing

```bash
gh issue create --title "<title>" --body "<body>"
gh issue comment <number> --body "<body>"
```

## Pull requests

PRs are **not** a request surface here: they are the output of work, not an
inbox. Do not treat an open PR as an issue to triage.

Branch protection requires a PR into `main` plus the three required status
checks, so a direct push to `main` is refused. Work goes on a branch, then
through `gh pr create`.

## Labels

The repo uses GitHub's default label set (`bug`, `enhancement`,
`documentation`, `question`, `wontfix`, …). The `triage` skill ships its own
label vocabulary; none of it is configured here and no labels were created
for it, because `triage` is not part of the workflow this repo adopted. Keep
using the existing labels.
