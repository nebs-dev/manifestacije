# UX Batch 1 — implementation report

Implemented; automated validation passes. Manual browser validation remains pending because the browser runtime reported no available browser.

## 1. Homepage city search: root cause and contract

`/eventi` already read `grad`. The bug was passing the human-entered city name unchanged to the API, which compares `city.slug` exactly. `Osijek` therefore did not match `osijek`.

Read-only production HTTP checks during this task confirmed:

| Existing production request | Results |
| --- | ---: |
| `/eventi?grad=Osijek` | 0 |
| `/eventi?grad=osijek` | 73 |
| `/eventi?grad=dakovo` | 2 |
| `/eventi?grad=osijek&q=koncert` | 19 |

These checks validate the existing API contract and inventory, not a deployment of these changes.

Canonical contract: `/eventi?grad=<city-slug>&q=<optional-text>`. Homepage submission trims/normalizes the city, including Croatian diacritics (`Đakovo` → `dakovo`) and spaces (`Slavonski Brod` → `slavonski-brod`). Server-side `fetchEvents` also normalizes legacy uppercase city values. Text and city remain separate AND constraints. An unknown city remains a city constraint; it is not folded into text search. URLs remain shareable; filter controls derive state from URL parameters.

## 2. Event filter UX

A visible summary above results includes text, city, region, date range, category and free admission when active. Individual chips remove only their filter; reset clears discovery filters. Calendar date/view parameters survive reset. Summary stays available outside the mobile drawer.

Clicking the selected category clears it. “Sve kategorije” still clears the category. Search copy now says “Pretraži naziv, grad ili lokaciju…”. Existing category/search/date/free combinations retain AND semantics. URL navigation supports Back/forward restoration.

## 3. Duplicate concepts

The database has no independent children/outdoor attributes used by this public filter path. `fetchEvents` already maps `djeca=1` to `djeca-i-obitelj`, and `vani=1` to `na-otvorenom`. These URL flags are category aliases, not additional independent AND conditions.

Canonical controls are categories. Duplicate attribute checkboxes and calendar quick chips were removed; homepage quick links now write `kategorija`. Existing alias URLs still work. On subsequent filter changes they normalize to the category parameter. Historical precedence remains explicit category > children > outdoor; previously ignored flags do not unexpectedly start narrowing results. Category removal also removes its legacy aliases so they cannot reactivate it.

No category records were deleted or migrated. Dedicated category/SEO routes remain available, including legacy taxonomy slugs.

## 4. Calendar date navigation

The old code already attempted `scrollIntoView`, but omitted empty-day sections, discarded empty day-strip selections, combined local date state with URL replacement, and placed agenda ancestors inside hidden-overflow containers.

Date/view now derive from URL state; date selection pushes a history entry while preserving filters. Agenda scrolling runs in an animation frame after React commits the relevant sections. An explicit empty-day section exists for the selected date. Re-selecting the same date triggers another scroll. Initial `datum` URLs and history navigation follow the same behavior. Reduced-motion preference uses immediate scrolling. Date/view are included in event-detail return URLs. Hidden-overflow agenda ancestors were removed.

Calendar now consumes `kada` when present, matching its existing date-filter controls; previously those controls could appear selected without constraining the fetched events.

## 5. Map mobile structure and viewport

Mobile uses stacked list and map. Grid tracks use `minmax(0,1fr)` and children can shrink. The list scrolls within a maximum height; the map has its own visible height. Desktop retains the side-by-side arrangement. Titles wrap, controls have larger touch targets, and the invalid nested details-link-inside-button structure was replaced with separate title-selection and details controls.

Default bounds are `[[44.95, 16.9], [46.1, 19.5]]` for Slavonija/Baranja. They do not depend on event outliers, and events outside the bounds remain in the data/pins.

An exact normalized city match among search results recenters to known city coordinates, or median result coordinates for another city, at zoom 12 over 0.5 seconds. Generic text, partial city names and empty results do not trigger geographic recentering. Search remains local over the existing map data. CARTO authentication, Voyager styling and attribution are unchanged.

## 6. Related events

Maximum three results, ranked deterministically:

1. Same city and category.
2. Same region and category.
3. Same city.
4. Same category.
5. Nearby/upcoming fallback.

Secondary categories participate. Unknown region is not treated as a relevant region match. Fallback uses approximate geographic distance when coordinates exist. Date, time and slug provide stable tie-breaking. Current, expired and duplicate events are excluded, including identical title/city/date/time records with different slugs. Publication filtering remains enforced by the existing public-feed API.

Title is now “Moglo bi te zanimati”, reflecting the broader fallback honestly. Candidate retrieval retains the existing public-feed limit of 500; no recommendation service or new data retrieval architecture was added.

## 7. Live category inventory

Added optional `GET /api/public/categories?counts=true`. It adds `upcomingCount` using the same published/upcoming visibility predicate as public discovery. It counts each event once per category across primary and secondary assignments, without the 500-item listing cap. Plain taxonomy requests are unchanged.

Homepage promotions and `/eventi` category controls use these counts, omit zero-inventory promotions and order stronger inventory first. A selected empty category remains visible/removable on `/eventi`; its direct URL and SEO page remain intact. No hardcoded category exclusion/ranking list was added.

Counts cache for 300 seconds with `events` and `taxonomy` tags, so existing publish/update invalidation refreshes counts. Deploy API before web for immediate full count support. While an older API is still deployed, homepage can use its existing event inventory and `/eventi` retains available category controls. No database migration is needed.

## 8. Analytics

Existing GA4 helper now supports `home_search`, `filter_change`, `filter_reset`, `calendar_date_select`, `map_city_search` and `related_event_click`. Payloads use boolean intent, filter identifiers/actions, view, result counts and public event slug. New events do not send free-text queries or entered city text. Analytics failures remain non-blocking.

## 9. Validation

- Web typecheck: passed.
- API typecheck: passed.
- Web tests: 191 passed across 26 files.
- API tests: 340 passed across 21 suites.
- Web production build: passed. Local API at `localhost:3001` was unavailable; existing fallback behavior allowed generation, with connection-refused warnings. This is not an end-to-end live API build verification.
- API production build: passed, including Prisma client generation.
- `git diff --check`: passed.
- Production read-only HTTP checks: city casing, another city, combined text/city verified as above.

New component integration tests exercise actual form submissions, category toggling, chip removal/reset, simulated URL/history restoration, mobile drawer open/close, empty/repeated calendar selection, event-detail return state, low-inventory controls, and city-recenter input. Unit tests cover ranking, duplicates/expiry, alias precedence, cache tags and city normalization. API tests cover uncapped inventory and existing publication/AND filtering.

Manual visual checks remain pending: desktop/mobile calendar scrolling geometry, 375px overflow and touch usability, Leaflet viewport/tiles, and full browser navigation round trips. DOM tests do not prove layout geometry. The browser connection was unavailable; no screenshot or manual-browser success is claimed.

## 10. Deliberate limits

No accounts, favorites, notifications, personalization, taxonomy migration, redesign, viewport-driven map filtering, geocoding service, or “search this area” behavior. Existing public feed/map caps remain. No retention improvement is claimed. No push or deploy performed for this batch.

Pre-existing modifications under `docs/project/` were left untouched.

## 11. Exact files changed in this batch

- `apps/api/src/public-feed/public-feed.controller.ts`
- `apps/api/src/public-feed/public-feed.service.ts`
- `apps/api/test/public-feed.service.spec.ts`
- `apps/web/app/eventi/[eventSlug]/page.tsx`
- `apps/web/app/eventi/page.tsx`
- `apps/web/app/kalendar/page.tsx`
- `apps/web/app/page.tsx`
- `apps/web/package.json`
- `apps/web/src/components/public/active-filters.tsx`
- `apps/web/src/components/public/calendar-explorer.tsx`
- `apps/web/src/components/public/category-strip.tsx`
- `apps/web/src/components/public/discovery-explorer.tsx`
- `apps/web/src/components/public/discovery-map.tsx`
- `apps/web/src/components/public/discovery-ux.test.tsx`
- `apps/web/src/components/public/event-card.tsx`
- `apps/web/src/components/public/event-filters.tsx`
- `apps/web/src/components/public/filters-panel.tsx`
- `apps/web/src/components/public/home-hero.tsx`
- `apps/web/src/components/public/prefetch-event-link.tsx`
- `apps/web/src/components/public/quick-filters.tsx`
- `apps/web/src/lib/analytics.ts`
- `apps/web/src/lib/discovery-cache.test.ts`
- `apps/web/src/lib/discovery-filters.test.ts`
- `apps/web/src/lib/discovery-filters.ts`
- `apps/web/src/lib/discovery-map-model.test.ts`
- `apps/web/src/lib/discovery-map-model.ts`
- `apps/web/src/lib/public-api.test.ts`
- `apps/web/src/lib/public-api.ts`
- `apps/web/src/lib/related-events.test.ts`
- `apps/web/src/lib/related-events.ts`
- `apps/web/vitest.config.ts`
- `pnpm-lock.yaml`
- `docs/UX_BATCH_1.md` (this report)
