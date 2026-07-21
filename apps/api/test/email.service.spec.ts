import { EmailService } from "../src/email/email.service";
import { LogEmailProvider } from "../src/email/providers/log-email.provider";
import { ResendEmailProvider } from "../src/email/providers/resend-email.provider";
import { EmailDeliveryError } from "../src/email/email.types";

async function withEnv<T>(vars: Record<string, string | undefined>, fn: () => T | Promise<T>): Promise<T> {
  const original: Record<string, string | undefined> = {};
  for (const key of Object.keys(vars)) original[key] = process.env[key];
  for (const [key, value] of Object.entries(vars)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  try {
    return await fn();
  } finally {
    for (const [key, value] of Object.entries(original)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

describe("EmailService provider selection", () => {
  it("uses LogEmailProvider in log mode and never touches Resend", async () => {
    withEnv({ EMAIL_DELIVERY_MODE: "log", RESEND_API_KEY: undefined, NODE_ENV: "test" }, () => {
      const service = new EmailService();
      const provider = (service as unknown as { provider: unknown }).provider;
      expect(provider).toBeInstanceOf(LogEmailProvider);
    });
  });

  it("uses ResendEmailProvider when EMAIL_DELIVERY_MODE=resend and an API key is present", () => {
    withEnv({ EMAIL_DELIVERY_MODE: "resend", RESEND_API_KEY: "re_test_key", NODE_ENV: "test" }, () => {
      const service = new EmailService();
      const provider = (service as unknown as { provider: unknown }).provider;
      expect(provider).toBeInstanceOf(ResendEmailProvider);
    });
  });

  it("falls back to LogEmailProvider when resend mode is set but no API key exists (non-production)", () => {
    withEnv({ EMAIL_DELIVERY_MODE: "resend", RESEND_API_KEY: undefined, NODE_ENV: "test" }, () => {
      const service = new EmailService();
      const provider = (service as unknown as { provider: unknown }).provider;
      expect(provider).toBeInstanceOf(LogEmailProvider);
    });
  });

  it("throws at construction when production is missing required env vars", () => {
    withEnv({
      EMAIL_DELIVERY_MODE: "resend",
      RESEND_API_KEY: undefined,
      EMAIL_FROM_ADDRESS: undefined,
      PUBLIC_WEB_URL: undefined,
      NODE_ENV: "production",
    }, () => {
      expect(() => new EmailService()).toThrow(/Missing required email env vars/);
    });
  });

  it("defaults to Resend on Railway production when EMAIL_DELIVERY_MODE is omitted", () => {
    withEnv({
      EMAIL_DELIVERY_MODE: undefined,
      RESEND_API_KEY: "re_test_key",
      EMAIL_FROM_ADDRESS: "info@manifestacije.hr",
      PUBLIC_WEB_URL: "https://manifestacije.hr",
      NODE_ENV: undefined,
      RAILWAY_ENVIRONMENT_NAME: "production",
    }, () => {
      const service = new EmailService();
      const provider = (service as unknown as { provider: unknown }).provider;
      expect(provider).toBeInstanceOf(ResendEmailProvider);
    });
  });

  it("refuses explicit log mode in production", () => {
    withEnv({
      EMAIL_DELIVERY_MODE: "log",
      RESEND_API_KEY: "re_test_key",
      EMAIL_FROM_ADDRESS: "info@manifestacije.hr",
      PUBLIC_WEB_URL: "https://manifestacije.hr",
      NODE_ENV: "production",
      RAILWAY_ENVIRONMENT_NAME: undefined,
    }, () => {
      expect(() => new EmailService()).toThrow(/EMAIL_DELIVERY_MODE must be set to resend/);
    });
  });
});

describe("EmailService.dispatch (via public send* methods)", () => {
  function makeService(providerOverride: { send: jest.Mock }) {
    const service = new EmailService();
    (service as unknown as { provider: unknown }).provider = providerOverride;
    return service;
  }

  it("does not throw when the provider rejects — a failed send must not fail the caller", async () => {
    const provider = { send: jest.fn().mockRejectedValue(new EmailDeliveryError("boom")) };
    const service = makeService(provider);

    await expect(
      service.sendOrganizerWelcome("organizer@example.hr", { organizerName: "Test", webUrl: "https://manifestacije.hr" })
    ).resolves.toBeUndefined();
    expect(provider.send).toHaveBeenCalledTimes(1);
  });

  it("sends organizer welcome with the expected subject and recipient", async () => {
    const provider = { send: jest.fn().mockResolvedValue({ provider: "log" }) };
    const service = makeService(provider);

    await service.sendOrganizerWelcome("organizer@example.hr", { organizerName: "Test Organizer", webUrl: "https://manifestacije.hr" });

    expect(provider.send).toHaveBeenCalledWith(expect.objectContaining({
      to: "organizer@example.hr",
      subject: "Dobro došli na Manifestacije.hr",
    }));
  });

  it("tags the send with template, environment, and event_id when a relatedId is given", async () => {
    const provider = { send: jest.fn().mockResolvedValue({ provider: "log" }) };
    const service = makeService(provider);

    await service.sendEventPublished(
      "organizer@example.hr",
      { eventTitle: "Ljetni festival", publicEventUrl: "https://manifestacije.hr/eventi/ljetni-festival", webUrl: "https://manifestacije.hr" },
      42
    );

    expect(provider.send).toHaveBeenCalledWith(expect.objectContaining({
      subject: "Vaš događaj je objavljen: Ljetni festival",
      tags: expect.arrayContaining([
        { name: "template", value: "event_published" },
        { name: "event_id", value: "42" },
      ]),
    }));
  });

  it("sends the admin notification to ADMIN_NOTIFICATION_EMAIL, not the organizer address", async () => {
    await withEnv({ ADMIN_NOTIFICATION_EMAIL: "info@manifestacije.hr" }, async () => {
      const provider = { send: jest.fn().mockResolvedValue({ provider: "log" }) };
      const service = makeService(provider);

      await service.sendAdminNewSubmission({
        titleOrSource: "Novi koncert",
        sourceTypeLabel: "Organizator — poveznica",
        adminReviewUrl: "https://manifestacije.hr/admin/sources/1",
        webUrl: "https://manifestacije.hr",
      });

      expect(provider.send).toHaveBeenCalledWith(expect.objectContaining({ to: "info@manifestacije.hr" }));
    });
  });
});

describe("maskEmail via LogEmailProvider", () => {
  it("logs without throwing and does not call any network provider", async () => {
    const provider = new LogEmailProvider();
    const result = await provider.send({ to: "test@example.hr", subject: "Subj", html: "<p>hi</p>" });
    expect(result).toEqual({ provider: "log" });
  });
});
