import { INestApplication, UnauthorizedException, ValidationPipe } from "@nestjs/common";
import { JwtModule, JwtService } from "@nestjs/jwt";
import { Test } from "@nestjs/testing";
import { ThrottlerModule } from "@nestjs/throttler";
import { AddressInfo } from "node:net";
import { AuthController, LOGIN_THROTTLE } from "../src/auth/auth.controller";
import { AuthService } from "../src/auth/auth.service";
import { JwtAuthGuard } from "../src/auth/jwt-auth.guard";
import { PrismaService } from "../src/prisma/prisma.service";
import { configureTrustProxy, resolveTrustProxyHops } from "../src/common/trusted-proxy";

/**
 * AUTH-01: session checks (/auth/me) must not hit the login brute-force
 * limit, failed logins must stay limited per client, and behind a reverse
 * proxy each client must get its own bucket from the proxy-appended address.
 * Runs a real HTTP server with the real ThrottlerGuard, JwtAuthGuard and
 * Express trust-proxy setting; only the database/AuthService are stubbed.
 */
const SECRET = "test-secret";
const users = [
  { id: 1, email: "org@example.hr", role: "ORGANIZER", organizerId: 5, authVersion: 0 },
  { id: 2, email: "admin@example.hr", role: "ADMIN", organizerId: null, authVersion: 0 },
];

async function startApp(env: NodeJS.ProcessEnv) {
  const prisma = { user: { findUnique: jest.fn(async ({ where }) => users.find((u) => u.id === where.id) ?? null) } };
  const auth = {
    login: jest.fn(async () => { throw new UnauthorizedException("Invalid credentials"); }),
    me: jest.fn(async (id: number) => users.find((u) => u.id === id)),
    register: jest.fn(), forgotPassword: jest.fn(), resetPassword: jest.fn(),
  };
  const moduleRef = await Test.createTestingModule({
    imports: [
      ThrottlerModule.forRoot({ throttlers: [{ ttl: 60_000, limit: 10 }], errorMessage: "Previše zahtjeva. Pričekajte minutu pa pokušajte ponovno." }),
      JwtModule.register({ global: true, secret: SECRET, signOptions: { expiresIn: "7d" } }),
    ],
    controllers: [AuthController],
    providers: [JwtAuthGuard, { provide: AuthService, useValue: auth }, { provide: PrismaService, useValue: prisma }],
  }).compile();
  const app: INestApplication = moduleRef.createNestApplication({ logger: false });
  configureTrustProxy(app, env);
  app.setGlobalPrefix("api");
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  await app.listen(0, "127.0.0.1");
  const { port } = app.getHttpServer().address() as AddressInfo;
  const jwt = moduleRef.get(JwtService);
  const close = async () => {
    // fetch keeps sockets alive; drop them or app.close() waits forever.
    (app.getHttpServer() as { closeAllConnections?: () => void }).closeAllConnections?.();
    await app.close();
  };
  return { app, close, base: `http://127.0.0.1:${port}/api`, jwt, auth };
}

type Ctx = Awaited<ReturnType<typeof startApp>>;
const tokenFor = (ctx: Ctx, id: number, extra: object = {}) => {
  const u = users.find((x) => x.id === id)!;
  return ctx.jwt.sign({ id: u.id, email: u.email, role: u.role, organizerId: u.organizerId, authVersion: u.authVersion, ...extra });
};
const me = (ctx: Ctx, token?: string, headers: Record<string, string> = {}) =>
  fetch(`${ctx.base}/auth/me`, { headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers } });
const login = (ctx: Ctx, headers: Record<string, string> = {}) =>
  fetch(`${ctx.base}/auth/login`, { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify({ email: "org@example.hr", password: "krivo" }) });

describe("AUTH-01 session checks vs login throttling (direct clients)", () => {
  let ctx: Ctx;
  beforeEach(async () => { ctx = await startApp({}); });
  afterEach(async () => { await ctx.close(); });

  it("survives far more than 10 organizer page navigations per minute", async () => {
    const token = tokenFor(ctx, 1);
    // Each organizer page load validates the session (shell + page). 60 checks ≈ 30 pages.
    const statuses = [];
    for (let i = 0; i < 60; i++) statuses.push((await me(ctx, token)).status);
    expect(new Set(statuses)).toEqual(new Set([200]));
  });

  it("session checks do not consume the login attempt quota", async () => {
    const token = tokenFor(ctx, 1);
    for (let i = 0; i < 40; i++) expect((await me(ctx, token)).status).toBe(200);
    const res = await login(ctx);
    expect(res.status).toBe(401);
    expect(res.headers.get("x-ratelimit-remaining")).toBe(String(LOGIN_THROTTLE.limit - 1));
  });

  it("still rate-limits failed password logins after 10 attempts, with a Croatian message", async () => {
    const statuses = [];
    for (let i = 0; i < LOGIN_THROTTLE.limit; i++) statuses.push((await login(ctx)).status);
    expect(new Set(statuses)).toEqual(new Set([401]));
    const blocked = await login(ctx);
    expect(blocked.status).toBe(429);
    expect((await blocked.json()).message).toBe("Previše zahtjeva. Pričekajte minutu pa pokušajte ponovno.");
    expect(ctx.auth.login).toHaveBeenCalledTimes(LOGIN_THROTTLE.limit);
  });

  it("a throttled login does not affect an existing session", async () => {
    for (let i = 0; i <= LOGIN_THROTTLE.limit; i++) await login(ctx);
    expect((await me(ctx, tokenFor(ctx, 1))).status).toBe(200);
  });

  it("rejects missing, invalid, expired and revoked tokens with 401", async () => {
    expect((await me(ctx)).status).toBe(401);
    expect((await me(ctx, "not-a-jwt")).status).toBe(401);
    const expired = ctx.jwt.sign({ id: 1, email: "org@example.hr", role: "ORGANIZER", organizerId: 5, authVersion: 0 }, { expiresIn: -60 });
    expect((await me(ctx, expired)).status).toBe(401);
    // authVersion bumped by a password reset → old token is revoked.
    expect((await me(ctx, tokenFor(ctx, 1, { authVersion: 3 }))).status).toBe(401);
    expect((await me(ctx, ctx.jwt.sign({ id: 1 }, { secret: "other-secret" }))).status).toBe(401);
  });

  it("admin session checks work and are not throttled by navigation either", async () => {
    const token = tokenFor(ctx, 2);
    for (let i = 0; i < 30; i++) expect((await me(ctx, token)).status).toBe(200);
    expect(await (await me(ctx, token)).json()).toEqual(expect.objectContaining({ role: "ADMIN" }));
  });
});

describe("AUTH-01 clients behind a reverse proxy", () => {
  let ctx: Ctx;
  // Simulates Railway: TRUST_PROXY not set, one hop trusted because RAILWAY_* is present.
  beforeEach(async () => { ctx = await startApp({ RAILWAY_ENVIRONMENT_NAME: "production" }); });
  afterEach(async () => { await ctx.close(); });

  it("gives each client behind the same proxy its own login bucket", async () => {
    for (let i = 0; i <= LOGIN_THROTTLE.limit; i++) await login(ctx, { "x-forwarded-for": "203.0.113.10" });
    expect((await login(ctx, { "x-forwarded-for": "203.0.113.10" })).status).toBe(429);
    // Another client through the same proxy (same socket address) is unaffected.
    const other = await login(ctx, { "x-forwarded-for": "198.51.100.7" });
    expect(other.status).toBe(401);
    expect(other.headers.get("x-ratelimit-remaining")).toBe(String(LOGIN_THROTTLE.limit - 1));
  });

  it("ignores client-forged X-Forwarded-For entries (only the proxy-appended address counts)", async () => {
    // Attacker rotates a fake leading address; the proxy appends the real one last.
    for (let i = 0; i < LOGIN_THROTTLE.limit; i++) {
      await login(ctx, { "x-forwarded-for": `10.0.0.${i}, 203.0.113.66` });
    }
    expect((await login(ctx, { "x-forwarded-for": "10.9.9.9, 203.0.113.66" })).status).toBe(429);
  });
});

describe("trusted proxy resolution", () => {
  it("trusts nothing locally, one hop on Railway, and honours an explicit override", () => {
    expect(resolveTrustProxyHops({})).toBe(0);
    expect(resolveTrustProxyHops({ RAILWAY_ENVIRONMENT_NAME: "production" })).toBe(1);
    expect(resolveTrustProxyHops({ RAILWAY_PROJECT_ID: "x" })).toBe(1);
    expect(resolveTrustProxyHops({ TRUST_PROXY_HOPS: "2", RAILWAY_ENVIRONMENT_NAME: "production" })).toBe(2);
    expect(resolveTrustProxyHops({ TRUST_PROXY_HOPS: "0", RAILWAY_ENVIRONMENT_NAME: "production" })).toBe(0);
    expect(() => resolveTrustProxyHops({ TRUST_PROXY_HOPS: "true" })).toThrow();
  });

  it("without trusted proxies, forwarded headers cannot pick the bucket", async () => {
    const local = await startApp({});
    try {
      for (let i = 0; i < LOGIN_THROTTLE.limit; i++) await login(local, { "x-forwarded-for": `198.51.100.${i}` });
      expect((await login(local, { "x-forwarded-for": "198.51.100.200" })).status).toBe(429);
    } finally {
      await local.close();
    }
  });
});
