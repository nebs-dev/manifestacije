# Manifestacije.hr — Release-readiness E2E audit (2026-10-12)

Baseline: `main` @ `f50278c6` (latest code change `b55a5045`). Assessment only. No code was changed or committed. One throwaway local edit used to verify a fix was reverted.

**Method.** Real Chrome (Playwright, `channel: chrome`) against local **production builds** (`next build`/`next start` and compiled NestJS). The API used an isolated PostgreSQL 16 database (`127.0.0.1:5442/rr_qa`, all 26 migrations applied). Accounts were synthetic: two admins (Vanesa/Andrijana QA) and seven organizers created through the real registration UI. Data was 23 synthetic public events covering FREE/PAID/UNKNOWN pricing, overnight and multi-day events, today and the weekend, four cities and coordinates. Viewports: 1366×900, 390×844 and 360×740.

**External services:**
- Email: Resend in `log` mode. Deliveries were recorded but **not sent**.
- AI parsing: **MOCKED.** A local stub of the Anthropic Messages API returned one fixed candidate.
- Image upload (Cloudinary): credentials blanked, so uploads were unavailable.
- Geocoding: public OSM Nominatim fallback, with the Google key blanked.

**Production:** GET navigation only, anonymous, no form submissions.

Evidence (scripts, logs, screenshots): `/tmp/manifestacije-rr-2026-10/`.

---

## 1. Scenarios attempted

### A. Public visitor (local, 3 viewports): 72 of 75 checks behave correctly

| Scenario | Result |
|---|---|
| Homepage, city page (`/gradovi/osijek`), regions | PASS. The homepage rotates its event pool daily by design, so today's event is not guaranteed a homepage slot. |
| Search (`/eventi?q=`, homepage search form), free/city filters | PASS |
| Event detail: image loads, ticket link, `.ics` download, 404 for unknown slug | PASS |
| `/danas`, `/ovaj-vikend`, `/kalendar` | PASS |
| Overnight event (Fri 22:00–Sat 02:00): one card under Petak, "22:00–02:00", not multi-day | PASS |
| Multi-day festival shows date range | PASS |
| Pricing: FREE "Besplatno", PAID with amount, PAID without amount "Naplata", UNKNOWN "Cijena nije navedena" | PASS |
| Map: Leaflet renders markers on desktop and mobile | PASS |
| Calendar → event → Back keeps position (PUB-02) | PASS ×3 |
| Horizontal overflow, console errors, failed requests (local) | PASS |
| `/mapa` has an `<h1>` | **FAIL ×3** (P2-4) |

Card text below the fold is revealed on scroll (`whileInView`). Initial mobile mismatches were confirmed as test artifacts after a user-like scroll.

### B. Organizer (local): all scripted steps PASS at 1366, 390 and 360

| Scenario | Result |
|---|---|
| Registration lands on "Događaji" without reload; logout; login without reload | PASS ×4 runs |
| Create event (schedule, venue, location picker, category); default "Besplatno"; appears as "Na pregledu" | PASS |
| Duplicate warning while typing, confirmation required on save, cancel keeps the form | PASS |
| Edit a pending event ("draft") | PASS |
| Submit URL + text for parsing **[AI MOCKED]** | PASS (201) |
| Submit poster **[AI MOCKED]** | PASS. Upload storage was unavailable; the UI warns that the screenshot is used for parsing but not stored as evidence. |
| Submitted requests listed ("Poslani zahtjevi") | PASS |
| Edit a published event: notice shown, "Izmjene na pregledu" badge, public version unchanged until approval | PASS (desktop and 390) |
| Invalid/expired session → login with "Sesija je istekla…" → recovery | PASS |
| Submission with the AI provider unavailable | **FAIL** (P1-2) |
| Location suggestions on mobile | Works once the field is mid-screen. P2-3. |

### C. Administrator (local)

| Scenario | Result |
|---|---|
| Login; bell count with tooltip ("14 nepročitano · 7 čeka pregled") | PASS |
| Pending organizer events: approve ×2 / reject ×1; public API reflects the result | PASS |
| Organizer source → parsed candidate **[AI MOCKED]** → "Kreiraj i objavi" → public | PASS |
| Manual create (published) → public; edit → public updated; "Otvori" toast action | PASS |
| Duplicate warning in admin create | PASS |
| EventRevision review: diff (8 EUR → 12 EUR, title), approve → live; reject → original kept | PASS |
| Events search; inline pricing → UNKNOWN persisted, price text kept; restore | PASS |
| Creator report present; organizer search with counts; "Prikaži događaje" filter | PASS |
| Duplicates page | PASS |
| Notifications: mark one (4→3), mark all (→0); second admin keeps own unread count (18) | PASS |
| Email-delivery history: records exist; filtering by user ID works | PASS |
| Email-delivery history default (unfiltered) view | **FAIL** (P2-1) |
| Forgot password: generic confirmation; `password_reset` recorded (log mode, not sent) | PASS |
| Admin pages at 390/360: no overflow, headings present (9 pages) | PASS |
| Admin navigation on phones | **Partial** (P2-2) |

### D. Production (read-only, anonymous, 3 viewports)

- **Passed:**
  - 14 public and auth pages return HTTP 200.
  - No horizontal overflow anywhere.
  - No failed requests.
  - Map renders 133 markers with tiles loaded.
  - Event detail images load and `.ics` returns `VEVENT`.
- **Failed:**
  - **Every page throws React error #418** (P1-1).
  - `/mapa`, `/organizer/login` and `/organizer/register` have no `<h1>` (P2-4).

---

## 2. Confirmed P0/P1 defects

**No P0 found.** No core workflow broken, and no data-loss or security issue reproduced in normal operation.

### P1-1 — Hydration failure on every production page

- **Workflow:** all public, organizer and admin pages; every visitor.
- **Steps:** open https://manifestacije.hr/ (or `/eventi`, `/admin/login`, `/forgot-password`) in Chrome and watch the page errors.
- **Expected:** no runtime errors; server HTML is hydrated.
- **Actual:** `Minified React error #418` (hydration mismatch) on every page, in any timezone. React discards the server-rendered tree and re-renders the page on the client. That costs load performance, can cause a visible repaint, and hides genuine errors in the noise.
- **Root cause (reproduced locally by toggling one variable):** `app/layout.tsx` renders `{gaId && <Suspense><PublicAnalytics …/></Suspense>}` as a sibling **after `</body>` inside `<html>`**. Only production sets `NEXT_PUBLIC_GA_ID`, which is why local and CI runs were clean.
  - Local production build without a GA id: 8/8 pages clean.
  - Same build with a dummy GA id: 8/8 pages fail with #418.
- **Minimal fix (verified locally, then reverted):** move that line inside `<body>`, after `{children}`. After the change, 8/8 pages were clean in both Europe/Zagreb and UTC. One-line change.

### P1-2 — Organizer link/poster submissions are lost if AI parsing is unavailable

- **Workflow:** organizer "Pošalji link" (URL, text or poster).
- **Steps:** with the Anthropic credential missing, rejected or the provider down, the organizer submits a URL, text or poster.
- **Expected:** the submission is stored for admin review (admin can "Ponovno parsiraj" later), with a message that processing is delayed.
- **Actual:** `POST /api/organizer/events/submit-url` → **503** "AI parsiranje nije konfigurirano…" and **no EventSource row is created**. `OrganizerService.submitSource` parses before persisting, so the organizer's input is discarded. Reproduced locally with the credential absent.
- **Production exposure: BLOCKED.**
  - Live Anthropic parsing remains unverified (see §4), and a previously available credential was rejected.
  - If the production credential or provider fails, this core intake path fails completely.
- **Minimal fix (either one):**
  - (a) Confirm the production credential works through an authorized admin action.
  - (b) Small backend change: persist the source first, then mark it `NEEDS_REVIEW` with a warning when parsing fails, and return success to the organizer.

---

## 3. Minor P2 defects (all reproduced)

| ID | Defect | Steps / evidence | Minimal fix |
|---|---|---|---|
| P2-1 | Email-delivery history shows "Zapise trenutačno nije moguće učitati" by default | Open `/admin/email-deliveries`. `GET /api/admin/email-deliveries` (no `userId`) → 400 "Validation failed (numeric string is expected)". With `?userId=11` → 200 with records. Cause: the global `ValidationPipe({ transform: true })` converts the absent query value before `ParseIntPipe({ optional: true })`. | Read `userId` as a string and parse manually, or skip transform for this parameter. Workaround: filter by account ID. |
| P2-2 | No admin navigation menu below 768px | Sidebar is `hidden md:flex` with no mobile toggle. On a 390px phone, `/admin` links only to notifications, sources, pending, duplicates and events. Revisions, organizers, email history and users are reachable only by typing the URL. | Add a simple menu sheet to the top bar reusing `nav.ts`, or add the missing links to the dashboard. |
| P2-3 | Location suggestions mispositioned on mobile | The dropdown is `position: fixed` at the input's rect when it renders. If the field is near the viewport bottom, the list opens off-screen. On scroll it stays put (input moved 403→203px, list stayed at 445px). Selection works once the field is mid-screen. Affects organizer and admin forms. | Use absolute positioning in the relative wrapper, or recompute on scroll/resize. |
| P2-4 | Missing `<h1>` | `/mapa`, `/organizer/login`, `/organizer/register` (production and local). | Add a visible or `sr-only` heading. |
| P2-5 | English admin labels | Sidebar shows "Dashboard", "Events", "Pending events", "Sources", "Organizers", "Users", "Duplicates", "Categories"…; organizer header shows "Organizer portal". Known backlog **ADM-04**. | Croatian label strings in `nav.ts`/shell. |

**Observed, not defects:**
- Homepage daily rotation.
- Admin create stays on the form with an "Otvori" toast.
- Candidate cards collapsed by default.
- Upload warning when storage is unavailable.

---

## 4. External verification blockers (BLOCKED)

| Item | Status |
|---|---|
| Real email delivery (welcome, reset, admin notifications; AUTH-02/04) | BLOCKED. Only log-mode records verified; no Resend/provider access. |
| Live Anthropic parsing (URL/poster) | BLOCKED. Mocked locally; production credential state unknown. Directly affects P1-2. |
| Cloudinary poster/image upload in production | BLOCKED. Locally unavailable by design. |
| Authenticated production workflows (organizer/admin) | BLOCKED. No authorized production sessions; no production writes allowed. |
| Original Schleis/Hoochy login incidents (AUTH-01) | UNKNOWN / NEEDS RUNTIME. |
| Safari / iOS WebKit | BLOCKED. Chrome only. |
| Historical event date corrections | Not verified; no silent data changes made. |
| Google Places geocoding | Not exercised. The local run used the public Nominatim fallback. |

---

## 5. Recommendation

**READY WITH LIMITATIONS.**

- Public discovery, organizer intake and editing, the admin moderation and revision loop, pricing, notifications and calendar navigation all worked end-to-end in real Chrome on desktop and phone widths, against a real database.
- Production serves all pages correctly and fits mobile screens.
- The remaining risks are not workflow breakage:
  - one production-wide hydration error with a one-line fix;
  - a dependency on an unverified AI provider that can discard organizer submissions;
  - small admin usability gaps.

## 6. Minimum work before switching focus to growth

1. **Fix P1-1** (move `PublicAnalytics` inside `<body>`). Deploy, then re-run the production console check. About 15 minutes.
2. **Resolve P1-2:**
   - Either confirm the production Anthropic credential with one authorized admin re-parse,
   - or apply the small persist-before-parse change, so organizer submissions are never lost.
3. **Unblock delivery verification:** give the agent read access to the Resend dashboard/logs or a designated test inbox, so welcome/reset delivery can be confirmed once.
4. **Optional, about half a day, can follow growth work:**
   - P2-1 (email history default view);
   - P2-2 (admin mobile menu);
   - P2-4 (headings);
   - P2-3 (location dropdown).

After items 1 and 2, development can stop and focus can move to event content, acquisition, retention and real usage. Remaining backlog features (EVT-07/08, EVT-03, EVT-01, NOT-03, ADM-04) are enhancements, not readiness blockers.


---

## Update — final stabilization batch (2026-10-12, later the same day)

The original findings above are preserved as recorded. Follow-up work (details in `docs/BUG_REQUEST_AUDIT.md` §X and §Y):

| Finding | Status | Evidence |
|---|---|---|
| P1-1 Hydration #418 on every page | **FIXED** (`e43ac209`) | Reproduced 7/7 with a dummy GA ID before the fix; after it, 33/33 local checks clean; **production 49/49** (5 widths × 9 pages): no #418, GA loads on public pages only. |
| P1-2 Organizer submissions lost on AI failure | **FIXED** (`e43ac209`) | Persist before parsing; retained on provider/credential/timeout/format failures; idempotent retries; admin notice + re-parse. 11/11 browser checks with **mocked** Anthropic; PostgreSQL integration tests. Live Anthropic still unverified, but no longer able to lose submissions. |
| P2-1 Email history default view 400 | **FIXED** (`e0bb2667`) | Unfiltered admin history returns 200 (integration test). |
| P2-2 No admin navigation below 768px | **FIXED** (`0d7ac9f6`) | Accessible drawer; all 15 sections reached at 320/360/390/430. |
| P2-3 Location suggestions mispositioned on mobile | **FIXED** (`0d7ac9f6`) | Follows window and inner-container scroll, flips/caps near the bottom, keyboard support; 70/70 + 12/12 checks. |
| P2-4 Missing H1 (`/mapa`, organizer login/register) | **FIXED** (`0d7ac9f6`) | Single H1 on each, also in production. |
| P2-5 English admin labels (ADM-04) | Open (backlog) | Unchanged by design. |
| Resend Contacts 401s | **FIXED** (`e0bb2667`) | `RESEND_CONTACTS_SYNC=disabled` set in Railway by the owner; permission errors short-circuit. |
| Resend delivery-status webhooks | **PENDING**: `RESEND_WEBHOOK_SECRET` not set in Railway (verified by a safe probe); no authorized tooling to transfer it | Delivery itself is verified by the owner's dashboards (28/28 Delivered). |

**Revised recommendation: READY WITH LIMITATIONS.** Both P1 defects and the reproduced P2 UI defects are fixed and deployed. Remaining limitations:
- the webhook secret configuration step (delivery tracking only; sending works);
- live Anthropic parsing unverified (submissions are now safe regardless);
- authenticated production workflows not exercised, as before;
- Safari/iOS not tested.

Development can shift to content, acquisition and real usage.

---

## Update — final feature batch (2026-10-12, afternoon)

The findings above are preserved. Seven remaining requests were completed and deployed (details: `docs/BUG_REQUEST_AUDIT.md` §Z; editor guide: `docs/UREDNICKI_VODIC_NOVE_FUNKCIJE.md`):

| ID | Status |
|---|---|
| ADM-04 | **DONE**: Croatian organizer/admin terminology |
| NOT-03 | **DONE**: publication email with Facebook/WhatsApp sharing, sent once; organizer share panel |
| SEO-02 | **DONE on-page**: ranking impact needs Search Console |
| EVT-07 | **DONE**: up to 4 screenshots per parse, one AI request |
| EVT-08 | **DONE**: supplemental re-parsing with field-by-field proposals |
| EVT-03 | **DONE**: safe rich-text descriptions |
| PUB-06 | **DONE**: past events archive |
| EVT-01 | **DEFERRED** by owner decision |

**Backlog:**
- 29 DONE, 1 DEFERRED (EVT-01), 3 UNKNOWN / NEEDS RUNTIME (AUTH-01, SEO-01, ANA-01).
- 0 partial, 0 not implemented, 0 known bugs.

**Tests:** API 738 and web 465, all passing.

**Production:** read-only smoke 25/25, no runtime or hydration errors.

**Recommendation unchanged: READY WITH LIMITATIONS.** Remaining operational items:
1. Set `RESEND_WEBHOOK_SECRET` in Railway (dashboard step) to activate delivery-status tracking.
2. Verify live Anthropic parsing once in production (all AI behavior in this batch was tested with a mock).
3. Search Console / GA4 review for SEO-01, SEO-02 and ANA-01.
4. Evidence for the original Schleis/Hoochy login incidents (AUTH-01), if they recur.
