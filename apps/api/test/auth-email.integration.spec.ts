import { createHmac } from "crypto";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { JwtModule, JwtService } from "@nestjs/jwt";
import { ThrottlerModule } from "@nestjs/throttler";
import { PrismaClient } from "@prisma/client";
import * as bcrypt from "bcryptjs";
import { AuthService } from "../src/auth/auth.service";
import { AuthController } from "../src/auth/auth.controller";
import { PrismaService } from "../src/prisma/prisma.service";
import { EmailService } from "../src/email/email.service";
import { EmailDeliveryError } from "../src/email/email.types";
import { EmailTrackingService } from "../src/email/email-tracking.service";
import { EmailTrackingController } from "../src/email/email-tracking.controller";
import { ResendWebhookController } from "../src/webhooks/resend-webhook.controller";
import { ResendContactsService } from "../src/contacts/resend-contacts.service";
import { hashResetToken } from "../src/common/reset-token";
import { AdminService } from "../src/admin/admin.service";
import { AdminController } from "../src/admin/admin.controller";
import { UploadsService } from "../src/admin/uploads.service";
import { OrganizerClaimService } from "../src/organizer-claims/organizer-claim.service";

const databaseUrl = process.env.REVISION_TEST_DATABASE_URL;
if (databaseUrl) {
  const url = new URL(databaseUrl);
  if (url.hostname !== "127.0.0.1" || url.port !== "5442" || url.pathname !== "/revision_qa") throw new Error("Email integration tests require isolated localhost:5442/revision_qa");
}
const integration = databaseUrl ? describe : describe.skip;

integration("Authentication email PostgreSQL and HTTP workflow (synthetic provider only)", () => {
  const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl || "postgresql://unused" } } });
  const tracking = new EmailTrackingService(prisma as never);
  const provider = { send: jest.fn() };
  const contacts = { syncOrganizerRegistration: jest.fn(), processResendContactUpdate: jest.fn() };
  const secret = "whsec_" + Buffer.from("isolated-auth-email-webhook-key").toString("base64");
  let app: INestApplication, auth: AuthService, email: EmailService, admin: AdminService, jwt: JwtService, base: string;
  let userId: number, adminId: number, organizerId: number;
  let serial = 0;
  const originalEnv = { ...process.env };
  const http = (path: string, method = "GET", body?: object, id?: number, headers: Record<string, string> = {}) => fetch(base + path, {
    method, headers: { "Content-Type": "application/json", ...(id ? { Authorization: `Bearer ${jwt.sign({ id, authVersion: 0 })}` } : {}), ...headers },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const event = (type: string, messageId: string, at = new Date()) => ({ type, created_at: at.toISOString(), data: { email_id: messageId, subject: "DO NOT STORE", to: ["private@example.test"] } });
  const webhook = (id: string, body: object, signature?: string) => {
    const timestamp = String(Math.floor(Date.now() / 1000));
    const sig = createHmac("sha256", Buffer.from(secret.slice(6), "base64")).update(`${id}.${timestamp}.${JSON.stringify(body)}`).digest("base64");
    return http("/webhooks/resend", "POST", body, undefined, { "svix-id": id, "svix-timestamp": timestamp, "svix-signature": signature ?? `v1,${sig}` });
  };
  const issue = async () => {
    await auth.forgotPassword({ email: "auth-email-organizer@example.test" });
    const input = provider.send.mock.calls.at(-1)![0];
    // Read synthetic test messages in memory only, never in output.
    const match = input.text.match(/https:\/\/manifestacije\.hr\/reset-password#token=([a-f0-9]+)/);
    expect(match).not.toBeNull();
    return match![1] as string;
  };
  beforeAll(async () => {
    process.env.EMAIL_DELIVERY_MODE = "log";
    process.env.PUBLIC_WEB_URL = "https://manifestacije.hr";
    process.env.PASSWORD_RESET_URL = "https://manifestacije.hr/reset-password";
    process.env.ORGANIZER_CLAIM_URL = "https://manifestacije.hr/preuzmi-profil";
    process.env.RESEND_WEBHOOK_SECRET = secret;
    await prisma.$connect();
    const module = await Test.createTestingModule({
      imports: [JwtModule.register({ secret: "isolated-email-integration" }), ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }])],
      controllers: [AuthController, EmailTrackingController, ResendWebhookController, AdminController],
      providers: [AuthService, EmailService, EmailTrackingService,
        { provide: PrismaService, useValue: prisma }, { provide: ResendContactsService, useValue: contacts },
        { provide: AdminService, useFactory: () => new AdminService(prisma as never, {} as never, {} as never, {} as never, {} as never, {} as never, {} as never) },
        { provide: UploadsService, useValue: {} }, { provide: OrganizerClaimService, useValue: {} }],
    }).compile();
    app = module.createNestApplication({ rawBody: true });
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.listen(0, "127.0.0.1"); base = await app.getUrl();
    auth = module.get(AuthService); email = module.get(EmailService); jwt = module.get(JwtService); admin = module.get(AdminService);
    (email as unknown as { provider: unknown }).provider = provider;
  });
  beforeEach(async () => {
    provider.send.mockReset().mockImplementation(async () => ({ provider: "resend", messageId: `synthetic-message-${++serial}` }));
    await prisma.emailDeliveryEvent.deleteMany(); await prisma.emailDelivery.deleteMany();
    await prisma.passwordResetToken.deleteMany({ where: { user: { email: { startsWith: "auth-email-" } } } });
    await prisma.user.deleteMany({ where: { email: { startsWith: "auth-email-" } } });
    await prisma.organizer.deleteMany({ where: { slug: { startsWith: "auth-email-" } } });
    const org = await prisma.organizer.create({ data: { name: "Synthetic email QA", slug: "auth-email-organizer", status: "CLAIMED" } }); organizerId = org.id;
    const user = await prisma.user.create({ data: { name: "Synthetic organizer", email: "auth-email-organizer@example.test", role: "ORGANIZER", organizerId, passwordHash: await bcrypt.hash("Old-password-42!", 4) } }); userId = user.id;
    adminId = (await prisma.user.create({ data: { name: "Synthetic admin", email: "auth-email-admin@example.test", role: "ADMIN", passwordHash: "unused" } })).id;
  });
  afterAll(async () => {
    await app?.close();
    await prisma.emailDeliveryEvent.deleteMany(); await prisma.emailDelivery.deleteMany();
    await prisma.passwordResetToken.deleteMany({ where: { user: { email: { startsWith: "auth-email-" } } } });
    await prisma.user.deleteMany({ where: { email: { startsWith: "auth-email-" } } });
    await prisma.organizer.deleteMany({ where: { slug: { startsWith: "auth-email-" } } });
    await prisma.$disconnect();
    for (const key of Object.keys(process.env)) if (!(key in originalEnv)) delete process.env[key];
    Object.assign(process.env, originalEnv);
  });

  it("records provider acceptance separately from delivery, with no message contents", async () => {
    const raw = await issue();
    const token = await prisma.passwordResetToken.findFirstOrThrow({ where: { userId } });
    expect(token.tokenHash).toBe(hashResetToken(raw)); expect(token.expiresAt.getTime()).toBeGreaterThan(Date.now());
    const attempt = await prisma.emailDelivery.findFirstOrThrow();
    expect(attempt).toMatchObject({ template: "password_reset", userId, status: "accepted", messageId: expect.any(String), acceptedAt: expect.any(Date), lastEventAt: null });
    expect(JSON.stringify(attempt)).not.toContain(raw); expect(JSON.stringify(attempt)).not.toContain("@example.test");
  });
  it("invalidates earlier links, and only one concurrent redemption succeeds", async () => {
    const first = await issue(), second = await issue();
    await expect(auth.resetPassword({ token: first, newPassword: "New-password-42!" })).rejects.toThrow();
    const results = await Promise.allSettled([auth.resetPassword({ token: second, newPassword: "New-password-42!" }), auth.resetPassword({ token: second, newPassword: "Other-password-42!" })]);
    expect(results.filter(x => x.status === "fulfilled")).toHaveLength(1);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: userId } })).authVersion).toBe(1);
    await expect(auth.resetPassword({ token: second, newPassword: "Replay-password-42!" })).rejects.toThrow();
  });
  it("serializes concurrent requests leaving only one unused link", async () => {
    await Promise.all([auth.forgotPassword({ email: "auth-email-organizer@example.test" }), auth.forgotPassword({ email: "auth-email-organizer@example.test" })]);
    expect(await prisma.passwordResetToken.count({ where: { userId, usedAt: null } })).toBe(1);
  });
  it("rejects expired tokens without changing credentials", async () => {
    const raw = await issue();
    await prisma.passwordResetToken.updateMany({ where: { userId }, data: { expiresAt: new Date(Date.now() - 1000) } });
    await expect(auth.resetPassword({ token: raw, newPassword: "New-password-42!" })).rejects.toThrow("istekla");
    expect((await prisma.user.findUniqueOrThrow({ where: { id: userId } })).authVersion).toBe(0);
  });
  it.each([new EmailDeliveryError("sensitive-provider-body"), new Error("sensitive-network-body")])("keeps failed reset responses generic; ambiguous links remain bounded by expiry", async (error) => {
    provider.send.mockRejectedValue(error);
    const known = await auth.forgotPassword({ email: "auth-email-organizer@example.test" });
    const unknown = await auth.forgotPassword({ email: "auth-email-missing@example.test" });
    expect(known).toEqual(unknown); expect(await prisma.passwordResetToken.count({ where: { userId } })).toBe(error instanceof EmailDeliveryError ? 0 : 1);
    expect((await prisma.emailDelivery.findFirstOrThrow()).status).toBe(error instanceof EmailDeliveryError ? "submission_failed" : "submission_unknown");
  });
  it("returns identical public HTTP responses for known and unknown accounts", async () => {
    const known = await http("/auth/forgot-password", "POST", { email: "auth-email-organizer@example.test" });
    const unknown = await http("/auth/forgot-password", "POST", { email: "auth-email-unknown@example.test" });
    expect(known.status).toBe(unknown.status); expect(await known.json()).toEqual(await unknown.json());
  });
  it.each(["email.sent", "email.delivery_delayed", "email.delivered", "email.failed", "email.bounced", "email.suppressed", "email.complained"])("authenticates and records %s idempotently", async (type) => {
    await issue(); const attempt = await prisma.emailDelivery.findFirstOrThrow();
    const body = event(type, attempt.messageId!);
    const responses = await Promise.all([webhook("msg_same", body), webhook("msg_same", body)]);
    expect(responses.every(x => x.status === 201)).toBe(true);
    expect(await prisma.emailDeliveryEvent.count()).toBe(1);
    expect((await prisma.emailDelivery.findUniqueOrThrow({ where: { id: attempt.id } })).status).toBe(type.slice(6));
    const saved = await prisma.emailDeliveryEvent.findFirstOrThrow();
    expect(JSON.stringify(saved)).not.toContain("DO NOT STORE"); expect(JSON.stringify(saved)).not.toContain("private@");
  });
  it("retains early events and prevents out-of-order sent/delivered from hiding bounces", async () => {
    provider.send.mockImplementationOnce(async () => {
      await tracking.webhook("msg_early", event("email.bounced", "early-message"));
      return { provider: "resend", messageId: "early-message" };
    });
    await issue();
    await tracking.webhook("msg_late", event("email.sent", "early-message", new Date(Date.now() + 1000)));
    await tracking.webhook("msg_delivered", event("email.delivered", "early-message"));
    expect((await prisma.emailDelivery.findFirstOrThrow()).status).toBe("bounced");
  });
  it("rejects unsigned/tampered and malformed delivery events without persisting them", async () => {
    expect((await webhook("msg_bad", event("email.delivered", "bad-message"), "v1,bad")).status).toBe(401);
    expect((await webhook("msg_invalid", { type: "email.bounced", created_at: "invalid", data: { email_id: "bad-message" } })).status).toBe(400);
    expect(await prisma.emailDeliveryEvent.count()).toBe(0);
  });
  it("preserves signed contact webhooks and ignores engagement tracking", async () => {
    const body = { type: "contact.updated", data: { id: "contact-test" } };
    expect((await webhook("msg_contact", body)).status).toBe(201);
    expect(contacts.processResendContactUpdate).toHaveBeenCalledWith(body);
    expect((await webhook("msg_open", event("email.opened", "unused"))).status).toBe(201);
    expect((await webhook("msg_prototype", event("toString", "unused"))).status).toBe(201);
    expect(await prisma.emailDeliveryEvent.count()).toBe(0);
  });
  it("records welcome acceptance without duplicating registration/admin messages", async () => {
    const result = await auth.register({ email: "auth-email-new@example.test", name: "Synthetic", organizerName: "auth-email-new", password: "Synthetic-password-42!" });
    expect(provider.send).toHaveBeenCalledTimes(2);
    expect(await prisma.emailDelivery.count({ where: { template: "organizer_welcome", userId: result.user.id, status: "accepted" } })).toBe(1);
    await expect(auth.register({ email: "auth-email-new@example.test", name: "Synthetic", password: "Synthetic-password-42!" })).rejects.toThrow();
    expect(provider.send).toHaveBeenCalledTimes(2);
  });
  it("welcome failure does not corrupt a newly registered account", async () => {
    provider.send.mockRejectedValue(new EmailDeliveryError("rejected"));
    const result = await auth.register({ email: "auth-email-new@example.test", name: "auth-email-new", password: "Synthetic-password-42!" });
    expect(await prisma.user.findUnique({ where: { id: result.user.id } })).not.toBeNull();
    expect(await prisma.emailDelivery.count({ where: { template: "organizer_welcome", status: "submission_failed" } })).toBe(1);
  });
  it("log mode is never recorded as accepted or delivered", async () => {
    provider.send.mockResolvedValue({ provider: "log" }); await issue();
    expect(await prisma.emailDelivery.findFirst()).toMatchObject({ status: "logged", acceptedAt: null, messageId: null });
  });
  it("a tracking failure after acceptance does not invalidate an emailed reset link", async () => {
    const spy = jest.spyOn((email as unknown as { tracking: EmailTrackingService }).tracking, "submitted").mockRejectedValueOnce(new Error("database unavailable"));
    const raw = await issue();
    await expect(auth.resetPassword({ token: raw, newPassword: "New-password-42!" })).resolves.toBeDefined(); spy.mockRestore();
  });
  it("fails safely before sending if durable tracking is unavailable", async () => {
    const spy = jest.spyOn((email as unknown as { tracking: EmailTrackingService }).tracking, "start").mockRejectedValueOnce(new Error("database unavailable"));
    await expect(auth.forgotPassword({ email: "auth-email-organizer@example.test" })).resolves.toMatchObject({ message: expect.stringContaining("Ako račun") });
    expect(provider.send).not.toHaveBeenCalled();
    expect(await prisma.passwordResetToken.count({ where: { userId } })).toBe(0);
    spy.mockRestore();
  });
  it("bounds staff history to 100 rows and filters by exact account", async () => {
    await prisma.emailDelivery.createMany({ data: Array.from({ length: 105 }, () => ({ template: "password_reset", provider: "log", status: "logged", userId })) });
    const rows = await tracking.list(userId);
    expect(rows.items).toHaveLength(100);
    expect((await tracking.list(adminId)).items).toHaveLength(0);
  });
  it("restricts tracking to admins and validates filters", async () => {
    await issue();
    expect((await http("/admin/email-deliveries")).status).toBe(401);
    expect((await http("/admin/email-deliveries", "GET", undefined, userId)).status).toBe(401);
    const response = await http(`/admin/email-deliveries?userId=${userId}`, "GET", undefined, adminId);
    expect(response.status).toBe(200); expect((await response.json()).items).toHaveLength(1);
    expect((await http("/admin/email-deliveries?userId=bad", "GET", undefined, adminId)).status).toBe(400);
    expect((await http("/admin/email-deliveries?userId=0", "GET", undefined, adminId)).status).toBe(400);
    expect((await http(`/admin/email-deliveries?userId=${adminId}`, "GET", undefined, adminId)).status).toBe(200);
  });
  it("admin reset selects only the organizer user and revokes sessions and reset links", async () => {
    const raw = await issue();
    await prisma.user.update({ where: { id: adminId }, data: { organizerId } });
    expect((await http(`/admin/organizers/${organizerId}/reset-password`, "POST", { password: "Admin-new-password-42!" }, userId)).status).toBe(401);
    const res = await http(`/admin/organizers/${organizerId}/reset-password`, "POST", { password: "Admin-new-password-42!" }, adminId);
    expect(res.status).toBe(201);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: userId } })).authVersion).toBe(1);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: adminId } })).authVersion).toBe(0);
    await expect(auth.resetPassword({ token: raw, newPassword: "Replay-password-42!" })).rejects.toThrow();
    expect((await http("/auth/me", "GET", undefined, userId)).status).toBe(401);
  });
  it("refuses ambiguous multi-user or admin-only organizer resets", async () => {
    await prisma.user.create({ data: { name: "Second synthetic organizer", email: "auth-email-second@example.test", role: "ORGANIZER", organizerId, passwordHash: "unused" } });
    await expect(admin.resetOrganizerPassword(organizerId, "New-password-42!")).rejects.toThrow("više");
    await prisma.user.updateMany({ where: { organizerId }, data: { role: "ADMIN" } });
    await expect(admin.resetOrganizerPassword(organizerId, "New-password-42!")).rejects.toThrow("nije pronađen");
  });
});
