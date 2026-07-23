# Deployment

Staging target: Railway Postgres + Railway API + Vercel web.

## Required Env Vars

API service:

```text
NODE_ENV=production
PORT=3001
DATABASE_URL=<Railway Postgres connection string>
JWT_SECRET=<long random secret>
PUBLIC_WEB_URL=https://manifestacije.hr
CORS_ALLOWED_ORIGINS=https://<vercel-preview>.vercel.app
SEED_ADMIN_EMAIL=admin@manifestacije.test
SEED_ADMIN_PASSWORD=<staging admin password>
SEED_DEMO_DATA=true
OPENAI_API_KEY=
CLOUDINARY_CLOUD_NAME=<cloudinary cloud name>
CLOUDINARY_API_KEY=<cloudinary api key>
CLOUDINARY_API_SECRET=<cloudinary api secret>
CLOUDINARY_UPLOAD_FOLDER=manifestacije/events
RESEND_API_KEY=<resend api key>
EMAIL_PROVIDER=resend
EMAIL_DELIVERY_MODE=resend
EMAIL_FROM_NAME=Manifestacije.hr
EMAIL_FROM_ADDRESS=info@manifestacije.hr
EMAIL_REPLY_TO=info@manifestacije.hr
ADMIN_NOTIFICATION_EMAIL=info@manifestacije.hr
PASSWORD_RESET_TOKEN_TTL_MINUTES=30
PASSWORD_RESET_URL=https://manifestacije.hr/reset-password
ORGANIZER_CLAIM_TOKEN_TTL_MINUTES=10080
ORGANIZER_CLAIM_URL=https://manifestacije.hr/preuzmi-profil
RESEND_WEBHOOK_SECRET=<resend webhook signing secret>
```

Web service:

```text
NEXT_PUBLIC_API_URL=https://<railway-api-domain>
NEXT_PUBLIC_WEB_URL=https://manifestacije.hr
```

`NEXT_PUBLIC_API_URL` must be API origin only, without `/api`.

## Railway Postgres And API

1. Create Railway project.
2. Add PostgreSQL service.
3. Add API service from this repo.
4. Set API root directory to repo root.
5. Set API env vars above. Use Railway `DATABASE_URL`.
6. Build command:

```bash
pnpm install --frozen-lockfile
pnpm --filter api build
```

7. Start command:

```bash
pnpm --filter api start
```

8. Run migrations after deploy:

```bash
pnpm --filter api prisma:migrate
```

This uses `prisma migrate deploy`, not dev migration.

9. Seed staging DB:

```bash
pnpm --filter api prisma:seed
```

For production, set `SEED_DEMO_DATA=false` before seed if demo events should not be created.

Railway pre-deploy command can run all three root scripts:

```bash
pnpm prisma:migrate && pnpm prisma:seed && pnpm locations:repair
```

`locations:repair` self-heals any City stuck on a bad/placeholder region
(from an old failed geocode or an older version of the resolution logic) by
re-geocoding it — see "Event Location & Region Resolution" below. It's
idempotent and fast when nothing's broken, so it's safe to run on every
deploy. New events also self-heal the city they use the moment it's
referenced again, independent of this — this pre-deploy run is a sweep for
cities nothing has touched since the last fix.

## Vercel Web

1. Import repo in Vercel.
2. Set project root to `apps/web`.
3. Set env vars:

```text
NEXT_PUBLIC_API_URL=https://<railway-api-domain>
NEXT_PUBLIC_WEB_URL=https://manifestacije.hr
```

4. Build command:

```bash
pnpm build
```

5. Output is standard Next.js.

## Transactional Email (Resend)

Resend handles outbound transactional email only — organizer welcome, event
submitted/published/rejected, and admin new-submission notifications. It does
not send newsletters/broadcasts and does not receive mail.

- **PrivateEmail** remains the real inbox for `info@manifestacije.hr` and
  handles all incoming mail. Nothing about incoming mail changes.
- **Resend** only sends outbound transactional email from
  `info@manifestacije.hr` on the verified `manifestacije.hr` domain. Domain
  verification (SPF/DKIM) authorizes sending from any address on the domain
  regardless of which mailbox provider receives replies to it. Inbound
  receiving on Resend must stay disabled — do not add MX records for Resend.
- Marketing campaigns/broadcasts are **not** built into the app. They're
  managed manually in the Resend dashboard if/when needed later.

Required Railway variables (API service):

```text
RESEND_API_KEY=<resend api key>
EMAIL_PROVIDER=resend
EMAIL_DELIVERY_MODE=resend
EMAIL_FROM_NAME=Manifestacije.hr
EMAIL_FROM_ADDRESS=info@manifestacije.hr
EMAIL_REPLY_TO=info@manifestacije.hr
ADMIN_NOTIFICATION_EMAIL=info@manifestacije.hr
PUBLIC_WEB_URL=https://manifestacije.hr
```

In production (`NODE_ENV=production`) with `EMAIL_DELIVERY_MODE=resend`, the
API refuses to boot if `RESEND_API_KEY`, `EMAIL_FROM_ADDRESS`, or
`PUBLIC_WEB_URL` are missing — see `apps/api/src/email/email.config.ts`.

**Local development**: leave `EMAIL_DELIVERY_MODE=log` (the default). No real
email is sent — intended email metadata (template, masked recipient, provider)
is logged instead via `LogEmailProvider`. `RESEND_API_KEY` can still be set
locally without risk; it's only used when `EMAIL_DELIVERY_MODE=resend`.

The Resend API key is backend-only — `apps/web` never sees it and never calls
Resend directly.

## Password Reset

Admins and organizers can request a password reset at `/forgot-password`.
PrivateEmail still handles all incoming mail; Resend sends the reset email
the same way it sends other transactional email above.

```text
PASSWORD_RESET_TOKEN_TTL_MINUTES=30
PASSWORD_RESET_URL=https://manifestacije.hr/reset-password
```

- If `PASSWORD_RESET_URL` is unset, the API falls back to
  `${PUBLIC_WEB_URL}/reset-password`. Set `PUBLIC_WEB_URL` correctly in every
  environment — it must never resolve to a Vercel preview URL.
- Reset tokens are stored as a SHA-256 hash only; the raw token exists only
  in the emailed link and is never logged or persisted.
- Links expire after `PASSWORD_RESET_TOKEN_TTL_MINUTES` and are single-use.
  Requesting a new reset invalidates any previous unused token for that user.
- Completing a reset increments the user's `authVersion`, which invalidates
  every JWT issued before the reset — all existing sessions are signed out.
- The forgot-password endpoint always returns the same generic response
  whether or not the email belongs to an account, so it never reveals
  account existence.

## Organizer Onboarding & Resend Contacts

Organizer email addresses enter Resend Contacts automatically — nobody ever
enters a contact into Resend by hand. PrivateEmail still handles all inbound
mail; Resend handles outbound transactional mail (above) plus the Contacts /
Broadcasts list used for organizer marketing.

**An email becomes an active Resend Contact only when the person performs a
direct action:**

- successful organizer registration
- successful authenticated event submission
- successful authenticated source (URL/raw content) submission
- a completed organizer profile claim

It is deliberately **not** added when: an admin creates an Organizer record,
the parser discovers an Organizer, an imported event is attributed to an
Organizer, someone logs in, someone requests/resets a password, or a claim
request/invitation is merely sent but not completed. See
`apps/api/src/contacts/resend-contacts.service.ts` for the sync logic and
`apps/api/test/resend-contacts.service.spec.ts` for the behavior contract.

Once Resend reports a contact as globally unsubscribed, nothing in this app
— registration, login, submission, profile update, backfill, or claim sync —
ever resubscribes them. Only an explicit Resend-side change (mirrored via the
webhook below) can do that.

### Organizer Profile Claims

Existing Organizer records (created by admins or the parser while importing
events) start `UNCLAIMED`. An organizer can take ownership at
`/organizatori/<slug>/preuzmi`:

- if the submitted email exactly matches the stored `Organizer.email`, a
  single-use, SHA-256-hashed claim link (valid for
  `ORGANIZER_CLAIM_TOKEN_TTL_MINUTES`, 7 days by default — longer than the
  password-reset TTL since this is an invite people check at their own pace)
  is emailed automatically
- otherwise the request is queued for admin review at
  `/admin/organizer-claims` — the admin can approve (re-sends the same kind
  of link to the submitted address) or reject
- completing the link sets `Organizer.status=CLAIMED`, attaches the User,
  and is the only point in this flow that syncs a Resend Contact
- claim tokens are a separate table/token from password-reset tokens and are
  never interchangeable

Admins can also proactively invite one UNCLAIMED organizer with a known email
from `/admin/organizers` ("send claim invite"), or bulk-invite from the CLI
(see below). Neither adds anyone to Resend — only a completed claim does.

### CLI Commands (run manually, never during deploy/seed)

```bash
pnpm --filter api contacts:retry-failed
pnpm --filter api contacts:backfill-engaged-organizers [--dry-run]
pnpm --filter api claims:invite-unclaimed-organizers [--dry-run] [--limit=N]
```

- `contacts:retry-failed` re-attempts every `EmailContact` row stuck at
  `syncStatus=FAILED`. Safe to run repeatedly.
- `contacts:backfill-engaged-organizers` syncs pre-existing organizers that
  already show real engagement — a linked `ORGANIZER`-role User, or
  `CLAIMED`/`VERIFIED`/`TRUSTED` status. Organizers that merely exist, have
  events, have an email, or were admin/parser-created are skipped. Idempotent
  and safe to run repeatedly; always run `--dry-run` first.
- `claims:invite-unclaimed-organizers` bulk-sends claim invites to `UNCLAIMED`
  organizers with a usable email and no already-active invite (default cap 50
  per run). Never wired into deploy or seed — deliberate manual execution only.

### Resend Webhook (unsubscribe sync)

`POST /api/webhooks/resend` keeps `EmailContact.isUnsubscribed` in sync with
Resend's own state (`contact.updated` / `contact.deleted`). Requests are
verified against `RESEND_WEBHOOK_SECRET` using Resend's Svix-style HMAC
signature (`svix-id` / `svix-timestamp` / `svix-signature` headers) — see
`apps/api/src/webhooks/verify-resend-signature.ts`. Requests without a valid
signature get a 401; without `RESEND_WEBHOOK_SECRET` set, the endpoint always
401s.

Setup: in the Resend dashboard, add a webhook pointing at
`https://<railway-api-domain>/api/webhooks/resend`, subscribe to contact
events, and put its signing secret in `RESEND_WEBHOOK_SECRET`.

Every marketing Broadcast sent from Resend must include an unsubscribe link
(Resend adds this by default) — that's what ultimately fires this webhook.

## Admin Seed Credentials

Staging admin login comes from:

```text
SEED_ADMIN_EMAIL
SEED_ADMIN_PASSWORD
```

Default local dev values:

```text
admin@manifestacije.test
admin1234
```

Production must set `SEED_ADMIN_PASSWORD` to a real secret before running seed.

## Seed Safety

The Prisma seed is safe for Railway staging:

- regions, counties, cities, categories use `upsert`
- admin user is created or updated from `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`
- demo organizers/events run only when `SEED_DEMO_DATA=true`
- demo records use stable slugs and `upsert`, so reruns do not duplicate them
- seed does not delete existing data

## Event Location & Region Resolution

A City's county/region is resolved **once**, the first time that city name
is saved (either the AI parser/admin gives an explicit county/region, or the
app live-geocodes the city name via Google Places, falling back to
Nominatim). That result is cached on the `City` row — a venue address typed
for a *later* event under the same city always geocodes fine (it's a
separate, per-request lookup for the pin's coordinates), but it does **not**
retroactively fix a city that got stuck with a bad county/region from an
earlier failed or outdated lookup. Symptom: the event detail page shows
"Nepoznata regija" even though the venue address/map pin is correct.

Two things guard against this:

- **On-demand self-heal**: `findOrCreateCity` (`apps/api/src/common/city-resolver.ts`)
  checks the existing city's cached region on every use — if it's not one of
  the app's known regions, it re-geocodes and fixes it on the spot before
  returning. So the next time *any* event references a broken city, that
  city fixes itself automatically.
- **Deploy-time sweep**: `pnpm locations:repair` (wired into the Railway
  pre-deploy command above) re-geocodes any city nothing has touched since
  it broke, and fixes affected events' cached county/region to match.

Run it manually against any environment:

```bash
pnpm --filter api locations:repair            # dry run — prints what it would change
pnpm --filter api locations:repair -- --apply # writes the changes
```

Needs that environment's `DATABASE_URL` (e.g. via `railway run` for
production — see Railway's docs for running one-off commands against a
service's environment).

## Smoke Test Checklist

API:

```bash
curl https://<railway-api-domain>/api/health
curl https://<railway-api-domain>/api/public/events
```

Expected health response:

```json
{"ok":true}
```

Web:

1. Open `https://manifestacije.hr`.
2. Open `/eventi`.
3. Open one event detail page.
4. Open `/admin`.
5. Login with staging admin credentials.
6. Open `/admin/events`.
7. Open `/admin/sources`.
8. Verify browser console has no CORS errors.

Transactional email (with `EMAIL_DELIVERY_MODE=resend` in production):

1. Register a test organizer — confirm the welcome email arrives.
2. Submit a test event (manual or URL) — confirm the organizer receipt email
   arrives and the admin notification arrives at `ADMIN_NOTIFICATION_EMAIL`.
3. Publish the event from `/admin` — confirm the organizer published email
   arrives with a working public event link.
4. Reject a different test event — confirm the rejection email arrives.
5. Reply to any of the above — confirm the reply lands at `info@manifestacije.hr`.
6. Re-publish an already-published event — confirm no duplicate email is sent
   (only real status transitions trigger a send).

## Local Verification

Before deploy:

```bash
pnpm test
pnpm build
```
