# Manifestacije.hr — Bug & Request audit (code vs. backlog)

- **Audit date:** 2026-10-09
- **Code baseline:** `main` @ `d137cf26 feat(admin): track event creators` (working tree: only pre-existing `docs/project/*` modifications; no code changed by this audit)
- **Backlog source:** `docs/Manifestacije_Bug_Request_Backlog.md` (33 IDs)
- **Method:** read-only inspection of `apps/api` (NestJS + Prisma), `apps/web` (Next.js 14 App Router), migrations, tests and git history. Unit suites were run locally (mocked, no DB): **API 22 suites / 346 tests passed; web 26 files / 191 tests passed.** No production system, database, email provider, GA4 or Search Console was accessed.

> Green tests are not evidence of correctness for the reported items. Several passing tests **encode the reported behavior** (e.g. `apps/web/src/lib/event-end.test.ts` asserts that an 18:00→02:00 event ends on the next calendar day, which is exactly what produces the “višednevno” label in PUB-04).

---

## A. Executive summary

| Status | Count | IDs |
|---|---:|---|
| **DONE** | **6** | EVT-04, EVT-05, EVT-06, PUB-03, PUB-04, PUB-05 (implementation/test evidence in §K/§M; runtime limitations in §M) |
| **PARTIAL** | **12** | EVT-02, EVT-08, EVT-09, EVT-10, EVT-11, ADM-02, ADM-03, NOT-01, NOT-03, NOT-04, PUB-02, SEO-02 |
| **NOT IMPLEMENTED** | **8** | AUTH-03, EVT-01, EVT-03, EVT-07, EVT-12, ADM-01, ADM-04, PUB-06 |
| **BUG STILL PRESENT** | **1** | NOT-02 |
| **UNKNOWN / NEEDS RUNTIME** | **6** | AUTH-01, AUTH-02, AUTH-04, PUB-01, SEO-01, ANA-01 |
| **Total** | **33** | |

**At audit time nothing could be closed as DONE** (EVT-06 has since been fixed and deployed; see §K). Several items have substantial code (email notifications, creator tracking, calendar URL state, mobile map layout) but each one either misses a requested part, depends on unverified production behavior, or retains a defect.

### Key findings

1. **`d137cf26` (creator tracking) covers admin-originated creation only.** Admin manual create, weekly series, split, duplicate and create-from-source now set `Event.createdByUserId`. **Organizer-created events never set it** (`organizer.service.ts:54`). Historical rows are `NULL` (no backfill). There is no `createdBy` filter, no report, no `updatedBy` and no revision history.
2. **Organizer edit path has a privilege problem.** `PUT /api/organizer/events/:id` passes `EventUpsertDto` through, and that DTO includes `organizerId`, `isFeatured` and `slug` (`event.dto.ts:33,66,93`). An organizer can reassign an event to another organizer (or to none), flag it featured, or change its slug. The edit always sets `PENDING_REVIEW`, which **takes an already published event off the public site** until re-approval. No admin notification is sent, and the edit is invisible in the bell count.
3. **Date/time handling has several distinct defects that share one theme: local-time vs. instant confusion.**
   - The LLM prompt hard-codes `Europe/Zagreb (UTC+2)` and year `2026` (`ai-event-parser.service.ts:623–625`). Every event after 25 Oct 2026 (CET, UTC+1) parsed via LLM will be 1 hour off.
   - The rule-based parser builds datetimes in server-local time (`buildDateTime`, `:1247–1261`). On a UTC host, “20:00” becomes 22:00/21:00 Zagreb.
   - Its “plain time” regex can read a date (`12.10.`) as a time.
   - Public display treats any end on the next calendar day as multi-day (PUB-04), and the weekend page keeps showing the Friday section on Saturday/Sunday (PUB-03).
4. **Organizer form cannot clear values.** It sends `endsAt: undefined` / `priceText: undefined` / `imageUrl: undefined` for cleared fields. `JSON.stringify` drops them, so the API keeps the old value (`organizer/event-form.tsx:98,107–109`; `events.service.ts:128`). This is the concrete code cause behind EVT-06 for organizers. Admin edit sends `null` and works.
5. **Auth/email: code is sound but delivery is unobservable.**
   - The reset flow (hashed token, TTL, `authVersion`, enumeration-safe response) is implemented and tested.
   - Nothing persists email send outcomes (no `EmailLog`), and the Resend webhook handles only contact events, not bounces/deliveries.
   - The root cause of AUTH-01/02 cannot be determined from code. Candidate causes are listed in §G with exact read-only checks.
6. **Unread/notification state is ad hoc.** It is spread over `EventSource.adminViewedAt`, `Organizer.adminViewedAt` and browser `localStorage`.
   - Monitored-source discoveries are always created unread, even when every candidate is already imported.
   - Opening `/admin/organizers` marks every organizer read.
   - There is no “mark all as read”.

---

## B. Full status matrix

Priority = suggested priority after audit (may differ from backlog). Effort: S ≤ 1 day, M 2–4 days, L > 1 week.

| ID | Status | Prio | Effort | One-line verdict |
|---|---|---|---|---|
| AUTH-01 | UNKNOWN / NEEDS RUNTIME | P0 | S (diagnose) / S–M (fix) | Login code is consistent. Cause requires DB/log checks; several plausible code-level contributors found |
| AUTH-02 | UNKNOWN / NEEDS RUNTIME | P0 | S (diagnose) / M (observability) | Reset flow correct in code + tests. Delivery not observable; needs Resend/Railway logs |
| AUTH-03 | NOT IMPLEMENTED | P2 | S | No `info@` contact on login/register/forgot/reset; raw English API errors shown |
| AUTH-04 | UNKNOWN / NEEDS RUNTIME | P1 | S | Welcome email is sent in code (tested); delivery unverified, same pipeline as AUTH-02 |
| EVT-01 | NOT IMPLEMENTED | P3 | L | No PDF/DOC ingestion; uploads are image-only |
| EVT-02 | PARTIAL | P1 | M | Organizer edit exists; forces re-review but unpublishes live event; DTO over-exposure; no admin notice/diff |
| EVT-03 | NOT IMPLEMENTED | P2 | M | Plain text only (paragraphs preserved); no bold/links |
| EVT-04 | **DONE** (2026-10-09; §M) | P1 | M | Timezone-aware parsing; source date/time evidence validation; missing/ambiguous times require review. Live provider smoke BLOCKED (401); see §M |
| EVT-05 | **DONE** (2026-10-09; §M) | P1 | S–M | Croatian month mapping and deterministic evidence checks reject September/October confusion; mocked screenshot regressions pass; see §M |
| EVT-06 | **DONE** (2026-10-09, `62759b51`) | P1 | S | Fixed & deployed: explicit null clears, end date/time editing, legacy-link-safe saves — see §K |
| EVT-07 | NOT IMPLEMENTED | P2 | M–L | One `imageUrl` per event; one screenshot per parse |
| EVT-08 | PARTIAL | P2 | M | Admin “reparse” exists but takes no new input, overwrites candidates/status; screenshots not stored |
| EVT-09 | PARTIAL | P2 | S | Edit form has price/category; list inline-edit lacks price; no “unknown” price state |
| EVT-10 | PARTIAL (DECISION) | P2 | S | Admin create **already defaults to Besplatno**; organizer form defaults to paid; no “Nepoznato” |
| EVT-11 | PARTIAL | P1 | M | Post-save duplicate queue + “Vjerojatno već uvezen” on parsed candidates; no pre-save warning in forms |
| EVT-12 | NOT IMPLEMENTED | P2 | S | No link from admin list/editor to `/eventi/{slug}` |
| ADM-01 | NOT IMPLEMENTED | P2 | S | `/admin/organizers` has no search |
| ADM-02 | PARTIAL | P2 | S | Event list can be filtered by organizer (generic field filter / API `organizerId`); no counts or link per organizer |
| ADM-03 | PARTIAL | P2 | M | `createdByUserId` exists for admin paths only; no filter/report; organizer paths and history unattributed |
| ADM-04 | NOT IMPLEMENTED | P3 | S | “Organizer portal” still in `organizer-shell.tsx:33`; mixed EN/HR copy |
| NOT-01 | PARTIAL | P1 | S–M | Admin email on pending organizer event/source submissions; nothing on trusted auto-publish or edits |
| NOT-02 | BUG STILL PRESENT | P2 | M | Monitored discoveries always unread (even already-imported); no mark-all; list-open marks all organizers read |
| NOT-03 | PARTIAL | P2 | S | “Objavljeno” email with public link exists; no social-share prompt; sent to `Organizer.email`, not the submitter |
| NOT-04 | PARTIAL | P2 | S | Email + bold unread row exist; delivery unverified; read-state coarse |
| PUB-01 | UNKNOWN / NEEDS RUNTIME | P1 | S | Mobile stacked layout implemented (UX Batch 1); never browser-validated; deploy status unknown |
| PUB-02 | PARTIAL | P1 | S–M | Date/view kept in URL + “Natrag na kalendar”; scroll position lost (forced scroll to day header) |
| PUB-03 | **DONE** (2026-10-09; §M) | P1 | S | Finished days/occurrences excluded, midnight-safe rendering/cache keys, active overnight shown once; see §M |
| PUB-04 | **DONE** (2026-10-09; §M) | P1 | S–M | Next-morning end ≤06:00 and duration <24h stays with starting evening; both clocks shown, raw endpoints preserved; see §M |
| PUB-05 | **DONE** (2026-10-09; §M) | P2 | S | Fresh starts precede continuing ranges in API, homepage and weekend; independent fresh query protects result cap; see §M |
| PUB-06 | NOT IMPLEMENTED (DECISION) | P3 | M | Historical detail pages stay reachable; no past-events listing |
| SEO-01 | UNKNOWN / NEEDS RUNTIME | P2 | S | Favicons consistent since 2026-07-16/23; OG image is SVG; SERP state needs Search Console |
| SEO-02 | PARTIAL | P3 | S | “digitalni kalendar” copy already targeted (`250d124e`); not validated against GSC data |
| ANA-01 | UNKNOWN / NEEDS RUNTIME | P2 | S | Code sends no custom `form_submit` ⇒ GA4 Enhanced Measurement; GA also loads on `/admin` and `/organizer` |

### Per-item detail

#### A — Auth, accounts, email

**AUTH-01 — Organizer accounts cannot log in; register says “user exists”**: UNKNOWN / NEEDS RUNTIME · P0 · S/S–M
- *Existing implementation:* `AuthService.login` lowercases and trims email, then `findUnique` on `User.email` and bcrypt compare (`apps/api/src/auth/auth.service.ts:78–101`). Unclaimed organizers without a user get `CLAIM_REQUIRED` (`:82–95`). Register rejects existing lowercase email with `"Email already registered"` (`:27–31`). Web login lowercases client-side (`apps/web/app/organizer/login/page.tsx:49`).
- *Evidence / analysis:* “Register says user exists” proves a `User` row with the **lowercase** email exists. The failure is therefore most likely one of these:
  - (a) password mismatch (forgotten password, plus the reset email not arriving, i.e. AUTH-02);
  - (b) HTTP 429 from throttling. `ThrottlerGuard` keys by `req.ip`, and `main.ts` never sets `trust proxy`, so behind Railway's proxy all users may share one bucket of 10 logins/min (`auth.controller.ts:10–11`, `apps/api/src/main.ts`);
  - (c) a user that logged in successfully but is an ADMIN or has a different email (rejected client-side at `login/page.tsx:66`).
  - Legacy mixed-case emails stored before `8aed85c2` (2026-07-02) would make login fail **and** let register create a duplicate, so they do *not* match the “user exists” symptom. Still worth a check.
  - Errors are shown raw and in English (`"Invalid credentials"`, `"Email already registered"`, `"ThrottlerException: Too Many Requests"`), so staff cannot tell the cases apart.
  - Admin “reset organizer password” (`admin.service.ts:461–467`) exists as a workaround. It does **not** bump `authVersion` and uses `findFirst({ organizerId })`, which is ambiguous if an organizer has several users.
- *Missing / broken:* distinguishable, localized error responses; a way for staff to see account state (exists / role / linked organizer / last login) without touching passwords; no test for proxy-IP throttling or legacy mixed-case emails.
- *Runtime verification:* see §G-1 (DB read-only queries, Railway logs for 401/429 on `/api/auth/login`).

**AUTH-02 — Forgot-password shows confirmation but email never arrives**: UNKNOWN / NEEDS RUNTIME · P0 · S/M
- *Existing implementation:*
  - Reset flow: hashed 32-byte token, TTL 30 min, prior tokens invalidated, `authVersion++` on reset, enumeration-safe generic response (`auth.service.ts:116–188`).
  - Delivery failure: if Resend fails, the new token is deleted and an error is logged (`:143–152`; `email.service.ts:135–162`).
  - Tests: 16 in `apps/api/test/auth.spec.ts:171–380`.
  - Config: production requires `RESEND_API_KEY`, `EMAIL_FROM_ADDRESS`, `PUBLIC_WEB_URL` and refuses log mode (`email.config.ts:30–58`), but only if `isProductionRuntime()` is true (`NODE_ENV`/`RAILWAY_ENVIRONMENT[_NAME]`==`production`, `:18–23`).
- *Evidence of gaps:*
  - The generic success message is also shown when the email has **no account** (by design), e.g. a typo or different address.
  - No send outcome is persisted (no email log table).
  - `POST /api/webhooks/resend` processes only contact updates (`webhooks/resend-webhook.controller.ts`, `contacts/resend-contacts.service.ts`), so bounces, suppressions and spam complaints are invisible.
  - Sender and reply-to default to `info@manifestacije.hr`. Deliverability depends on SPF/DKIM/DMARC for that domain in Resend.
- *Missing / broken:* email delivery observability (message id + status per send), bounce/suppression handling, staff-visible “last reset requested / sent / delivered”.
- *Runtime verification:* §G-1 and §G-2 (Resend dashboard, Railway logs `email sent template=password_reset` / `email delivery failed template=password_reset` / `[email:log]`).

**AUTH-03 — Contact link on login/reset screens**: NOT IMPLEMENTED · P2 · S
- *Existing:* `mailto:info@manifestacije.hr` appears only in legal pages (`app/uvjeti-koristenja`, `app/kolacici`, `app/pravila-privatnosti`). Email templates mention it.
- *Missing:* contact line on `app/organizer/login/page.tsx`, `src/components/organizer/register-form.tsx`, `src/components/auth/forgot-password-form.tsx`, `src/components/auth/reset-password-form.tsx`, `app/admin/login/page.tsx`. Also: register's “Email already registered” should link to login/forgot-password.

**AUTH-04 — Welcome/registration email to organizer**: UNKNOWN / NEEDS RUNTIME · P1 · S
- *Existing:* `sendOrganizerWelcome` after registration (`auth.service.ts:45–49`, template `email/templates/organizer-welcome.template.ts`). Tested (`test/auth.spec.ts:94–148`). The claim flow sends a claim-verification email, not a welcome.
- *Distinct from AUTH-02:* separate template and trigger, but the **same provider and pipeline**. If AUTH-02 is a provider/domain problem, AUTH-04 shares it.
- *Missing:* delivery evidence; no welcome email after completing a profile claim (product decision whether one is wanted).
- *Runtime:* Resend log for template tag `organizer_welcome`.

#### B — Entry, parsing, editing

**EVT-01 — Upload monthly/annual PDF/DOC schedule**: NOT IMPLEMENTED · P3 · L
- *Existing:* image-only uploads (`accept="image/*"` in `app/organizer/submit-link/page.tsx:196`, `src/components/admin/source-forms.tsx:241`); batch extraction of up to 50 candidates from text/HTML/screenshot (`ai-event-parser.service.ts:603–662`); listing crawl; already-imported flag.
- *Missing:* PDF/DOCX ingestion (Anthropic API accepts PDF documents natively; DOCX needs conversion), file storage, page-chunking for long schedules, per-candidate moderation at scale, duplicate control against existing events. Reuse: the existing candidate review UI (`parsed-candidate-card.tsx`).
- *Decision required* (scope, who may upload, moderation load).

**EVT-02 — Organizer edits; published edits go back to review**: PARTIAL · P1 · M
- *Existing:* `PUT /api/organizer/events/:id` → `OrganizerService.updateEvent` checks ownership, forces `status: PENDING_REVIEW` (`organizers/organizer.service.ts:129–133`). Cache invalidation on published→pending is covered (`test/event-cache-invalidation.spec.ts:125`). Organizer can delete only DRAFT/PENDING (`:119–127`).
- *Broken / risky:*
  1. **[FIXED & DEPLOYED 2026-10-09 — `6c27f7c5`, see §J]** **Over-exposed DTO:** `EventUpsertDto` exposes `slug`, `organizerId` and `isFeatured` (`events/event.dto.ts:33,66,93`), and global `ValidationPipe({ whitelist: true })` keeps decorated fields. `EventsService.updateEvent` applies them (`events.service.ts:112–150`). An organizer can therefore move an event to another organizer or to none (it then disappears from their own list), set `isFeatured`, or rename the slug. On create, `isFeatured` is also honored (`events.service.ts:63`); a TRUSTED organizer's event is auto-published, so it would go live as featured.
  2. **Unpublishing on any edit:** a typo fix removes a live event from the public site (public endpoints serve only PUBLISHED/ARCHIVED-with-publishedAt) until an admin re-approves. Re-approval resets `publishedAt` and re-sends the “Objavljeno” email.
  3. **No admin signal:** no email on edit. The bell's events count filters on `createdAt >= adminLastSeenEventsAt` (`admin.service.ts:51–74`, `admin-topbar.tsx:18–33`), so an edited *old* event never counts as new.
  4. **No change record:** no `updatedByUserId`, no revision/diff. The admin cannot see what changed.
  5. **Cannot clear fields** (see EVT-06): end time, price text, ticket URL and image cannot be removed by an organizer.
  6. Organizer edit page loads the whole event list and finds by id client-side (`app/organizer/events/[id]/page.tsx:17–22`).
- *Decision required:* keep the published version live while the edit is pending (requires a draft/revision model), or accept unpublishing. Which fields trigger re-review?

**EVT-03 — Rich text description**: NOT IMPLEMENTED · P2 · M
- *Existing:* plain `Textarea` in admin/organizer forms. Public detail renders paragraphs split on `\n\n` with `whitespace-pre-line` (`app/eventi/[eventSlug]/page.tsx:213,217`). Safe (no HTML injection). The LLM is instructed to preserve paragraphs/lists (`ai-event-parser.service.ts:633`).
- *Missing:* bold/links. URLs are not even auto-linked. Implementation needs a constrained format (e.g. limited Markdown) plus a sanitizer, JSON-LD/plain-text fallback for SEO and email, and an editor UI.

**EVT-04 — Wrong time from screenshot/poster parsing**: BUG STILL PRESENT · P1 · M
- *Existing:* earlier fix attempt `ecf3fc51` (2026-07-01) added “21.00 = 21:00” guidance to the prompt. JSON-LD path normalizes offsets correctly via `withZagrebOffset` (`ai-event-parser.service.ts:330–355`).
- *Defects found in code:*
  1. **Hard-coded DST offset:** the prompt says `vremenska zona Europe/Zagreb (UTC+2)` and maps `"21.00"` → `T21:00:00+02:00` (`:623–624`). From 25 Oct 2026 to 28 Mar 2027 Croatia is UTC+1, so any LLM-parsed winter event is stored 1 hour early (20:00 local shows as 19:00). LLM output is not re-normalized (`normalize`, `:707–744`).
  2. **Hard-coded year:** `Ako datum nema godinu, pretpostavi tekuću godinu (2026)` (`:625`) will mis-date every year-less poster from 1 Jan 2027.
  3. **Rule-based parser uses server-local time:** `buildDateTime` → `new Date(\`${date}T${t}:00\`).toISOString()` (`:1247–1261`). The API sets no `TZ`; on a UTC host “20:00” becomes 22:00 (CEST) / 21:00 (CET) on the site. It is used when `useLlm` is false (admin parse-URL/manual email without LLM, organizer link without screenshot).
  4. **Time regex reads dates as times:** fallback `\b([01]?\d|2[0-3])[.:]([0-5]\d)\b` (`:1243`) matches `12.10.` in “12.10.2026.” as 12:10 when no explicit time label is present. “20 h” (no minutes) is not recognized.
  5. **Invented default time:** a missing/invalid time silently becomes `18:00` (`:1255`).
- *Tests:* none cover LLM time output, CET dates, or `buildDateTime` timezone (`test/ai-parser.spec.ts`).
- *Runtime:* collect the original screenshots behind the report and compare stored `startsAt` UTC vs. intended local time.

**EVT-05 — AI confuses written months (rujan/listopad)**: UNKNOWN / NEEDS RUNTIME · P1 · S–M
- *Existing:* the rule-based parser maps all Croatian month names correctly (`MONTH_NUMBERS`, `ai-event-parser.service.ts:80–93`), but only for “Visit Slavonija”-style month headings (`:938–975`). Screenshots and Facebook always go to the LLM path (`organizer.service.ts:181`).
- *Gap:* the LLM prompt gives no Croatian month table and no instruction. “listopad” means **November** in Czech/Polish and “rujan” has no cognate. There is no post-validation comparing the month in the LLM date with month words in the source text, and confidence/warnings do not flag it. No commit has addressed this.
- *Status rationale:* a plausible, unmitigated defect, but not reproducible from code alone. Needs the original inputs.
- *Shares root cause with EVT-04* (LLM output trusted without validation).

**EVT-06 — Cannot clear end time/date individually**: ~~BUG STILL PRESENT~~ **DONE — fixed in `62759b51`, deployed 2026-10-09 (evidence in §K)** · P1 · S
- *Defects:*
  1. **Organizer form never sends a cleared end:** `endsAt: first.endsAt` (`src/components/organizer/event-form.tsx:98`) is `undefined` when cleared. `JSON.stringify` drops it, and `EventsService.updateEvent` treats a missing key as “unchanged” (`events.service.ts:128`), so the old end stays. Same for `priceText`, `ticketUrl`, `imageUrl` (`:107–109`). Occurrence-backed events are unaffected (they send full `occurrences`). The admin editor sends `endsAt: first.endsAt ?? null` (`admin/event-edit-form.tsx:162`) and clears correctly.
  2. **Editor model couples end date to end time:** if the end time is cleared, `endsAt` becomes `undefined` even when an end date is set (`src/lib/schedule-editor-model.ts:110–115`). Clearing the time silently deletes a multi-day end date. A date-only end on a timed event cannot be expressed.
  3. **End-date field is only rendered when an end date already exists** (`src/components/event-schedule-editor.tsx:71–76`). New multi-day (incl. all-day) events cannot get an end date from the editor, and there is no explicit “remove end” control.
- *Tests:* `event-schedule-editor.test.ts` covers overnight and midnight serialization, not clearing.

**EVT-07 — Two or more posters/screenshots per event**: NOT IMPLEMENTED · P2 · M–L
- *Existing:* `Event.imageUrl` single string (`schema.prisma:330`). Image picker uploads one image. Parse input accepts one `screenshotBase64`. `parsedJson.sourceImageUrl` stores one evidence image.
- *Missing:* gallery model (`EventImage[]`), multi-file parse input (Anthropic accepts multiple image blocks), editor UI, public gallery/hero selection. Decide gallery vs. parse-input only.

**EVT-08 — Add text/screenshot after parse and re-parse without losing edits**: PARTIAL · P2 · M
- *Existing:* admin `POST /api/admin/event-sources/:id/reparse` (`admin.service.ts:642–678`) re-fetches the URL and re-runs the parser. Candidate edits can be sent as `CandidateOverrideDto` at create time.
- *Broken / missing:*
  - Re-parse accepts no additional text or screenshot.
  - It **replaces `parsedJson` wholesale**, which resets candidate `_status` (created/ignored) and invites duplicate creation.
  - Screenshots are not persisted as parse input, so a screenshot-only source re-parses with no content.
  - No merge strategy that keeps manually corrected fields.
  - Organizers have no re-parse at all.

**EVT-09 — Easy editing of key fields, esp. Besplatno/Naplata and category**: PARTIAL · P2 · S
- *Existing:*
  - Admin edit form: `isFree` switch + price text + categories (`event-edit-form.tsx:476–492`).
  - Admin list inline edits: date, city, status and categories (`events-table.tsx:137–300`), plus bulk category add/remove.
  - Organizer form: checkbox + price.
- *Missing:* inline price toggle in the admin list; tri-state price (`isFree` is nullable in DB, `schema.prisma:326`, but every UI coerces `null` → `false`); organizer edit of an event with unknown price silently saves “paid”.

**EVT-10 — Default “Besplatno”**: PARTIAL (DECISION) · P2 · S
- *Current behavior (already inconsistent):*
  - Admin create defaults to `isFree: true` (`admin/event-create-form.tsx:43`), i.e. the request is effectively implemented for admin entry already.
  - Organizer create/edit defaults to `false` (`organizer/event-form.tsx:54`).
  - Parsers return `null` when unknown.
  - Public display maps `null` → not free (`public-api.ts:400`) → shows **“Naplata”** (`data.ts:899–901`), so unknown prices are presented as paid.
- *Recommendation:* do not widen “Besplatno” as a default. Introduce an explicit “Nepoznato” state end-to-end (form tri-state, public label e.g. “Cijena: provjerite kod organizatora”), and decide whether to reset the admin default.

**EVT-11 — Duplicate warning at entry**: PARTIAL · P1 · M
- *Existing:*
  - Post-save `DuplicatesService.detectForEvent` writes candidates to `/admin/duplicates` (`duplicates/duplicates.service.ts:8–34`).
  - Parsed candidates get `_existingEventId` (`ai-parser/candidate-filters.ts:42–79`), shown as “Vjerojatno već uvezen” with a link (`parsed-candidate-card.tsx:253–298`).
- *Missing / weak:*
  - No pre-save warning in admin create, organizer create, or “create from candidate” with a confirm-to-continue step.
  - The organizer is never warned.
  - `titleSimilarity` splits on `\W+` (`duplicates.service.ts:61–62`), which in JS splits Croatian letters (č, ć, š, ž, đ), so “Večer” becomes `ve`+`er`.
  - Candidates are compared against every event in the same city, including rejected/archived ones (`:11`).
  - Venue is ignored.
  - `sameCalendarDay` uses server-local `getDate()` (`candidate-filters.ts:81–83`).
  - Weekly-series rows will repeatedly flag each other only if same day, which is fine.

**EVT-12 — Admin opens public page/preview from list/editor**: NOT IMPLEMENTED · P2 · S
- *Evidence:* no `/eventi/` href anywhere in `app/admin`, `src/components/admin`, `app/organizer`, `src/components/organizer`. The editor links only to source and source URL (`event-edit-form.tsx:296–310,559–568`).
- *Missing:* “Otvori javnu stranicu” for PUBLISHED/ARCHIVED and a preview for drafts (drafts 404 publicly; preview needs an authenticated route or token).

#### C — Admin, organizers, productivity

**ADM-01 — Search organizers by name**: NOT IMPLEMENTED · P2 · S
- `app/admin/organizers/page.tsx` renders the full list (`GET /api/admin/organizers`, unpaginated, `admin.service.ts:429–441`) with no search input. Client-side filter is enough at current scale.

**ADM-02 — Events per organizer (list + count)**: PARTIAL · P2 · S
- *Existing:* `GET /api/admin/events?organizerId=` and the generic field filter “organizer contains/equals” (`admin.service.ts:1008–1011,1116`). Organizer is a visible column in the events table. Users page shows `createdEvents` count per **user** (`app/admin/users/page.tsx:76,94`). That is not per organizer, and for organizer users it is always 0 (see ADM-03).
- *Missing:* event count column and “Prikaži događaje” link on `/admin/organizers`; `organizerId` URL param is not wired into `/admin/events` page state (it reads `search`/`fieldFilters` only).

**ADM-03 — Filter entries by author and date range; reliable `createdBy`**: PARTIAL · P2 · M
- *What `d137cf26` actually delivers:*
  - Schema: `Event.createdByUserId` (nullable FK, `ON DELETE SET NULL`), index `(createdByUserId, createdAt)` (`prisma/migrations/20260930090000_add_event_created_by`).
  - Set on these paths: admin manual create, weekly series, split-into-weekly (clones), duplicate, create-from-source/candidate (`admin.controller.ts`, `admin.service.ts:159–216,239–298,369–403,681–746`).
  - UI: “Dodao” column (`events-table.tsx:87,648`, shows “Nepoznato” when null); “Uneseno događaja” count on Users page.
  - Tests: `test/admin.service.spec.ts:41–64` (mock-level).
- *Not delivered:*
  - **Organizer-created events:** `OrganizerService.createEvent` receives `userId` but does not pass `createdByUserId` (`organizer.service.ts:51–54`).
  - **Historical events:** no backfill, so all pre-2026-09-30 rows are `NULL`. Approximation is possible only via `sourceType`/`organizerId`.
  - **Monitored-source auto-imports:** none exist; they go through admin create-from-source.
  - **No filter:** `eventFieldFilterWhere` has no `createdBy` case (`admin.service.ts:1062–1150`), so you cannot filter by Vanesa/Andrijana.
  - **No report:** no aggregated count by author × date range (`createdAt` range filter exists: `createdFrom/createdTo`).
  - **No `updatedBy`/approver/publisher**, no audit log. Who approved or edited is unknowable.
- *Model limitation:* attribution is a single creator FK. Staff-workflow questions (“who published”, “who changed the date”) need an `EventAuditLog` (actor, action, diff, timestamp) or at minimum `publishedByUserId`/`updatedByUserId`.
- *Can we answer the §6 questions today?*

  | Question | Answer from current data |
  |---|---|
  | Who created an event? | Only for admin-created events since 2026-09-30 deploy (needs production deploy confirmation); organizer events → organizer via `organizerId` + `sourceType=ORGANIZER_FORM`, not the user |
  | When? | Yes, `createdAt` |
  | Vanesa vs Andrijana vs organizer? | Partially (see above); historical admin entries indistinguishable |
  | Filter by creator + date range? | Date range yes; creator **no** |
  | All submissions from one organizer? | Events yes (filter); sources via `EventSource.organizerId` but no UI filter |
  | Safe organizer edits? | **No** — see EVT-02 (DTO over-exposure) |
  | Edit of published event requires review? | Yes, but by unpublishing it |
  | New organizer submissions visible? | Email + pending list; bell excludes edits |
  | Duplicate warnings effective? | Post-save only; tokenizer weak for Croatian |

**ADM-04 — Replace “Organizer portal” with Croatian name**: NOT IMPLEMENTED · P3 · S
- `src/components/organizer/organizer-shell.tsx:33` “Organizer portal”. Also mixed copy (“Uredi event”, “Event ažuriran”, “Event poslan na pregled”), English route `/organizer/*`, and raw English API errors. A copy decision is needed (e.g. “Prostor za organizatore” / “Moj profil”).

#### D — Notifications

**NOT-01 — Admin notified of new organizer event (+ email to info@)**: PARTIAL · P1 · S–M
- *Existing:*
  - `sendAdminNewSubmission` to `ADMIN_NOTIFICATION_EMAIL` (default `info@manifestacije.hr`, `email.config.ts:37`) for organizer manual events in PENDING_REVIEW (`organizer.service.ts:100–112`) and every organizer source submission (`:261–273`), and for claim requests needing review.
  - In-app bell with sources/events/organizers counts (`admin-topbar.tsx`).
  - Tests in `organizer.service.spec.ts:153–225`.
- *Missing:*
  - No admin email or bell entry for TRUSTED organizer auto-published events (`status === PUBLISHED` skips admin mail, `:100`).
  - No notification on organizer **edits** (EVT-02).
  - Bell “events” relies on per-browser `localStorage` timestamp and `createdAt`.
  - Monitored-source discoveries are not emailed (arguably correct), but they inflate the bell.
  - Imports vs. submissions vs. discoveries are not distinguished in the bell (single “sources” number).

**NOT-02 — Read/unread clarity, bold new, mark all as read; no false unread from monitored items**: BUG STILL PRESENT · P2 · M
- *Existing:* bold/tinted unread rows for sources (`source-table.tsx:217,230`) and organizers (`organizers/page.tsx:132–136`). Opening a source marks it read (`admin.service.ts:537–546`). Admin-created parses are pre-marked read (`:568,634`).
- *Defects:*
  - Monitored-source discoveries are created with `adminViewedAt = null` (`monitored-sources.service.ts:717–733`) even when **every** candidate is flagged `_existingEventId` (already imported). That is a false unread in exactly the case the backlog describes (`:357–362`).
  - Merely loading `/admin/organizers` marks **all** unread organizers read (`admin.service.ts:429–437`).
  - There is no mark-all/bulk-read endpoint or UI.
  - Bell link goes to organizers or sources only, never to pending events (`admin-topbar.tsx:43`).
  - Read state is shared across admins (single timestamp) for DB-backed items but per-browser for events.

**NOT-03 — Organizer gets “published” email with link + social prompt**: PARTIAL · P2 · S
- *Existing:*
  - `sendEventPublished` (“Pogledaj objavu” → `/eventi/{slug}`) on admin approve/publish/bulk publish (`admin.service.ts:108,336,344–365`), admin create-as-published (`:164,216,775`) and trusted auto-publish (`organizer.service.ts:85–90`).
  - Template `email/templates/event-published.template.ts`. Tested.
- *Missing / risky:*
  - No social-sharing prompt or share links.
  - The approval path sends to `Organizer.email` (profile email), not the submitting user's login email. If the organizer profile has no email nothing is sent; if it is a scraped/public address of an **unclaimed** organizer, admin-created published events email a third party who never submitted (`notifyOrganizerOfStatusChange` only checks `organizer.email`).
  - Re-approval after an organizer edit re-sends “Vaš događaj je objavljen”.

**NOT-04 — Admin notified when a new organizer registers**: PARTIAL · P2 · S
- *Existing:* `sendAdminNewOrganizer` on register (`auth.service.ts:51–64`) and on completed claim (`organizer-claim.service.ts:176–188`), with name, email and timestamp. Unread organizer rows are bold, and the bell counts organizers with a user and no `adminViewedAt`. Tests: `auth.spec.ts`, `organizer-claim.service.spec.ts`.
- *Missing:* delivery verification (same pipeline as AUTH-02); read state is cleared for all on list open (NOT-02); no registration timestamp column labeled as such (only “Dodano”).

#### E — Public web, calendar, time logic

**PUB-01 — Mobile map looks wrong**: UNKNOWN / NEEDS RUNTIME · P1 · S
- *Existing:* UX Batch 1 (`docs/UX_BATCH_1.md` §5; commit `2831d79e`, 2026-09-2x) stacks list + map on mobile with `minmax(0,1fr)` tracks and fixed map height. CARTO tiles auth (`535a49e3`). Tests: `discovery-map-model.test.ts`, `carto-basemap.test.ts`, `discovery-ux.test.tsx`.
- *Explicitly unverified:* the UX Batch 1 report states “Manual browser validation remains pending because the browser runtime reported no available browser.” Whether the backlog report predates or postdates this deploy is unknown. Map depends on `NEXT_PUBLIC_CARTO_BASEMAP_KEY` at build time (`next.config.js` warns if missing).
- *Runtime:* §G-5.

**PUB-02 — Returning from event detail loses calendar month/date/position**: PARTIAL · P1 · S–M
- *Existing:*
  - Calendar date/view live in the URL (`datum`, `pogled`), and filters are preserved (`calendar-explorer.tsx:91–152`).
  - Agenda links carry `returnTo` (`:364`), and the detail page renders “Natrag na kalendar” (`app/eventi/[eventSlug]/page.tsx:38–41`).
  - Back/forward re-sync fixed in `e2615ea3`.
- *Still broken:*
  - On every mount and whenever `selectedDay`/`events` change, the calendar force-scrolls to the selected **day header** (`calendar-explorer.tsx:132–140`), overriding browser scroll restoration. Returning places the user at the top of the day, not at the clicked event.
  - If the user scrolled a month view without selecting a day, `datum` is the initially selected day, so return jumps there.
  - No `#event` anchor and no stored scroll offset.
  - Browser Back behavior vs. the in-page “Natrag” link is not tested.
- *Runtime:* mobile Safari/Chrome check of both Back and “Natrag na kalendar”.

**PUB-03 — “Kamo za vikend” shows “Petak” on Saturday**: BUG STILL PRESENT · P1 · S
- *Mechanisms found in code* (any of them produces the symptom; exact reported scenario still to be confirmed):
  1. `currentWeekendDisplayRange` always starts at Friday, even on Saturday/Sunday (`src/lib/weekend.ts:48–65`). `/ovaj-vikend` renders every non-empty day (`app/ovaj-vikend/page.tsx:26–27`). On Saturday, still-running multi-day events and Friday-night events ending after midnight keep a populated **“Petak”** section at the top.
  2. Overnight events (Fri 22:00–Sat 02:00) get `endDate = Saturday` (PUB-04) and are listed again under **Subota** with “22:00” (`data.ts:864–879`, `weekend.ts:75–83`).
  3. Ongoing multi-day events take `date = now` at render time (`public-api.ts:367–369`). Pages are ISR-cached (300 s, events tag; `docs/public-event-cache.md`), and stale-while-revalidate can serve a page computed on Friday to the first Saturday visitor, so card weekdays read “Petak”.
- *Tests:* `weekend.test.ts` only uses `now = Wednesday`. No Saturday/Sunday or overnight cases.

**PUB-04 — Event ending 02:00 next day shows as multi-day**: BUG STILL PRESENT · P1 · S–M
- *Root cause:*
  - `eventDisplayEnd` subtracts 1 ms only, so midnight endings stay on the start day (fix `7d36ff9e`), but **any** later end (00:01–05:59) yields next-day `endDate` (`src/lib/event-end.ts:2–4`). The test explicitly asserts `18:00 → 02:00 ⇒ 2026-09-11` (`event-end.test.ts:9`).
  - Consequences:
    - calendar labels it “· višednevno” and sorts it to the bottom (`calendar-explorer.tsx:55–64,360,373`);
    - it appears on two calendar days (`eventOccursOn`, `data.ts:854–862`);
    - the detail page shows “10. rujna – 11. rujna 2026. · 22:00” with no end time and without weekday (`data.ts:892–897`, `page.tsx:146,247`).
  - The occurrence model is not at fault; the display classification is.
- *Fix direction (not implemented):* classify as overnight when the end is the next calendar day before a cutoff (e.g. ≤ 06:00) and the duration is under ~24 h. Show “22:00–02:00”, group under the start day only, and keep JSON-LD/ICS exact.

**PUB-05 — Long-running events dominate top results**: PARTIAL (DECISION) · P2 · S
- *Existing:* calendar day lists put multi-day events after single-day ones (`calendar-explorer.tsx:59–64`). Overnight events are wrongly included (PUB-04).
- *Not addressed:*
  - Public API orders by original `startsAt asc` (`public-feed.service.ts:94`), so ongoing festivals that started weeks ago lead the homepage “upcoming” pool, `/eventi` and category/city pages.
  - Weekend day lists sort by original `startsAtISO` (`weekend.ts:87–93`), so long events again come first.
  - Ordering rules are not documented to users.
- *Decision:* ordering rule (e.g. single-day/upcoming first, then ongoing; or by next relevant time) per surface.

**PUB-06 — Past events section/page**: NOT IMPLEMENTED (DECISION) · P3 · M
- *Existing:* historical detail pages remain accessible (`39e54d1d`). Public includes ARCHIVED with `publishedAt` (`public-feed.service.ts:105`). Listings filter out past events (`public-api.ts:244`).
- *Missing:* archive listing, sitemap/indexing policy for past events. Requires SEO/product decision.

#### F — SEO & analytics

**SEO-01 — Wrong/unexpected logo in Google result**: UNKNOWN / NEEDS RUNTIME · P2 · S
- *Existing:* favicon set replaced with real logo mark (`e0814ddf`, 2026-07-16) and cache-busted v2 assets (`7d0364b2`, 2026-07-23). `public/favicon.ico` = `public/brand/favicon-v2.ico` (identical hash). Manifest uses v2 PNGs. Organization JSON-LD `logo` = `/logo/logo.svg` (`app/page.tsx:41–47`).
- *Code-level concerns:*
  - `openGraph.images` and `twitter.images` point to an **SVG** (`app/layout.tsx:24,30`). Most consumers (Facebook, LinkedIn, often Google Discover) do not render SVG `og:image`; a 1200×630 PNG/JPG is needed.
  - Google's Organization logo should be a raster ≥112×112 for reliability.
  - Layout declares both v2 and legacy icon URLs (`app/layout.tsx:35–46`). They are identical, so harmless.
- *Runtime:* Search Console URL Inspection of `/` (rendered HTML, favicon fetched), `site:manifestacije.hr` SERP check after recrawl. Google's favicon cache can take weeks; no SERP promise.

**SEO-02 — “digitalni kalendar Osijek / Slavonija / Baranja” terms**: PARTIAL · P3 · S
- *Existing:* `250d124e` (2026-07-28) added “digitalni kalendar” copy across calendar, region, city and home pages (also in default metadata description, `app/layout.tsx:16`).
- *Missing:* validation against Search Console query data. A GSC export (`manifestacije.hr-Performance-on-Search-2026-08-13.zip`) exists outside the repo in the user's Downloads and was **not** opened in this audit.

**ANA-01 — Which forms generate GA4 `form_submit`**: UNKNOWN / NEEDS RUNTIME · P2 · S
- *Code answer:*
  - The app never sends a custom `form_submit`. Its custom events are listed in `src/lib/analytics.ts:22–41`.
  - Any `form_submit` therefore comes from **GA4 Enhanced Measurement → Form interactions**, which reports `form_id`, `form_name` and `form_destination`.
  - GA is injected in the **root** layout (`app/layout.tsx:57,73`), so admin and organizer pages are tracked too.
  - Stable form ids (`e39cff07`) that will appear as `form_id`:
    - Public / organizer: `event-filters-search-form`, `organizer-login-form`, `organizer-register-form`, `organizer-join-form`, `organizer-claim-request-form`, `organizer-claim-complete-form`, `organizer-submit-link-form`, `event-form`, `forgot-password-form`, `reset-password-form`.
    - Admin: `admin-login-form`, `admin-event-create-form`, `admin-source-parse-url-form`, `admin-source-screenshot-form`, `admin-monitored-source-form`.
- *Runtime:* GA4 Admin → Data streams → Enhanced measurement (form interactions on?); Explore `form_submit` by `form_id` and `page_location`. Decide whether to exclude `/admin` + `/organizer` from GA or filter internal traffic.

---

## C. Already implemented (closable)

None qualify as DONE under the audit rule (code **and** test/proof of the requested end-to-end behavior). The following parts are solid and can be treated as building blocks:

| Building block | Evidence | Related IDs |
|---|---|---|
| Password reset mechanics (hashed tokens, TTL, invalidation, `authVersion`, enumeration safety) | `auth.service.ts:116–188`, `jwt-auth.guard.ts:28–36`, `test/auth.spec.ts` (16 cases) | AUTH-02 |
| Email pipeline with prod fail-fast config and per-send structured logs | `email.config.ts`, `email.service.ts`, `test/email.service.spec.ts` | AUTH-02/04, NOT-01/03/04 |
| Admin-side creator attribution | `d137cf26`, `test/admin.service.spec.ts:41–64` | ADM-03 |
| Calendar URL state + return link | `calendar-explorer.tsx`, `eventi/[eventSlug]/page.tsx:38–41` | PUB-02 |
| Midnight-ending events stay on start day | `7d36ff9e`, `event-end.test.ts` | PUB-04 (00:00 only) |
| Occurrence schedules end-to-end | `events.service.ts:234–276`, `event-occurrences.spec.ts`, `schedule-editor-model.ts` | PUB-04/EVT-06 context |
| Public cache invalidation incl. organizer published→pending | `docs/public-event-cache.md`, `event-cache-invalidation.spec.ts` | EVT-02 |
| Admin CLI provisioning `users:create-admin` | `347ab489`, `admin-user-provisioning.spec.ts` | (not a backlog item; distinct from ADM-03) |

## D. Partially implemented — what remains

| ID | Exists | Remaining |
|---|---|---|
| EVT-02 | Ownership-checked edit; forced re-review; cache invalidation | Restrict organizer DTO; keep live version or decide to unpublish; admin notification + bell; diff/audit; clearable fields |
| EVT-08 | Admin reparse | Additional input; merge preserving edits and candidate status; persist screenshots; organizer access |
| EVT-09 | Edit-form fields, inline category/date/status | Inline price; tri-state price |
| EVT-10 | Admin default Besplatno; nullable DB column | Decide; “Nepoznato” in forms and public label; align admin/organizer defaults |
| EVT-11 | Post-save duplicate queue; candidate “already imported” | Pre-save warning in all create paths incl. organizer; Unicode-aware tokenizer; venue + status in scoring |
| ADM-02 | Organizer filter on events API/table | Counts + link on organizers page; URL param wiring |
| ADM-03 | `createdByUserId` for admin paths, column, user count | Organizer path; filter; report; backfill decision; updatedBy/publishedBy/audit log |
| NOT-01 | Admin email for pending organizer events/sources | Trusted auto-publish + edits; per-type bell; server-side last-seen |
| NOT-03 | “Objavljeno” email with public link | Social prompt; recipient rule (submitter vs. profile email; no mail to unclaimed third parties) |
| NOT-04 | Email + bold unread + bell count | Delivery proof; per-item read instead of list-open |
| PUB-02 | URL state, return link | Scroll restoration to the clicked event |
| PUB-05 | **DONE** (2026-10-09; §M) | Fresh starts precede continuing ranges in API, homepage and weekend; independent fresh query protects result cap; see §M |
| SEO-02 | Keyword copy | GSC validation |

## E. Confirmed bugs (code-evident)

| # | Bug | Evidence | IDs |
|---|---|---|---|
| E1 | LLM prompt hard-codes UTC+2 → winter events 1 h early; hard-coded year 2026 | `ai-event-parser.service.ts:623–625` | EVT-04, EVT-05 |
| E2 | Rule-based `buildDateTime` uses server-local TZ; time regex can read a date as time; silent 18:00 default | `ai-event-parser.service.ts:1238–1261` | EVT-04 |
| E3 | **FIXED `62759b51`** — Organizer form cannot clear `endsAt`/`priceText`/`ticketUrl`/`imageUrl` (undefined dropped from JSON) | `organizer/event-form.tsx:98,107–109`, `events.service.ts:128` | EVT-06, EVT-02 |
| E4 | **FIXED `62759b51`** — Schedule editor drops end date when end time cleared; end-date field hidden unless pre-existing | `schedule-editor-model.ts:110–115`, `event-schedule-editor.tsx:71–76` | EVT-06 |
| E5 | ~~Organizer can set `organizerId`, `isFeatured`, `slug` via create/update DTO~~ **FIXED & DEPLOYED** — `6c27f7c5`, see §J | `event.dto.ts:33,66,93`, `organizer.service.ts:54,132`, `main.ts` `whitelist:true` | EVT-02 (security) |
| E6 | Organizer edit unpublishes live events; edits invisible in admin bell | `organizer.service.ts:132`, `admin.service.ts:59–65` | EVT-02, NOT-01 |
| E7 | Overnight events classified multi-day (label, two days, no end time); test enforces it | `event-end.ts`, `event-end.test.ts:9`, `calendar-explorer.tsx:55–64`, `data.ts:892–897` | PUB-04, PUB-05, PUB-03 |
| E8 | Weekend page keeps Friday section on Sat/Sun; render-time “today” cached | `weekend.ts:48–65`, `ovaj-vikend/page.tsx:26–27`, `public-api.ts:367–369` | PUB-03 |
| E9 | Monitored discoveries unread even when all candidates already imported; organizer list-open marks all read | `monitored-sources.service.ts:357–362,717–733`, `admin.service.ts:429–437` | NOT-02 |
| E10 | Unknown price (`isFree=null`) shown publicly as “Naplata”; organizer edit converts null → false | `public-api.ts:400`, `data.ts:899–901`, `organizer/event-form.tsx:54` | EVT-10, EVT-09 |
| E11 | Duplicate title tokenizer splits Croatian diacritics; city-wide unfiltered comparison | `duplicates.service.ts:11,61–62` | EVT-11 |
| E12 | Reparse overwrites candidate statuses and cannot reuse screenshots | `admin.service.ts:642–678` | EVT-08 |
| E13 | Admin password reset for organizer doesn't bump `authVersion`; ambiguous `findFirst` user | `admin.service.ts:461–467` | AUTH-01 (adjacent) |
| E14 | Throttler keyed by `req.ip` with no `trust proxy` — all clients may share one bucket behind Railway proxy (**needs runtime confirmation**) | `main.ts`, `auth.controller.ts:10–11,32` | AUTH-01 (hypothesis) |

## F. Missing functionality (grouped)

- **Admin:** organizer search (ADM-01); per-organizer counts/links (ADM-02); creator filter/report and audit trail (ADM-03); public-page/preview links (EVT-12); inline price edit (EVT-09); mark-all-read (NOT-02).
- **Organizer:** Croatian naming/copy (ADM-04); safe edit with live version retained (EVT-02); duplicate warning (EVT-11); re-parse with extra input (EVT-08); multi-image (EVT-07); rich text (EVT-03); contact help on auth screens (AUTH-03).
- **Parsing:** PDF/DOC schedules (EVT-01); multiple screenshots (EVT-07); month validation + DST-correct offsets (EVT-04/05); merge re-parse (EVT-08).
- **Notifications:** edit notifications, trusted auto-publish notice (NOT-01); social-share prompt (NOT-03); email delivery log + bounce handling (AUTH-02/04, NOT-*).
- **Public web:** overnight display (PUB-04); weekend day filtering (PUB-03); scroll restoration (PUB-02); ordering policy (PUB-05); past-events archive (PUB-06); “price unknown” label (EVT-10).
- **SEO/Analytics:** raster OG image + logo (SEO-01); GSC-driven keyword review (SEO-02); GA exclusion of admin/organizer routes or internal-traffic filter (ANA-01).

## G. Requires production verification (read-only)

Do not access account passwords, impersonate users, send test emails to real users, or modify data. Run SQL only on a read replica or via a read-only role.

**G-1. Accounts (AUTH-01/02).** With explicit approval to look up the two reported organizers:
```sql
-- Legacy mixed-case / whitespace emails
SELECT id, role, "organizerId", "createdAt" FROM "User" WHERE email <> lower(trim(email));
-- Case-insensitive duplicates
SELECT lower(email) AS e, count(*) FROM "User" GROUP BY 1 HAVING count(*) > 1;
-- Reported accounts: existence, role, organizer link (no password hash)
SELECT u.id, u.role, u."organizerId", u."createdAt", u."authVersion", o.name, o.status, (o.email = u.email) AS same_email
FROM "User" u LEFT JOIN "Organizer" o ON o.id = u."organizerId"
WHERE lower(u.email) LIKE 'schleis%' OR o.name ILIKE '%schleis%' OR o.name ILIKE '%hoochy%';
-- Organizers without a user (would get CLAIM_REQUIRED only if UNCLAIMED)
SELECT id, name, status, email IS NOT NULL AS has_email FROM "Organizer"
WHERE (name ILIKE '%schleis%' OR name ILIKE '%hoochy%');
-- Did forgot-password reach the "known user" branch? (token rows exist only if send didn't fail)
SELECT "userId", "createdAt", "expiresAt", "usedAt" FROM "PasswordResetToken"
WHERE "userId" IN (<ids from above>) ORDER BY "createdAt" DESC;
```
Railway API logs around the report dates:
- `email sent template=password_reset` / `email delivery failed template=password_reset` (and `userId=` line) → send outcome.
- `forgot-password requested for unknown email` → the address typed has no account.
- `[email:log]` or `EMAIL_DELIVERY_MODE=resend but RESEND_API_KEY is missing` → production is **not** actually sending.
- HTTP 401 vs 429 on `POST /api/auth/login` → wrong password vs. shared-IP throttling.
- Railway variables (names only): `NODE_ENV`, `RAILWAY_ENVIRONMENT`, `EMAIL_DELIVERY_MODE`, `EMAIL_FROM_ADDRESS`, `PUBLIC_WEB_URL`, `PASSWORD_RESET_URL`.

**G-2. Resend (AUTH-02/04, NOT-01/03/04).**
- Domain `manifestacije.hr` verified (SPF, DKIM, DMARC).
- Email log filtered by tag `template=password_reset|organizer_welcome|admin_new_submission|admin_new_organizer|event_published`: status delivered / bounced / complained / suppressed.
- Suppression list entries for the affected recipient(s).
- Whether `info@manifestacije.hr` → `info@manifestacije.hr` admin mails land in spam or are rejected by the receiving mailbox.

**G-3. Deployment state.** Vercel: confirm the production deployment commit includes `2831d79e` (UX Batch 1) and `d137cf26`. Railway: confirm the API deployment commit and that migration `20260930090000_add_event_created_by` is applied (`_prisma_migrations`, read-only).

**G-4. Creator attribution (ADM-03).** `SELECT "createdByUserId" IS NULL AS unattributed, "sourceType", count(*) FROM "Event" GROUP BY 1,2;` Confirms coverage since deploy.

**G-5. Mobile map (PUB-01) & calendar return (PUB-02).** Real devices (iOS Safari, Android Chrome), widths 360/390/414:
- `/mapa`: list and map both visible, no horizontal scroll, tiles load (CARTO key present in build).
- `/kalendar` → month view → scroll → open event → Back and “Natrag na kalendar”: month, date and scroll position.

**G-6. Weekend (PUB-03).** On a Saturday, load `/ovaj-vikend` (fresh and after idle) and note whether the first section is “Petak” and which events populate it; compare page `x-vercel-cache` age header.

**G-7. Google (SEO-01/02).** Search Console:
- URL Inspection `/` (rendered favicon, structured data → Organization logo).
- Performance report for queries containing “kalendar”, “osijek”, “slavonija”, “baranja”, “događanja”.
- Do not promise SERP logo timing.

**G-8. GA4 (ANA-01).** Admin → Data streams → Enhanced measurement (form interactions); Explore `form_submit` by `form_id`, `page_location`, `form_destination`; check internal traffic filter for `/admin` and `/organizer`.

## H. Recommended next implementation batch (max 5)

Ordered by: broken core flows → data correctness → staff efficiency.

1. **Auth & email diagnosis + recovery UX** (AUTH-01, AUTH-02, AUTH-03; prepares AUTH-04/NOT-*). *Effort S–M.*
   - First run §G-1/G-2/G-3 read-only checks; the fix depends on the outcome (provider/domain config vs. user data vs. throttling).
   - Code-side, independent of outcome:
     - localized, distinguishable error messages (wrong password / no account / too many attempts);
     - `info@` contact + links on all auth screens;
     - `app.set("trust proxy", …)` for correct throttling;
     - persist send outcome (message id, template, status) and subscribe to Resend `email.bounced`/`email.delivered`;
     - admin-initiated organizer reset bumps `authVersion`.
   - *Impact:* unblocks organizers who cannot access their accounts (P0) and makes future email reports diagnosable in minutes.

2. **Date/time correctness pack** (EVT-04, EVT-05, PUB-04, PUB-03; improves PUB-05). *Effort M.*
   - Parser:
     - LLM returns naive local datetimes; the server applies `withZagrebOffset` (DST-aware);
     - current year computed at runtime;
     - explicit Croatian month table in the prompt;
     - post-validation that flags candidates whose month disagrees with month words in the source;
     - `buildDateTime` uses Zagreb offset;
     - stricter time regex; no silent 18:00;
     - fixture tests for CET/CEST, rujan/listopad, “20 h”, “12.10.”.
   - Display:
     - an overnight rule (end next day before ~06:00) → “22:00–02:00”, grouped on the start day only;
     - weekend page hides past days and sorts ongoing events after timed ones;
     - Saturday/Sunday weekend tests;
     - update the `event-end` test that encodes the bug.
   - *Impact:* wrong times/days are public misinformation and the most visible quality issue; one shared root cause.

3. **Organizer edit safety & clearable fields** (EVT-02, EVT-06; part of NOT-01). *Effort M.*
   - Dedicated organizer DTO without `organizerId`/`isFeatured`/`slug`/`status`.
   - Send explicit `null` for cleared fields (end, price, ticket, image).
   - Editor: allow adding/removing an end date independently of end time.
   - Notify admins on organizer edits and count them in the bell (`updatedAt`-based).
   - Pending decision (§I-2): retain the live version or not.
   - *Impact:* closes a privilege issue and a data-correctness bug; makes organizer self-service trustworthy.

4. **Complete creator attribution & admin lookup** (ADM-03, ADM-02, ADM-01, EVT-12). *Effort S–M.*
   - Pass `createdByUserId` in `OrganizerService.createEvent`; add `createdBy` field filter + author/date-range summary.
   - Organizer search + event count + “Prikaži događaje” link.
   - “Otvori javnu stranicu” in the admin list/editor.
   - Decide backfill policy for historical NULLs.
   - Optionally add `publishedByUserId` now (cheap) and defer a full audit log.
   - *Impact:* answers the staff-reporting questions Vanesa/Andrijana raised with minimal schema change.

5. **Notification hygiene** (NOT-02, NOT-01, NOT-04). *Effort M.*
   - Don't create unread rows when all discovered candidates are already imported (or create pre-read).
   - Per-item read on open instead of list-open-marks-all.
   - “Označi sve kao pročitano” endpoint + UI.
   - Server-side last-seen per admin instead of `localStorage`.
   - Separate bell counts for submissions / imports / discoveries / organizers.
   - Admin email on trusted auto-publish.
   - *Impact:* reduces daily triage noise and makes real submissions visible.

*Quick wins outside the batch (S each):* ADM-04 copy, raster OG image (SEO-01), exclude `/admin` + `/organizer` from GA (ANA-01).

## I. Product decisions needed

1. **Price default (EVT-10):** Keep “Besplatno” as admin default (current) or switch to “Nepoznato”? How should unknown price appear publicly (today it shows “Naplata”)?
2. **Editing published events (EVT-02):** Should an organizer edit keep the current version public until approved (needs a revision/draft model), or unpublish as today? Which fields require re-review (date/time/location/price vs. typo in description)? May TRUSTED organizers' edits publish directly?
3. **Notification triggers (NOT-01/03/04):** Which events email `info@` (new submission, edit, trusted auto-publish, new organizer, monitored discovery)? Immediate or daily digest? Should “published” emails go to the submitting user, the organizer profile email, or both, and never to unclaimed organizers' scraped addresses?
4. **Creator attribution scope (ADM-03):** Is “who created” enough, or do we need “who approved/edited” (audit log)? Backfill historical events as “unknown” or infer from `sourceType`?
5. **Long-running events ordering (PUB-05):** Per surface (homepage, `/eventi`, weekend, calendar): upcoming single-day first, ongoing after? Should ongoing festivals be a separate rail?
6. **Past events (PUB-06):** Public archive page? Indexed or `noindex`? Retention period?
7. **PDF/DOC schedules (EVT-01) and multi-image (EVT-07):** In scope this quarter? Who may upload; moderation capacity; storage budget?
8. **Rich text (EVT-03):** Allowed formatting (bold, links, lists)? Organizer-editable or admin-only?
9. **Naming (ADM-04):** Croatian name for the organizer area and whether `/organizer/*` URLs should be localized (redirects needed).
10. **Analytics (ANA-01):** Exclude staff/organizer areas from GA4 or keep them with an internal-traffic filter?
11. **Overnight cutoff (PUB-04):** Up to which hour does an end on the next day still count as the same evening (proposal: 06:00)?

---

## J. Security fixes — status (updated 2026-10-09)

These two fixes came out of this audit. They are security hardening, not backlog IDs. **EVT-02 stays PARTIAL**: only its sub-item 1 (over-exposed DTO) is fixed. Unpublish-on-edit, no admin signal, no change record and the cannot-clear-fields bug (E3/EVT-06) are untouched.

| Fix | Commit | Status | Deployment evidence |
|---|---|---|---|
| Organizer authorization & ownership (E5) | `6c27f7c5` | **DONE — deployed** | API-only change. Pushed to `main` 09:02 UTC. Railway API restarted ~09:05 UTC (`/api/health` uptime). Vercel correctly skipped it ("commit didn't affect this project"). Railway exposes no commit SHA to us, so the deploy is confirmed by restart timing only. |
| URL validation & stored-XSS protection | `ac8652c2` | **DONE — deployed** | Pushed to `main` 09:27 UTC. Vercel production `manifestacije-ay6248car` READY at `githubCommitSha ac8652c2`, aliased to manifestacije.hr / www. Railway API restarted 09:28:42 UTC; health `ok`, db `ok`. |

### What the URL/XSS fix does
- API: `IsSafeHttpUrl` on every user URL field (event `ticketUrl`/`sourceUrl`/`imageUrl`, organizer submission `sourceUrl`/`sourceImageUrl`, candidate overrides, partner `logoUrl`/`websiteUrl`, organizer `websiteUrl`, admin parse/source URLs). Only http(s) is accepted; ticket links may also be `tel:`/`mailto:`. Scheme-less hosts get `https://`. `EventsService` re-validates on every create/update. Admin candidate approval and weekly cloning drop unsafe parsed/legacy links.
- Web: `safeExternalUrl` guards every `href`/`src` that renders these fields: public event page (ticket, source, image, organizer URL), partner strip, admin source review, candidate card, event edit form, image picker, admin partners table. This protects rows that predate validation.
- Read-only `pnpm --filter api urls:audit` reports UNSAFE / SCHEMELESS stored values.

### Production URL audit (read-only)
- **Direct DB audit: BLOCKED.** There is no Railway CLI or token on the dev machine, so `urls:audit` could not run against the production DB.
- **Alternative used:** the same classifier was run over the public production API (`/api/public/events`, `/partners`, `/seo/sitemap-data`). This covered 167 published events (all sitemap events), 44 organizers and 0 partners. No database access and no writes.
- Findings:
  | Record (slug) | Field | Value | Outcome |
  |---|---|---|---|
  | `koncert-kkn-kanda-kodza-i-nebojsa` | ticketUrl | `tel:099-488-9294` | Legitimate phone booking. Would have broken, so `tel:`/`mailto:` are now allowed **for ticket links only**. Verified live. |
  | `hit-komedija-crnogorac-u-krevetu` | ticketUrl | `www.eventim.hr` | Was a broken relative link. Now renders `https://www.eventim.hr` (verified in Chrome, 200). |
  | `podunavlje-trail` | ticketUrl | `racesmanager` | **Junk value, needs manual fix.** It is no longer rendered as a link. An admin/organizer save of this event returns 400 on `ticketUrl` until the field is corrected or cleared. Not modified automatically. |
- Images: 166/167 on `res.cloudinary.com`, 1 empty, none broken. Source links: 22, all http(s). Organizer websites: none set. Partners: none active.
- **Not covered:** unpublished or past events not in the public feed, `EventSource.sourceUrl`/`parsedJson`, organizers without public events, and inactive partners. Render-time sanitization protects these regardless. Run `urls:audit` with Railway DB access to complete the audit.

### Verification
- Local: API typecheck + 24 suites / 405 tests; web typecheck + lint + 28 files / 226 tests; API and web production builds all passed. This includes `organizer-event-authorization.spec.ts` (authorization intact) and `url-safety.spec.ts` / `url-rendering.test.tsx` (malicious-URL rejection on isolated fixtures).
- Production browser QA (headless + headed Chrome, Playwright, GET only):
  - Pages (all 200, 0 console errors, 0 broken images, 0 `javascript:`/`data:` hrefs): home, `/eventi`, 6 event detail pages, `/organizer/login`, `/organizer/register`, `/admin/login`.
  - Ticket buttons clicked through to Eventim and Entrio (200).
- Production API: health ok. `POST /api/auth/{login,register,forgot-password}` with an empty body → 400 (routes up, validation active). `GET /api/organizer/events` and `/api/admin/events` without a token → 401.
- No malicious records were created and no production data was modified.

### Remaining risks
1. `podunavlje-trail` ticketUrl `racesmanager` still needs a correction. Since EVT-06 (§K) it no longer blocks saving, and the organizer/admin form flags it and can clear it. Not modified automatically.
2. The full DB audit is pending Railway access.
3. The organizer form's `type="url"` inputs still make the browser reject scheme-less links client-side. The API would accept and normalize them.
4. Server-side fetching of organizer-submitted `sourceUrl` (SSRF) is not addressed.
5. Organizer `facebookUrl`/`instagramUrl` are not validated. They are not rendered anywhere today.
6. EVT-02 non-security parts remain open. E3 (cannot clear fields) is fixed by EVT-06 (§K).

---

## K. EVT-06 — fix status (updated 2026-10-09)

**Status: DONE.** Commit `62759b51` "fix(events): let organizers clear optional fields and edit event ends (EVT-06)", pushed to `main`.

### What changed
- **Organizer form:** sends explicit `null` for a cleared end, price, ticket link, source link and image, and gives each a × clear button. When the event is marked free, the hidden price/ticket inputs are omitted, so their stored values are left unchanged.
- **Schedule editor (shared admin/organizer):**
  - The end date is always editable, so new multi-day and all-day events can be created.
  - "Ukloni završetak" clears only the end (date and time).
  - Moving the start date keeps a multi-day or overnight range intact.
  - An end date without an end time is a Croatian validation error. It used to be silently dropped.
  - The end date may not be earlier than the start date.
  - A plain overnight slot round-trips without an explicit end date.
- **Legacy invalid links:**
  - Event URL fields are normalized in the DTO and enforced in `EventsService`. A value identical to the stored one is left untouched, so `racesmanager` no longer blocks unrelated saves.
  - New or changed values must still be safe (http(s), and `tel:`/`mailto:` for ticket links).
  - The form shows "Spremljena poveznica nije valjana i ne prikazuje se na stranici…" and offers ×.
  - URL inputs are `type="text"`, so the browser no longer refuses to submit the form.
- **Admin edit form:** sends `null` for a cleared price and ticket link.
- **Organizer layout:** a `<Toaster />` is now mounted. Organizer save errors and confirmations were previously never shown.
- **Unchanged:** organizer authorization (`6c27f7c5`), URL/XSS protections (`ac8652c2`) and the approval workflow (an organizer edit → `PENDING_REVIEW`).

### Verification evidence
- **Tests:**
  - New `apps/api/test/organizer-event-clearing.spec.ts` (21 tests), which runs the real ValidationPipe and then the service. It covers: explicit null for each field; a title-only edit writing no other fields; unchanged links not rewritten; legacy invalid values saved, cleared and replaced; changed unsafe values rejected; overnight, multi-day, all-day and occurrence-backed schedules; another organizer being rejected; status forced to `PENDING_REVIEW`; admin-only fields ignored.
  - Web: schedule model (+10 tests), organizer body model (6), organizer form component in jsdom (3).
  - Full suites: API 25 suites / 426 tests; web 30 files / 245 tests. Typecheck, lint and both production builds passed.
- **Real-browser QA (Chrome via Playwright, 21/21 PASS)** on an isolated local stack: local Postgres in Docker, local API with email in log mode, a throwaway organizer and three fixture events, deleted afterwards. Covered:
  - legacy warning shown, value not rendered as a link
  - an unrelated title edit saved while price, end, links and image stayed untouched
  - status → `PENDING_REVIEW`
  - all five fields cleared to NULL with the start kept
  - overnight event round-trips unchanged
  - a new invalid link blocked with the Croatian toast and nothing saved
  - a scheme-less link normalized to https
  - all-day end extended, then removed back to a single day
  - a timed multi-day end added
  - no console errors
- **Production:**
  - Railway API restarted 09:51:25 UTC, after the push at 09:49:35 UTC; health ok, db ok.
  - Vercel deployment `manifestacije-7mdkes97v` READY at `62759b51`, aliased to manifestacije.hr / www.
  - The deployed JS bundle contains the new editor strings.
  - Prod smoke QA in Chrome: public pages, ticket/source links, images, organizer login/register and admin login all OK. An unauthenticated organizer edit redirects to login. No console errors besides the expected 401 before that redirect.
- **Not verified in production:** the authenticated organizer edit flow itself. There is no production organizer test account, and no real production event was edited. That flow is verified end-to-end only on the isolated local stack.

### New finding (not fixed, out of scope)
- `GET /api/auth/me` sits under the auth controller's `@Throttle(10/min)`. `useOrganizerAuth` calls it on every organizer page. On a 429 it clears the session and redirects to login, so an organizer who opens more than about 10 organizer pages per minute is logged out.
- Behind Railway, if `req.ip` is the proxy (E14), the bucket may be shared by all users.
- Reproduced locally during QA. Likely related to AUTH-01. Recommended next fix: exempt `/auth/me` from the auth throttle, or give it a separate higher limit, and do not log out on 429.


---

## L. AUTH-01 — session reliability fix (updated 2026-10-09)

**Status: PARTIAL.** The session and throttling defects are fixed and pushed in `e7e8d1c4`. The original organizer login reports have not been reproduced and remain unverified.

**Root causes found:**
1. `GET /api/auth/me` was capped by the auth controller's 10/min throttle. It was called twice per organizer page load, and any non-2xx response, including 429, cleared the organizer session. Reproduced locally.
2. Express had no trusted-proxy setting, so behind Railway `req.ip` was a rotating proxy-hop address. A production probe made 7 `/auth/me` requests in a row and every one showed `x-ratelimit-remaining: 9`. Throttle buckets were effectively random, so login brute-force protection did not work per client.

**Fix:**
- API: on Railway, exactly one proxy hop is trusted (override with `TRUST_PROXY_HOPS`), so forged `X-Forwarded-For` entries are ignored.
- API: `/auth/me` has its own 300/min limit. Login and register keep 10/min per client IP. The 429 message is now in Croatian.
- Web: only a 401/403 response or an expired token ends a session. A 429, 5xx or network failure shows a Croatian retry banner and keeps the session.
- Web: one session check per page load, reused for 30 seconds.
- Admin: 403 no longer logs the admin out, and a network error no longer clears the token.
- Login pages show Croatian error messages.

**Evidence:**
- API: `auth-session-throttle.spec.ts` (10 tests, real HTTP server) covers 60 checks per minute, session checks not using the login quota, failed logins limited at 10, 401 for expired/revoked/forged tokens, per-client buckets behind a proxy, forged XFF ignored, and admin.
- Web: 29 new tests.
- Full suites: API 436/436 and web 277/277 pass. Lint, typecheck and builds are OK.
- Local Chrome QA with throwaway accounts (since deleted), all PASS:
  - 25 organizer page loads in 14 s without being logged out
  - 429, 503 and network failure each keep the session and show the banner
  - 401 and an expired token sign out with a notice
  - wrong password shows a Croatian message
  - the lockout message appears at the limit while another browser's session is unaffected
  - admin: 15 page loads, 429 keeps the session, 401 signs out

**Deployed and verified in production:**
- Railway restarted 10:15:27 UTC, after the push at 10:14:03 UTC.
- Vercel deployment `manifestacije-621fdgtop` is READY at `e7e8d1c4`.
- Probe: three consecutive `/auth/me` requests returned `x-ratelimit-remaining` 299 → 298 → 297, the third with a forged `X-Forwarded-For`. Throttle buckets are now per client and forged headers are ignored. Before the fix, every request showed a fresh bucket.

**Not verified:**
- The original reported organizer login failures. This needs read-only production account data (mixed-case emails, user↔organizer links), which I could not access.


---

## M. Date/time/weekend correctness package (2026-10-09)

**Scope:** EVT-04, EVT-05, PUB-03, PUB-04 and the requested PUB-05 ordering behavior. These IDs are DONE for the implemented behavior and automated regression evidence below. Live LLM/browser checks have explicit blockers; DONE does not claim those checks passed. Prior per-item findings above describe the pre-fix baseline and are superseded here.

### Root causes and changes

- LLM instructions contained a fixed year and UTC+2 offset; fallback parsing used the server timezone and had an 18:00 fallback. The old offset helper also reconstructed locale strings in the server timezone. New `common/zagreb-time.ts` resolves local times through `Intl` in Europe/Zagreb and round-trips candidate instants. Nonexistent spring times and ambiguous autumn times are rejected for review. Valid explicitly offset schema.org dates remain unchanged.
- `ai-parser/date-evidence.ts` recognizes Croatian nominative/genitive month names (including rujan/rujna = 09 and listopad/listopada = 10), numeric/ISO dates, colon/dotted/hour-unit times, and masks dates before scanning clocks. Invalid calendar dates are rejected. Missing years use the current Zagreb year with an explicit review warning.
- LLM responses must quote literal per-candidate/per-occurrence date/time evidence. Text evidence must occur in the source; screenshot evidence is independently parsed for month/day/time consistency. Conflicting or missing evidence clears startsAt and adds missingFields/warnings. A partial invalid occurrence schedule cannot silently import its remaining slots. End times require evidence, and a supplied end clock before the start clock advances to the next local day. This validates extraction; it cannot independently prove OCR transcription from pixels.
- Missing fallback times no longer become midnight/all-day events. Known dates remain in Croatian review warnings. Date-only listing/structured-source contracts retain date-only all-day representation, with listing warnings routed to NEEDS_REVIEW in both admin and monitored-source ingestion. Same-day all-day candidates remain available for review. Existing stored event records are never rewritten.
- Overnight classification is presentation-only: timed, following Zagreb calendar morning, end at or before 06:00:00, positive elapsed duration strictly below 24 hours. Tests cover the cutoff, full-day/multiple-day ranges, all-day exclusion, DST and year rollover. Grouping uses the starting evening and shows 22:00–02:00. API timestamps, JSON-LD and ICS endpoints remain actual instants.
- Weekend grouping excludes finished entries and prior-day sections; genuine ongoing ranges remain on current/future weekend days. A still-active prior-evening overnight is shown once under “Još traje · petak” (or subota), keeping its original start date. Explicit occurrences are checked independently, with unique occurrence keys and a unique-event summary count.
- API discovery fetches fresh starts independently of the old 500-result pool, combines/deduplicates by slug, and orders fresh/current-day starts before continuing ranges. Occurrence-backed events use their next active slot. Homepage retains poster diversity and rotation within each priority tier; manual featured choices remain authoritative. Text-search relevance order is preserved. Long-running festivals remain discoverable; the existing 500-result response cap remains.
- All-day ranges retain their inclusive final Zagreb date in API visibility, overlap and web expiry. Timed endpoints remain exclusive.
- Homepage, today, weekend and city/region weekend pages render per request (`revalidate = 0`). Explicit discovery fetch TTLs remain 300 seconds, with a Zagreb clockDate cache discriminator; weekend fetches use revalidate 0. This avoids stale full-page date labels and previous-day/week API periods at midnight. Existing event-tag invalidation remains. See `docs/public-event-cache.md`.

### Automated verification

- API: 27 suites / 489 tests passed, including real localhost auth HTTP integration tests and 48+ parser regressions. New `event-parsing-dates.spec.ts` covers CET/CEST, DST gaps/folds, leap dates, Zagreb year rollover, Croatian written months, clock formats, date-vs-time, absent/ambiguous times, literal source evidence, screenshot-response month/time mismatches, overnight ends and partial schedules.
- API public-feed tests cover fresh-event retrieval beyond an ongoing-event-filled 500-row cap, real-slot ordering, publication/filter preservation, and all-day visibility/overlap predicates. Admin ingestion verifies NEEDS_REVIEW for structurally complete date-only candidates.
- Web tests cover overnight classification/display, weekend Friday/Saturday/Sunday and midnight boundaries, ongoing ranges, independent occurrences, all-day final-day expiry, search-order preservation, midnight cache keys, and actual JSON-LD/ICS overnight endpoints. Full suite: 33 files / 305 tests passed.
- Timezone reruns: API date/weekend/feed suites 67/67 under TZ=Asia/Tokyo; web date/weekend/adapter suites 61/61 under TZ=America/Los_Angeles. Main suites run in the normal environment.
- API production build and TypeScript check passed. Web production build uses a localhost synthetic API (no fallback-data build claim); route output confirms dynamic clock-dependent pages. Full monorepo lint passed (API/shared TypeScript; web ESLint without warnings), and explicit web/API TypeScript checks passed.
- Production-build HTTP QA: synthetic events, controlled server clock, ordinary repeated GETs to the same `/ovaj-vikend` URL. Twelve checks (desktop/mobile user agents × six instants) passed: Friday 19:00, Saturday 00:00 and 02:00, Sunday 00:00 and 23:00, Monday 00:00. Asserted headings, absence of finished events, single overnight entry, both clocks, ongoing-festival ordering, next-weekend rollover and `private, no-cache, no-store` responses. These are HTML/rendering assertions, **not browser layout QA**. Temporary artifacts: `/tmp/manifestacije-time-qa/http-results.json` and HTML snapshots.

### Specific verification blockers and limits

- **BLOCKED — desktop/mobile browser QA:** the catalogued Browser plugin version had a stale path; the installed version bootstrapped but reported “No browser is available”, and browser discovery returned `[]`. No visual/mobile layout success is claimed and no manual QA is assigned to the user.
- **BLOCKED — live poster extraction/provider verification:** four synthetic poster fixtures were prepared for September, October, winter and missing time. The configured Anthropic key returned HTTP 401 `invalid x-api-key` on the first request. No live extraction success is claimed. Screenshot-response regression tests mock the provider and exercise the real normalization/validation code. Original content-team screenshots were not available in this handoff.
- Existing incorrect production dates are not backfilled or edited. DST folds without a source offset require admin review. Conservative evidence validation can send more candidates to review. Open tabs need reload/navigation to refresh. Dynamic page rendering and an extra bounded public-feed query increase request work; no performance improvement is claimed.
- Production data, accounts, auth/reset flows and the deferred roadmap are outside this change. Pre-existing `docs/project/*` edits and the untracked backlog document remain untouched and excluded from commits.

### Commit and deployment evidence

Implementation commit and deployment verification are pending at this point; append exact results after push. No production event data is modified for verification.
