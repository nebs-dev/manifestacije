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

## Local Verification

Before deploy:

```bash
pnpm test
pnpm build
```
