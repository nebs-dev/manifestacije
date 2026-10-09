import { Logger } from "@nestjs/common";
import { EmailService } from "../src/email/email.service";
import { loadEmailConfig } from "../src/email/email.config";
import { ResendEmailProvider } from "../src/email/providers/resend-email.provider";
import { LogEmailProvider } from "../src/email/providers/log-email.provider";

const original = { ...process.env };
beforeEach(() => {
  process.env.NODE_ENV = "test"; process.env.EMAIL_DELIVERY_MODE = "log";
  process.env.EMAIL_PROVIDER = "resend";
  process.env.PUBLIC_WEB_URL = "https://manifestacije.hr";
  delete process.env.PASSWORD_RESET_URL; delete process.env.ORGANIZER_CLAIM_URL;
  delete process.env.RAILWAY_ENVIRONMENT_NAME; delete process.env.RAILWAY_ENVIRONMENT;
});
afterEach(() => {
  jest.restoreAllMocks();
  for (const key of Object.keys(process.env)) if (!(key in original)) delete process.env[key];
  Object.assign(process.env, original);
});

describe("Resend transport (mocked HTTP, no real emails)", () => {
  const input = { to: "synthetic@example.test", subject: "SECRET SUBJECT", html: "SECRET BODY" };
  it("captures the provider ID and bounds network waits", async () => {
    const fetch = jest.spyOn(global, "fetch").mockResolvedValue(new Response(JSON.stringify({ id: "message-42" }), { status: 200 }));
    expect(await new ResendEmailProvider("re_synthetic", "Manifestacije <info@manifestacije.hr>").send({ ...input, idempotencyKey: "synthetic-attempt" })).toEqual({ provider: "resend", messageId: "message-42" });
    expect(fetch.mock.calls[0][1]?.signal).toBeInstanceOf(AbortSignal);
    expect(new Headers(fetch.mock.calls[0][1]?.headers).get("Idempotency-Key")).toBe("synthetic-attempt");
    expect(JSON.parse(fetch.mock.calls[0][1]?.body as string)).toMatchObject({ to: input.to, subject: input.subject });
  });
  it("rejects a successful response without a message ID as unknown", async () => {
    jest.spyOn(global, "fetch").mockResolvedValue(new Response("{}", { status: 200 }));
    await expect(new ResendEmailProvider("re_synthetic", "info@manifestacije.hr").send(input)).rejects.toMatchObject({ outcome: "unknown" });
  });
  it("captures explicit provider rejection without leaking the raw error", async () => {
    jest.spyOn(global, "fetch").mockResolvedValue(new Response(JSON.stringify({ name: "validation_error", statusCode: 422, message: "SECRET BODY" }), { status: 422 }));
    await expect(new ResendEmailProvider("re_synthetic", "info@manifestacije.hr").send(input)).rejects.toMatchObject({ outcome: "rejected", message: "Resend email submission failed" });
  });
  it.each([new Error("SECRET NETWORK ERROR"), new DOMException("SECRET TIMEOUT", "TimeoutError")])("marks ambiguous network/timeout results unknown", async (error) => {
    jest.spyOn(global, "fetch").mockRejectedValue(error);
    await expect(new ResendEmailProvider("re_synthetic", "info@manifestacije.hr").send(input)).rejects.toMatchObject({ outcome: "unknown" });
  });
  it("never logs bodies, subjects, full addresses or provider errors", async () => {
    const log = jest.spyOn(Logger.prototype, "log").mockImplementation(() => {});
    const error = jest.spyOn(Logger.prototype, "error").mockImplementation(() => {});
    await new LogEmailProvider().send(input);
    const service = new EmailService();
    (service as unknown as { provider: unknown }).provider = { send: jest.fn().mockRejectedValue(new Error("SECRET BODY token=very-secret synthetic@example.test")) };
    await service.sendOrganizerWelcome(input.to, { organizerName: "SECRET SUBJECT", webUrl: "https://manifestacije.hr" });
    const output = JSON.stringify([...log.mock.calls, ...error.mock.calls]);
    for (const secret of ["SECRET", "very-secret", "synthetic@example.test"]) expect(output).not.toContain(secret);
  });
});

describe("Safe auth email configuration", () => {
  it("uses canonical reset and claim pages without preview links", () => {
    expect(loadEmailConfig()).toMatchObject({ passwordResetUrl: "https://manifestacije.hr/reset-password", organizerClaimUrl: "https://manifestacije.hr/preuzmi-profil" });
  });
  it.each(["https://other.test/reset-password", "https://manifestacije.hr/reset-password?token=old", "https://manifestacije.hr/reset-password#fragment", "https://user:secret@manifestacije.hr/reset-password", "javascript:alert(1)"])("rejects unsafe reset configuration %s", value => {
    process.env.PASSWORD_RESET_URL = value;
    expect(() => loadEmailConfig()).toThrow(/Invalid PASSWORD_RESET_URL/);
  });
  it.each(["0", "-1", "NaN", "1.2", "999999"])("rejects invalid reset lifetime %s", value => {
    process.env.PASSWORD_RESET_TOKEN_TTL_MINUTES = value;
    expect(() => loadEmailConfig()).toThrow(/Invalid PASSWORD_RESET_TOKEN_TTL_MINUTES/);
  });
  it.each(["http://localhost:3000", "https://preview.vercel.app", "https://manifestacije.hr/wrong", "https://manifestacije.hr?bad=1"])("rejects an unsafe production web URL %s", value => {
    process.env.NODE_ENV = "production"; process.env.EMAIL_DELIVERY_MODE = "resend"; process.env.RESEND_API_KEY = "re_synthetic";
    process.env.EMAIL_FROM_ADDRESS = "info@manifestacije.hr"; process.env.PUBLIC_WEB_URL = value;
    expect(() => loadEmailConfig()).toThrow(/PUBLIC_WEB_URL/);
  });
  it("rejects header injection and invalid delivery modes", () => {
    process.env.EMAIL_FROM_ADDRESS = "info@manifestacije.hr\nBcc: private@example.test";
    expect(() => loadEmailConfig()).toThrow(/EMAIL_FROM_ADDRESS/);
    process.env.EMAIL_FROM_ADDRESS = "info@manifestacije.hr"; process.env.EMAIL_DELIVERY_MODE = "broken";
    expect(() => loadEmailConfig()).toThrow(/provider configuration/);
  });
});
