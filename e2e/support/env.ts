/**
 * Single source of truth for everything the end-to-end suite runs against.
 *
 * Two rules hold this file together:
 *
 * 1. The suite may only ever talk to the disposable Postgres defined as
 *    `postgres-e2e` in docker-compose.yml. `assertDisposableDatabase` is
 *    called from both the Playwright config and the global setup, so a
 *    mistyped URL aborts the run instead of writing somewhere real.
 * 2. Every credential below is synthetic and public on purpose. The suite
 *    never inherits the developer's own secrets: apps/.env is symlinked to
 *    the repository root and carries live Resend, Anthropic, Cloudinary and
 *    Google keys, and `dotenv` does not overwrite variables that are already
 *    set — so each one is listed here explicitly and blanked. Traces and
 *    screenshots can therefore be published without redaction.
 */

import path from "node:path";

export const WEB_PORT = Number(process.env.E2E_WEB_PORT ?? 3300);
export const API_PORT = Number(process.env.E2E_API_PORT ?? 3301);
export const AI_STUB_PORT = Number(process.env.E2E_AI_STUB_PORT ?? 3302);

export const WEB_URL = `http://127.0.0.1:${WEB_PORT}`;
export const API_URL = `http://127.0.0.1:${API_PORT}`;
export const AI_STUB_URL = `http://127.0.0.1:${AI_STUB_PORT}`;

/** Must match the `postgres-e2e` service in docker-compose.yml. */
const DISPOSABLE_HOSTS = new Set(["127.0.0.1", "localhost"]);
const DISPOSABLE_PORT = "5443";
const DISPOSABLE_DB = "/e2e_qa";

export const DATABASE_URL =
  process.env.E2E_DATABASE_URL ?? "postgresql://e2e:e2e@127.0.0.1:5443/e2e_qa?schema=public";

/**
 * Refuses anything but the disposable database. The development database on
 * 5432 and the production database both fail this check, which is the point:
 * the suite truncates every table it touches.
 */
export function assertDisposableDatabase(url = DATABASE_URL): string {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("E2E_DATABASE_URL is not a valid URL");
  }
  if (!DISPOSABLE_HOSTS.has(parsed.hostname) || parsed.port !== DISPOSABLE_PORT || parsed.pathname !== DISPOSABLE_DB) {
    throw new Error(
      `Refusing to run the E2E suite against ${parsed.hostname}:${parsed.port}${parsed.pathname}. ` +
        `It only ever runs against the disposable 127.0.0.1:${DISPOSABLE_PORT}${DISPOSABLE_DB} database ` +
        "(`docker compose up -d postgres-e2e`), because it truncates data before every run."
    );
  }
  return url;
}

/** Synthetic accounts. Not secrets — see the header comment. */
export const ADMIN = {
  email: "e2e-admin@manifestacije.test",
  password: "e2e-only-admin-pw",
  name: "Admin",
} as const;

export const ORGANIZER_PASSWORD = "e2e-only-organizer-pw";

export const JWT_SECRET = "e2e-only-jwt-secret-not-used-anywhere-else";
const REVALIDATE_SECRET = "e2e-only-revalidate-secret";

/** Where seed-accounts.ts writes the account pool the tests lease from. */
export const ACCOUNTS_FILE = path.resolve(__dirname, "..", ".artifacts", "accounts.json");

/**
 * Explicitly neutralises every outbound integration. `EMAIL_DELIVERY_MODE=log`
 * records the intended mail in EmailDelivery rows without handing anything to
 * Resend, and the blank keys make a real call impossible even if that mode
 * were ever misread.
 */
export const apiServerEnv: Record<string, string> = {
  // Not "production": apps/api/src/email/email.config.ts rightly refuses to
  // boot a production runtime with logged-only email, and insists that
  // PUBLIC_WEB_URL be https://manifestacije.hr. The binary under test is still
  // the compiled production build (`pnpm --filter api build && … start`);
  // only this flag says "this is a test runtime".
  NODE_ENV: "test",
  PORT: String(API_PORT),
  DATABASE_URL: assertDisposableDatabase(),
  JWT_SECRET,

  // AI: a local stub, reached because @anthropic-ai/sdk honours this variable
  // when the client is constructed without an explicit baseURL (client.js:68).
  ANTHROPIC_API_KEY: "e2e-stub-key",
  ANTHROPIC_BASE_URL: AI_STUB_URL,

  // Email: recorded, never sent.
  EMAIL_PROVIDER: "resend",
  EMAIL_DELIVERY_MODE: "log",
  RESEND_API_KEY: "",
  RESEND_WEBHOOK_SECRET: "",
  EMAIL_FROM_NAME: "Manifestacije E2E",
  EMAIL_FROM_ADDRESS: "e2e@manifestacije.test",
  EMAIL_REPLY_TO: "e2e@manifestacije.test",
  ADMIN_NOTIFICATION_EMAIL: "e2e-admin@manifestacije.test",

  // Image upload and geocoding: unavailable rather than live.
  CLOUDINARY_URL: "",
  CLOUDINARY_CLOUD_NAME: "",
  CLOUDINARY_API_KEY: "",
  CLOUDINARY_API_SECRET: "",
  GOOGLE_PLACES_API_KEY: "",

  PUBLIC_WEB_URL: WEB_URL,
  WEB_URL,
  REVALIDATE_SECRET,
  PASSWORD_RESET_URL: `${WEB_URL}/reset-password`,
  ORGANIZER_CLAIM_URL: `${WEB_URL}/preuzmi-profil`,
  PASSWORD_RESET_TOKEN_TTL_MINUTES: "30",
  ORGANIZER_CLAIM_TOKEN_TTL_MINUTES: "10080",

  // apps/api/src/main.ts hardcodes localhost:3000; the suite runs on its own
  // port, so both spellings of the loopback origin are allowed through CORS.
  CORS_ALLOWED_ORIGINS: `${WEB_URL},http://localhost:${WEB_PORT}`,
};

export const webServerEnv: Record<string, string> = {
  NODE_ENV: "production",
  PORT: String(WEB_PORT),
  NEXT_PUBLIC_API_URL: API_URL,
  NEXT_PUBLIC_WEB_URL: WEB_URL,
  NEXT_PUBLIC_GA_ID: "",
  NEXT_PUBLIC_CARTO_BASEMAP_KEY: "",
  REVALIDATE_SECRET,
  // A build directory of its own, so an E2E run never invalidates the
  // developer's `.next` (the two builds differ in NEXT_PUBLIC_API_URL).
  NEXT_DIST_DIR: ".next-e2e",
};

export const seedEnv: Record<string, string> = {
  DATABASE_URL: assertDisposableDatabase(),
  SEED_ADMIN_EMAIL: ADMIN.email,
  SEED_ADMIN_PASSWORD: ADMIN.password,
  SEED_DEMO_DATA: "false",
};

export const accountSeedEnv: Record<string, string> = {
  DATABASE_URL: assertDisposableDatabase(),
  SEED_ADMIN_EMAIL: ADMIN.email,
  E2E_ORGANIZER_PASSWORD: ORGANIZER_PASSWORD,
  E2E_ACCOUNTS_FILE: ACCOUNTS_FILE,
};
