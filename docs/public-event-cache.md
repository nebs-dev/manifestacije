# Public event cache invalidation

## Behavior and deployment order

Deploy the web endpoint changes first, then the API changes (or both together).
The API now sends awaited, bounded webhook requests after committed public mutations.
A failed webhook is logged and returns false; it does not undo a successful save or
turn it into a cache-delivery exception. No queue or new infrastructure is required.

The web endpoint accepts POST JSON `{ "tag": "events" }` (also partners, taxonomy,
organizers). It requires `x-revalidate-secret`, rejects missing server configuration
with 503, incorrect credentials with 401, and malformed/unsupported tags with 400.
It calls `revalidateTag` before returning `{ "revalidated": true, "tag": "events" }`.
Invalidation errors return 500. An events invalidation also expires organizers,
because organizer responses contain event lists/counts. Dependent Full Route Cache
entries are invalidated through their data dependencies; no additional
`revalidatePath` calls are needed. This does not push updates into open browser tabs.

Each delivery attempt has a 2.5-second timeout including acknowledgement reading.
There are at most two attempts: retry once on network/timeout, 5xx, 408 or 429.
Other 4xx responses, including 401/403, are not retried. Redirects are rejected.
A 2xx response must contain the expected success acknowledgement and tag.
Missing configuration and invalid origins are logged without sending a request.
Logs contain event/outcome/tag/attempt/status or missing variable names, never
secrets, response bodies, raw network errors, or credential-bearing URLs.
One webhook can add roughly five seconds on failure. Multi-event series and
operations invalidating more than one tag can incur multiple bounded deliveries.

## Coverage

| Mutation | Before | After |
| --- | --- | --- |
| Admin create/publish/import | Wrapper fire-and-forget | Shared EventsService, awaited |
| Edit public event, dates, occurrences, slug, categories, image, price, location | Admin wrapper only | Shared EventsService, awaited, covers all callers |
| Status/unpublish/archive, bulk status | Fire-and-forget | Awaited; old/new public visibility considered |
| Delete, bulk date shift | Fire-and-forget | Awaited for public events |
| Bulk category add/remove | Missing | Awaited when affected events have public output |
| Trusted organizer auto-publication | Missing | Shared EventsService |
| Organizer edit: published to pending | Missing | Shared EventsService checks previous status |
| Organizer profile/status/claim | Missing | Awaited events invalidation; also expires organizer cache |
| City/category edits | Missing | Awaited events and taxonomy invalidation |
| Shared venue edited while saving a draft | Missing | Checks for other public events using that venue |
| City region self-repair during save | Missing | Callback invalidates events and taxonomy after repair |
| Location repair script | Missing | After actual writes, awaited invalidation in final cleanup |
| Partner create/update/delete | Fire-and-forget | Awaited partners invalidation |

Public includes PUBLISHED events and ARCHIVED events with publishedAt, because
historical detail pages remain public. Private draft creation/edit/deletion and
empty event updates do not invalidate. Draft duplication and organizer deletion
of private draft/review events remain private. Passwords, admin viewed markers,
source parsing/review metadata and duplicate-candidate review status do not change
public event output. Direct SQL/manual scripts outside these paths still require
explicit invalidation or rely on fallback expiry.

## TTLs and freshness

| Data / route | Fallback |
| --- | --- |
| fetchEvents: homepage, today, weekend, city/region/category discovery, calendar, search/list filters | 300 seconds, events tag |
| Homepage, /danas, /ovaj-vikend Full Route Cache | 300 seconds confirmed in build manifest |
| Map events | 300 seconds, unchanged |
| Individual event fetch | 60 seconds, unchanged |
| Organizer fetch | 60 seconds, unchanged |
| Partners | 3600 seconds, unchanged |
| Taxonomy API fetches | 3600 seconds, unchanged |

Only fetchEvents explicitly changes TTL. The generic fetchApi default remains 60.
Dynamic discovery routes still render per request even though their data cache is
300 seconds; the TTL does not make every discovery route static.

Successful invalidation removes cached data so the next server request rebuilds
from fresh data. With healthy infrastructure, expect propagation on that request
plus delivery/render latency, rather than waiting five minutes. Existing browser
Router Cache or an already-open tab can still need a fresh navigation/hard reload.

On delivery failure, the five-minute TTL is eligibility for request-driven
refresh, not a strict wall-clock deadline: under regular traffic expect up to
about five minutes plus regeneration time and the next request. The request that
triggers time-based refresh can receive stale content. Without traffic or during
upstream failures, stale age can exceed five minutes. Clock-dependent event expiry,
today/weekend boundaries, calendar dates and daily rotation continue to refresh
without admin mutations. Existing API adapter fallback behavior remains unchanged.

## Required production configuration (not remotely verified)

- API `WEB_URL`: canonical web origin, normally `https://manifestacije.hr`.
  Must be HTTP(S) origin only, optional trailing slash; no credentials, path,
  query or fragment. It must reach the intended deployment without redirects.
- API and web `REVALIDATE_SECRET`: identical nonempty secret. Replace the example
  placeholder. Restart/redeploy both services after changing configuration.
- Web `NEXT_PUBLIC_API_URL`: production API origin serving the same database that
  receives admin writes. It is consumed at build time; rebuild after changing it.
- Web `NEXT_PUBLIC_WEB_URL`: correct canonical production web origin.
- API must be able to reach web POST `/api/revalidate`. Vercel deployment protection,
  WAF or authentication must not intercept the webhook. The endpoint itself remains
  protected by its shared secret; do not expose secrets in commands/log captures.
- Verify the deployed build manifest and deploy IDs, not just local files. Keep
  production/preview API, web and secrets paired to prevent cross-environment busts.

## Production smoke test after deploy

1. Choose an existing published event visible on the homepage. Record its title,
   slug, category, city, publication status, and applicable discovery URLs. For
   today/weekend testing use an event with matching occurrences. Warm those exact
   URLs twice with ordinary GET requests; record timestamps and cache headers.
2. In admin, make a reversible meaningful edit, such as a small title correction.
   Record save completion time and event ID. Avoid a redeploy or manual cache purge.
3. In API logs, require `event=cache_revalidation`, `outcome=success`, `tag=events`.
   In web function logs, require `event=cache_revalidation_web`, `outcome=success`,
   `tag=events` in the same time window. A final_failure or skipped log fails the
   smoke even if the save succeeded. Never capture the secret header.
4. Within 60 seconds of saving, request the SAME warmed URLs with a fresh ordinary
   HTTP client (or hard reload). Do not add random query strings or no-cache headers.
   Confirm the changed title is present in HTML/RSC on relevant pages. Cached
   homepage HTML becoming fresh well before 300 seconds proves explicit busting.
   Use `/eventi` for an event not selected into homepage rails; selection rules do
   not guarantee every published event appears on the homepage.
5. Repeat through admin publish, unpublish/archive and bulk category change using
   an appropriate test event. Confirm discovery presence/removal/category routing.
   Archived detail pages can intentionally remain available. Verify trusted
   organizer publication and published-to-pending edit in a preview environment
   with the same deployment configuration.
6. Restore the original event fields/status through admin; require the same logs
   and fresh public content. Record deploy IDs and measured save-to-visible times.
7. In preview, deliberately use a wrong API webhook secret, save a public edit,
   and verify 401/no retry/final_failure while the save succeeds. Restore the secret.
   Test fallback with a warm unchanged cache, a failed invalidation, then ordinary
   polling past 300 seconds; allow the refresh-triggering stale response and
   regeneration. Do not intentionally break production secrets for this test.

A standalone valid webhook test alone proves endpoint access, not mutation coverage;
the admin-write chain above is required. Production config and this chain have not
been exercised by the local checks.

## Local verification

API/web unit tests cover delivery outcomes, endpoint validation, public/private
mutation guards, required organizer/admin flows, and distinct TTL policies.
A production Next build with a local fixture API confirmed 300-second entries for
/, /danas and /ovaj-vikend. Compiled RevalidateService was then run against the local
production endpoint: homepage HIT, origin changed but still HIT, awaited webhook
success, next request MISS with fresh content, following request HIT. This verifies
actual Next cache invalidation independently of mocked revalidateTag tests.

Baseline API tests had stale fixture dates, old constructor wiring, a removed helper
reference, and a missing email-template field. Tests were updated to current APIs;
no unrelated production behavior was changed to make them pass.

## Compare after 3–7 days

Use equal deployment/time windows, normalize for page requests and mutation volume:
- Combined / and /index Active CPU, invocation count, CPU per invocation, and
  invocations/CPU per 1000 homepage requests. Do not double-count metric dimensions.
- /danas and /ovaj-vikend equivalents; separate dynamic discovery route costs.
- Cache HIT/MISS/STALE rates, ISR regeneration count/duration where exposed.
- Public event API request volume/latency, webhook success/retry/failure/skip counts.
- Publish/edit/unpublish-to-visible latency and admin save latency (including tails).
- Actual request path, HTML/RSC, bot/user-agent, deployment and region breakdowns.

No CPU savings are claimed until measured. Broad events invalidation still expires
all tagged discovery/detail data after a public mutation.

## Files changed for this task

- `.env.example`
- `apps/api/src/admin/admin.service.ts`
- `apps/api/src/admin/revalidate.service.ts`
- `apps/api/src/common/city-resolver.ts`
- `apps/api/src/events/events.module.ts`
- `apps/api/src/events/events.service.ts`
- `apps/api/src/organizer-claims/organizer-claim.service.ts`
- `apps/api/src/organizers/organizer.service.ts`
- `apps/api/src/scripts/claims-invite-unclaimed-organizers.ts`
- `apps/api/src/scripts/repair-event-locations.ts`
- `apps/api/test/admin.service.spec.ts`
- `apps/api/test/email.service.spec.ts`
- `apps/api/test/event-cache-invalidation.spec.ts`
- `apps/api/test/event-occurrences.spec.ts`
- `apps/api/test/events-images.spec.ts`
- `apps/api/test/monitored-sources.spec.ts`
- `apps/api/test/organizer-claim.service.spec.ts`
- `apps/api/test/organizer.service.spec.ts`
- `apps/api/test/revalidate.service.spec.ts`
- `apps/web/app/api/revalidate/route.ts`
- `apps/web/src/lib/discovery-cache.test.ts`
- `apps/web/src/lib/public-api.ts`
- `apps/web/src/lib/revalidate-route.test.ts`
- `docs/public-event-cache.md`

Earlier homepage canonical/redirect-comment changes and pre-existing docs/project edits are not part of this cache change.
