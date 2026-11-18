---
name: retro-after-incident
description: "Run a retrospective on how a defect got through, and leave behind a deterministic guard that would have caught it. Use after a production incident, a serious regression, a critical defect that the tests or the code review missed, or the second time the same class of mistake appears. Do not use for ordinary bugs caught before merge, for a first-time mistake with no pattern behind it, or for routine work."
---

# Retro after an incident

The plugin's own `mattpocock-skills:retro` carries
`disable-model-invocation: true`, so nothing can start it on your behalf — it
is reserved for `/mattpocock-skills:retro`, typed by a person. That is the
right default for a retrospective on a whole session. It is the wrong default
for the narrow case this skill covers: something reached production, or got
past review and the test suite, and the repo should not be left able to let
the same thing through again.

So this skill applies that methodology to one incident, automatically, and is
deliberately narrow. **Do not invoke it for an ordinary bug.** A defect caught
by a test, by CI, or during review is the system working.

Invoke it when one of these is true:

- a production incident, or anything that reached production and should not have
- a serious regression in behaviour that used to work
- a critical defect that the test suite and the code review both missed
- the **second** appearance of the same class of mistake

When the trigger is a whole working session rather than one incident, stop and
tell the user to run `/mattpocock-skills:retro` instead. This skill does not
replace it.

## Process

### 1. Establish what actually happened

Write the sequence down before explaining it: what changed, what broke, how it
was noticed, and how long it was live. Read the primary sources — the diff,
the failing output, the production response, the CI run. No step of this is
from memory.

### 2. Find the gap, not the mistake

The mistake is already known. The question is what in the repo allowed it
through. Take the categories from the plugin's `retro` skill, which stays the
source of this method; the ones that have earned their place here:

- **Automated checks**: what check would have caught this? Read the repo's
  existing check commands first (`package.json` scripts, `.github/workflows/ci.yml`),
  because a check that exists but is mis-wired is a better finding than a new
  one. A real example from this repo: `apps/web`'s lint script was
  `next lint || tsc --noEmit`, so a passing lint skipped the typecheck
  entirely and TypeScript errors reached CI that a local `lint` called clean.
- **Coding standards**: classify the violation first. A **mechanical** one — a
  fixed syntactic pattern, a banned API, an import shape, a file-location rule
  — gets a deterministic check, not a paragraph. Reserve `CLAUDE.md` for
  genuine judgement calls that no guardrail could substitute for.
- **Navigation**: did the work go wrong because the relevant code or document
  was hard to find? A pointer in `docs/agents/domain.md` is cheaper than
  rediscovering it.
- **Tool economy and information access**: was the evidence that would have
  settled this unavailable, or too expensive to get?

### 3. Leave a deterministic guard

A retro that ends in prose has not finished. The output is one of these,
ranked by preference:

1. a test — a Vitest or Jest spec, or a Playwright spec in `e2e/specs/`
2. a lint rule, or a check wired into an existing `lint` script
3. a typecheck that now covers what it did not
4. a CI step in `.github/workflows/ci.yml`
5. tooling that makes the failure impossible rather than detectable

Only when none of those can express the finding does it become a line in
`CLAUDE.md`, and then say plainly why no guard was possible.

Prove the guard: run it against the broken state and watch it fail, then
against the fixed state and watch it pass. A guard that was never seen failing
is not known to guard anything. This repo's defect procedure in `CLAUDE.md`
says the same thing about fixes, and it applies to guards too.

### 4. Report

Three short sections: what happened, which gap let it through, and the guard
that now closes it — naming the file and the command that exercises it. No
narrative, no blame, no recommendations without a guard attached.
