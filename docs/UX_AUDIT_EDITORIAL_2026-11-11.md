# Editorial UX audit — the daily event-entry workflow

**Date:** 11 November 2026 · **Branch:** `chore/e2e-playwright-foundation` · **Status:** assessment only, nothing redesigned or implemented.

## How this was measured

A real browser (Chromium 1440×900 and a Pixel 7 profile) against local
**production builds** of `apps/api` and `apps/web`, on a disposable PostgreSQL,
with synthetic admin and organizer accounts. Anthropic was replaced by a local
stub; e-mail ran in `log` mode; the Cloudinary and Google keys were blank.
No production data was read or written and no mail was sent.

Every click, field and page load below was counted by the walkthrough itself
(`pnpm e2e:audit`), not estimated from reading the code. Raw numbers are in
`docs/ux-audit/MEASUREMENTS-desktop.md` and `MEASUREMENTS-phone.md`;
screenshots are in `docs/ux-audit/`.

## What the workflow costs today

| Journey | Clicks | Fields typed | Page loads |
| --- | ---: | ---: | ---: |
| Source → parse → review → correct → publish (2 candidates, 1 published) | 6 | 2 | 3 |
| Manual event entry (admin) | 0 | 4 | 2 |
| Open and edit a published event | 2 | 1 | 4 |
| Phone: reach a source and open a candidate | 6 | 1 | 4 |

The click counts look small, and they are — the costly part of this workflow is
not clicking, it is **scrolling and reading**. That is what the five findings
below are about.

## The five biggest sources of friction

### 1. Reviewing a candidate is a two-viewport scroll, in half the screen

`/admin/sources/[id]` — [screenshot](ux-audit/01-source-review-above-the-fold.png), [expanded card](ux-audit/02-candidate-expanded.png)

Measured:

- `Parsirani kandidati` — the actual work — begins **1037px down a 900px
  viewport**. Every visit starts by scrolling past the source summary and the
  full "Dopuni i ponovno parsiraj" panel (a textarea plus a four-image
  dropzone), tools that are used on a minority of sources.
- Each candidate arrives **collapsed**. Its fields and its Kreiraj / Ignoriraj
  buttons do not exist in the DOM until it is expanded: one click per
  candidate before any work can start.
- An expanded candidate is **2 viewports tall**, with its action footer at the
  bottom. So each one is: expand → scroll ~1800px → act → scroll back.
- Expanding **does not widen the card**: it stays **568px inside a 1152px
  two-column grid**, with the neighbouring column left blank. Half the screen
  is unused while the card is roughly twice as tall as it needs to be.

For a programme source with eight candidates that is eight expands and about
sixteen viewport-scrolls before anything is published.

**Before → after.** Put the candidate list first and collapse the source
summary and supplement panel behind a header. Make an expanding candidate span
the full grid width, so its fields lay out in two or three columns instead of
one. Keep the Kreiraj / Ignoriraj footer sticky to the bottom of the card while
it is open.

### 2. The source is not visible beside the candidate it produced

`/admin/sources/[id]`

The raw text the parser read sits behind a collapsed "Neobrađeni tekst izvora"
panel, above the candidates. Checking a parsed date against the source means
opening that panel, reading it, holding the date in mind, and scrolling back
down to the candidate — for every field in doubt.

This matters more than any other item here, because verifying parsed dates
against the source is the one correctness task the editor cannot delegate. The
parser already quotes its evidence (`dateText`, `timeText`) and already labels
what it could not confirm; none of that is next to the field it describes.

**Before → after.** A source pane pinned beside the open candidate, with the
parser's own quoted `dateText` / `timeText` shown inline next to the date and
time fields. A warning should point at the field it is about.

### 3. "Kreiraj događaj" quietly doubles the review

candidate card footer

`Kreiraj događaj` creates the event as `PENDING_REVIEW`
(`apps/api/src/admin/admin.service.ts:952`). The editor who has just read the
source, corrected the fields and accepted the candidate must then find the same
event again in `/admin/events/pending` and approve it a second time.
`Kreiraj i objavi` publishes outright. The two buttons sit side by side and
nothing on screen says that the first one doubles the work.

**Before → after.** Either relabel so the consequence is visible ("Spremi kao
nacrt — ide ponovno na pregled"), or make the reviewed candidate publish
directly and keep the draft as the secondary action. *Which of these is right
depends on whether the queue is deliberately a second pair of eyes — worth
asking Vanesa before changing it.*

### 4. No bulk actions where the volume is

`/admin/sources/[id]`

The events table already has bulk selection with category, status, date-shift
and delete, and the pending queue inherits it. Parsed candidates have none — a
source listing a season's programme is worked one card at a time, even when
every candidate shares a venue, a city and a category.

**Before → after.** Checkbox selection on the candidate list with "ignore
selected", "set category for selected" and "create and publish selected", plus
the field-propagation that makes it useful ("apply this city to all
candidates in this source").

### 5. Edits are lost silently, and four location fields disagree

`/admin/events/[id]` and the candidate card

- There is **no unsaved-changes guard** anywhere in the admin (no
  `beforeunload`, no dirty check). Following a breadcrumb or a sidebar link
  after editing discards everything typed, without a prompt.
- One candidate carries **four overlapping location fields**: `Grad`,
  `Lokacija / venue`, `Adresa`, and `Precizna lokacija (koordinate)`. Which one
  the public page uses is not stated anywhere on the screen, so the editor
  keeps them consistent by hand and by habit.

**Before → after.** A dirty-state guard on both admin forms. One location
control that resolves to city + address + coordinates together, with the
others shown as its result rather than as four independent inputs.

## The one with the highest expected return

**Finding 1 — the candidate review layout.**

It is the only item on the list that is unconditional: it costs the editor
scrolling on *every* candidate of *every* source, regardless of how they work
or which buttons they prefer. It is also the cheapest and the safest — grid
column span, panel order and a sticky footer are CSS and JSX layout, with no
change to the API, the parser, or what any button does. Nothing about it needs
a decision from anyone; it can be reverted by reverting one commit.

Findings 2 and 3 are likely worth more per event, but each needs a product
decision first (how much source context to show; whether the pending queue is
deliberately a second pair of eyes). Finding 1 needs no such decision, so it is
where to start.

**Not recommended yet:** anything that changes what `Kreiraj događaj` does, or
that removes the pending queue, until it is known whether that second pass is
intentional.

## Other observations from the walkthrough

- **Parsing is synchronous.** The source form holds the page with "Ne
  zatvarajte stranicu" until the model answers, with no progress indication and
  no way to queue a batch. A long programme page therefore blocks the editor.
- **Missing-field badges do not point anywhere.** `Nedostaje: city` is shown on
  the card, but the field it refers to is neither highlighted nor focused.
- **Two different city controls.** `/admin/events/new` uses a dropdown plus a
  free-text "Novi grad" box; `/admin/events/[id]` uses the geocoding
  autocomplete. Same field, two mental models.
- **Form fields have no programmatic labels.** Across the organizer forms, the
  admin create form and the schedule editor, `<Label>` is rendered without
  `htmlFor` and the inputs without `id`. The label is visible but not
  associated, so a screen reader announces an unlabelled field. The admin
  create form's "Naziv" input has no placeholder either, so it has no
  accessible name at all. This is also why the E2E suite reaches these fields
  by placeholder rather than by label.
- **Phone.** Both source forms stack above the table on `/admin/sources`, so
  the list of recent sources is about two screens down; an expanded candidate
  becomes one long column with its actions at the very bottom
  ([screenshot](ux-audit/03-phone-candidate.png)). Nothing is broken — no
  horizontal overflow anywhere, the drawer works — but triage on a phone is
  mostly scrolling.
- **Inconsistent aria-label.** The calendar's month arrows read "Sljedeći
  mjesec" in one place and "Sljedeci mjesec" (no diacritic) in another
  (`calendar-explorer.tsx:241` and `:447`).

## One thing found that is not a UX issue

`apps/api/src/common/safe-url.ts` validates only the URL *scheme*. It does not
filter hosts, so a submitted `sourceUrl` pointing at a loopback or private
address is fetched by the API server. The E2E suite relies on this to serve
itself a fixture page, which is how it was noticed. It is outside the scope of
this task and nothing here fixes it, but it is worth a look.

## Reproducing this audit

```bash
pnpm e2e:db:up
pnpm e2e:audit        # desktop + phone, writes MEASUREMENTS-*.md and screenshots
```

Output lands in `e2e/.artifacts/audit/`. The audit is deliberately **not** part
of `pnpm e2e` or the CI gate: it measures and screenshots, it does not assert.
