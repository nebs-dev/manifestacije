# End-to-end suite

Playwright against the real web app, the real API and a disposable PostgreSQL.
The only thing stubbed is Anthropic (and the geocoder, at the proxy route that
is its single caller). Nothing in here can reach production, send an e-mail, or
spend a token.

## Commands

```bash
pnpm e2e:db:up        # start the disposable database (docker, port 5443)
pnpm e2e              # everything: Chromium + WebKit + Pixel 7 + iPhone 14
pnpm e2e:smoke        # the CI gate: @smoke in Chromium only
pnpm e2e:ui           # Playwright's watch UI
pnpm e2e:report       # open the last HTML report
pnpm e2e:typecheck    # tsc over e2e/ and playwright.config.ts
pnpm e2e:db:down      # throw the database away
```

Single file or single test:

```bash
pnpm e2e --project=chromium organizer-auth
pnpm e2e --project=chromium --grep "survives an Anthropic outage"
```

The servers start themselves. `pnpm e2e` builds and runs `apps/api` and
`apps/web` on ports **3301** and **3300**, and the Anthropic stub on **3302**,
so a `pnpm dev` on 3000/3001 is left alone. The web build goes to
`.next-e2e/`, so it never invalidates your own `.next`.

## Tags

| Tag | Runs in | Meaning |
| --- | --- | --- |
| `@smoke` | Chromium, and CI | Must hold for the product to work at all |
| `@critical` | Chromium + WebKit | Has broken before, or breaks silently |
| `@mobile` | Chromium + Pixel 7 + iPhone 14 | Phone layout and navigation |
| (none) | Chromium | Everything else |

## Layout

```
e2e/
  specs/            one file per journey
  support/
    env.ts          ports, the database guard, every provider variable
    global-setup.ts migrate → truncate → seed reference data → seed accounts
    reset-db.ts     truncates every table (runs under apps/api, via tsx)
    seed-accounts.ts the account pool and the manifest tests read
    jwt.ts          mints the same session token the API issues
    fixtures.ts     accounts, leased organizer, signed-in pages, API contexts
    factory.ts      preconditions over HTTP (published event, pending event)
    flows.ts        interactions several specs must get past
    dates.ts        future dates, Croatian month names, Zagreb calendar days
    anthropic-stub.mjs  the fake Messages API, plus a fixture source page
```

## How it stays honest

**Sessions are minted, not typed.** `/api/auth/login` and `/api/auth/register`
allow ten requests a minute per IP, and every test here comes from 127.0.0.1.
A suite that logged in for each test would start failing with 429 as it grew,
and that throttle is worth keeping — so `support/jwt.ts` signs the token
instead. The real login and registration forms are still exercised, once each,
in `organizer-auth.spec.ts`.

**Preconditions are arranged over HTTP.** A test about the review screen should
not spend six clicks creating a published event first; if it did, a bug in the
create form would fail every unrelated spec. `support/factory.ts` posts to our
own endpoints with a real bearer token — those are not stubs.

**Only external providers are faked.** The AI goes to
`support/anthropic-stub.mjs`, reached with no production code change at all:
`new Anthropic({ apiKey, … })` passes no `baseURL`, so the SDK falls back to
`ANTHROPIC_BASE_URL`. `/api/geocode` is intercepted in the two specs that need
a venue, because that route's only job is to forward to Google Places or
OpenStreetMap. E-mail runs in `log` mode, so deliveries are recorded in
`EmailDelivery` rows and nothing is sent.

**Dates are always computed.** Ingestion drops candidates that start in the
past, so a hardcoded date would turn the suite red on some later morning rather
than at the commit that broke it. And the parser validates the model's ISO
value against the literal date quoted from the source, so a stub reply and the
text it claims to have read have to agree — which is why both come from
`support/dates.ts`.

**One worker, on purpose.** All tests share the single disposable database, and
several screens assert on global lists (the review queue, notification counts)
that another worker's rows would change underneath them. Tests name their own
data with `unique()` so order does not matter; the serial run is what keeps the
shared lists stable.

## Credentials

Every account is synthetic and its password is in `support/env.ts` in plain
sight. That is deliberate: they only exist in a tmpfs database on port 5443,
the guard in `env.ts` refuses to run anywhere else, and the suite's own
variables blank out every real key. So traces, screenshots and CI logs can be
published without redaction — there is nothing in them to leak.

## Known limitations

- **One worker**, so the suite is serial. Parallelism would need a database per
  worker and a server pair per worker.
- **Image upload is not covered.** Cloudinary credentials are blanked, so
  `EventImagePicker` cannot complete; covering it needs a local S3/Cloudinary
  stand-in.
- **CI runs Node 22.20.0** while the project is developed on Node 26. There is
  no `.nvmrc`, so nothing declares the supported version; add one, or raise the
  CI matrix, to close the gap.
- **E-mail is recorded, never delivered.** Specs can assert that an
  `EmailDelivery` row exists, not that a message arrived.
