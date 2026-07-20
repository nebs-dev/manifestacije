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
EMAIL_FROM_ADDRESS=obavijesti@manifestacije.hr
EMAIL_REPLY_TO=info@manifestacije.hr
ADMIN_NOTIFICATION_EMAIL=info@manifestacije.hr
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

Railway pre-deploy command can run both root scripts:

```bash
pnpm prisma:migrate && pnpm prisma:seed
```

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
  `obavijesti@manifestacije.hr` on the verified `manifestacije.hr` domain.
  Inbound receiving on Resend must stay disabled — do not add MX records for
  Resend.
- Marketing campaigns/broadcasts are **not** built into the app. They're
  managed manually in the Resend dashboard if/when needed later.

Required Railway variables (API service):

```text
RESEND_API_KEY=<resend api key>
EMAIL_PROVIDER=resend
EMAIL_DELIVERY_MODE=resend
EMAIL_FROM_NAME=Manifestacije.hr
EMAIL_FROM_ADDRESS=obavijesti@manifestacije.hr
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
