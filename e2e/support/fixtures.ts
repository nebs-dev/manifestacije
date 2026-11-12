/**
 * The fixtures every spec builds on.
 *
 * Isolation strategy: the pool accounts are created once per run, and each
 * test leases one it does not share, so two tests never edit the same
 * organizer's events. Anything a test creates is named with `unique()`, which
 * keeps assertions pointed at the test's own rows even though the whole suite
 * shares one database.
 */
import { test as base, expect, type APIRequestContext, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { ACCOUNTS_FILE, API_URL } from "./env";
import { signSession } from "./jwt";
import { AiStub } from "./ai-stub";

export type OrganizerAccount = {
  userId: number;
  email: string;
  name: string;
  authVersion: number;
  organizerId: number;
  organizerName: string;
  organizerSlug: string;
};

export type Accounts = {
  runId: string;
  admin: { userId: number; email: string; authVersion: number };
  organizers: OrganizerAccount[];
  unclaimed: { organizerId: number; slug: string; email: string };
  reference: {
    categories: { id: number; slug: string; name: string }[];
    cities: { id: number; slug: string; name: string }[];
  };
};

/** localStorage keys, from apps/web/src/lib/{admin,organizer}. */
const ADMIN_TOKEN_KEY = "adminToken";
const ORG_TOKEN_KEY = "orgToken";
const ORG_USER_KEY = "orgUser";

let leaseCursor = 0;

/**
 * A label no other test or run can collide with, so a spec can assert on its
 * own rows by name even though the whole suite shares one database.
 */
export function unique(prefix: string): string {
  return `${prefix} ${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

type Fixtures = {
  accounts: Accounts;
  ai: AiStub;
  /** One pool organizer, not shared with any other test in this worker. */
  organizer: OrganizerAccount;
  /** Request context carrying an ADMIN bearer token. */
  adminApi: APIRequestContext;
  /** Request context carrying the leased organizer's bearer token. */
  organizerApi: APIRequestContext;
  /** A page that is already signed in as the admin. */
  adminPage: Page;
  /** A page that is already signed in as the leased organizer. */
  organizerPage: Page;
};

export const test = base.extend<Fixtures>({
  accounts: async ({}, use) => {
    let raw: string;
    try {
      raw = readFileSync(ACCOUNTS_FILE, "utf8");
    } catch {
      throw new Error(`Account manifest missing at ${ACCOUNTS_FILE}. The global setup writes it; run the suite through \`pnpm e2e\`.`);
    }
    await use(JSON.parse(raw) as Accounts);
  },

  ai: async ({ request }, use) => {
    const stub = new AiStub(request);
    await stub.reset();
    await use(stub);
    await stub.reset();
  },

  organizer: async ({ accounts }, use) => {
    const account = accounts.organizers[leaseCursor % accounts.organizers.length];
    leaseCursor += 1;
    if (!account) throw new Error("Organizer pool is empty — check seed-accounts.ts");
    await use(account);
  },

  adminApi: async ({ playwright, accounts }, use) => {
    const token = signSession({
      id: accounts.admin.userId,
      email: accounts.admin.email,
      role: "ADMIN",
      organizerId: null,
      authVersion: accounts.admin.authVersion,
    });
    const context = await playwright.request.newContext({
      baseURL: API_URL,
      extraHTTPHeaders: { Authorization: `Bearer ${token}` },
    });
    await use(context);
    await context.dispose();
  },

  organizerApi: async ({ playwright, organizer }, use) => {
    const token = signSession({
      id: organizer.userId,
      email: organizer.email,
      role: "ORGANIZER",
      organizerId: organizer.organizerId,
      authVersion: organizer.authVersion,
    });
    const context = await playwright.request.newContext({
      baseURL: API_URL,
      extraHTTPHeaders: { Authorization: `Bearer ${token}` },
    });
    await use(context);
    await context.dispose();
  },

  // Each signed-in page gets a browser context of its own rather than sharing
  // the default `page`. Journey 6 has an organizer and an admin acting on the
  // same event in one test, and the app keeps its session in localStorage —
  // one context would hold both tokens at once, which is not a state any real
  // browser is ever in. `contextOptions` carries the project's own settings
  // (viewport, locale, timezone, device), so the phone profiles still apply.
  adminPage: async ({ browser, contextOptions, accounts }, use) => {
    const token = signSession({
      id: accounts.admin.userId,
      email: accounts.admin.email,
      role: "ADMIN",
      organizerId: null,
      authVersion: accounts.admin.authVersion,
    });
    const context = await browser.newContext(contextOptions);
    // addInitScript rather than a one-off evaluate: it re-applies on every
    // navigation, including the redirect a guarded admin page performs.
    await context.addInitScript(
      ([key, value]) => window.localStorage.setItem(key as string, value as string),
      [ADMIN_TOKEN_KEY, token] as const
    );
    const page = await context.newPage();
    await use(page);
    await context.close();
  },

  organizerPage: async ({ browser, contextOptions, organizer }, use) => {
    const token = signSession({
      id: organizer.userId,
      email: organizer.email,
      role: "ORGANIZER",
      organizerId: organizer.organizerId,
      authVersion: organizer.authVersion,
    });
    const session = JSON.stringify({
      id: organizer.userId,
      email: organizer.email,
      role: "ORGANIZER",
      organizerId: organizer.organizerId,
    });
    const context = await browser.newContext(contextOptions);
    await context.addInitScript(
      ([tokenKey, tokenValue, userKey, userValue]) => {
        window.localStorage.setItem(tokenKey as string, tokenValue as string);
        window.localStorage.setItem(userKey as string, userValue as string);
      },
      [ORG_TOKEN_KEY, token, ORG_USER_KEY, session] as const
    );
    const page = await context.newPage();
    await use(page);
    await context.close();
  },
});

export { expect };
