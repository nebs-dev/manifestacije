import { BadRequestException, UnauthorizedException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { UserRole } from "@prisma/client";
import * as bcrypt from "bcryptjs";
import { createHash } from "crypto";
import { AuthService } from "../src/auth/auth.service";
import { JwtAuthGuard } from "../src/auth/jwt-auth.guard";

function emailMock(overrides: Record<string, unknown> = {}) {
  return {
    webUrl: "https://manifestacije.hr",
    passwordResetUrl: "https://manifestacije.hr/reset-password",
    passwordResetTokenTtlMinutes: 30,
    sendOrganizerWelcome: jest.fn().mockResolvedValue(undefined),
    sendPasswordReset: jest.fn().mockResolvedValue({ provider: "log" }),
    sendAdminNewOrganizer: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function contactsMock(overrides: Record<string, unknown> = {}) {
  return {
    syncOrganizerRegistration: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe("AuthService", () => {
  it("logs in with valid credentials and returns a JWT session", async () => {
    const passwordHash = await bcrypt.hash("secret123", 10);
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: 1,
          email: "admin@example.hr",
          name: "Admin",
          role: UserRole.ADMIN,
          organizerId: null,
          authVersion: 0,
          passwordHash,
        }),
      },
    };
    const jwt = { sign: jest.fn().mockReturnValue("signed-token") };
    const contacts = contactsMock();
    const service = new AuthService(prisma as never, jwt as never, emailMock() as never, contacts as never);

    const session = await service.login({ email: " Admin@Example.hr ", password: "secret123" });

    expect(session.token).toBe("signed-token");
    // Login must never touch Resend Contacts sync.
    expect(contacts.syncOrganizerRegistration).not.toHaveBeenCalled();
    expect(session.user).toEqual(expect.objectContaining({ id: 1, role: UserRole.ADMIN }));
    expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { email: "admin@example.hr" } });
    expect(jwt.sign).toHaveBeenCalledWith(expect.objectContaining({ id: 1, email: "admin@example.hr", role: UserRole.ADMIN, authVersion: 0 }));
  });

  it("rejects bad credentials", async () => {
    const passwordHash = await bcrypt.hash("secret123", 10);
    const prisma = {
      user: { findUnique: jest.fn().mockResolvedValue({ passwordHash }) },
    };
    const service = new AuthService(prisma as never, { sign: jest.fn() } as never, {} as never, contactsMock() as never);

    await expect(service.login({ email: "admin@example.hr", password: "wrong" })).rejects.toThrow(UnauthorizedException);
  });

  it("rejects login for an email with no account and no matching organizer", async () => {
    const prisma = {
      user: { findUnique: jest.fn().mockResolvedValue(null) },
      organizer: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    const service = new AuthService(prisma as never, { sign: jest.fn() } as never, {} as never, contactsMock() as never);

    await expect(service.login({ email: "nobody@example.hr", password: "whatever123" })).rejects.toThrow(UnauthorizedException);
  });

  it("tells an unclaimed organizer to claim their profile instead of a generic wrong-password error", async () => {
    const prisma = {
      user: { findUnique: jest.fn().mockResolvedValue(null) },
      organizer: { findFirst: jest.fn().mockResolvedValue({ id: 7, slug: "test-organizer", status: "UNCLAIMED" }) },
    };
    const service = new AuthService(prisma as never, { sign: jest.fn() } as never, {} as never, contactsMock() as never);

    await expect(service.login({ email: "orga@example.hr", password: "whatever123" })).rejects.toMatchObject({
      status: 403,
      response: expect.objectContaining({ code: "CLAIM_REQUIRED", organizerSlug: "test-organizer" }),
    });
    expect(prisma.organizer.findFirst).toHaveBeenCalledWith({
      where: { email: { equals: "orga@example.hr", mode: "insensitive" }, status: "UNCLAIMED" },
    });
  });

  it("sends the organizer welcome email after a successful registration", async () => {
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 2, email: "new@example.hr", name: "New Organizer", role: UserRole.ORGANIZER, organizerId: 5, authVersion: 0 }),
      },
      organizer: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 5, name: "New Organizer Co", createdAt: new Date("2026-07-21T20:00:00.000Z") }),
      },
    };
    const jwt = { sign: jest.fn().mockReturnValue("signed-token") };
    const email = emailMock();
    const contacts = contactsMock();
    const service = new AuthService(prisma as never, jwt as never, email as never, contacts as never);

    await service.register({ name: "New Organizer", organizerName: "New Organizer Co", email: "new@example.hr", password: "secret123" });

    expect(email.sendOrganizerWelcome).toHaveBeenCalledWith("new@example.hr", { organizerName: "New Organizer Co", webUrl: "https://manifestacije.hr" });
    expect(email.sendAdminNewOrganizer).toHaveBeenCalledWith(
      expect.objectContaining({
        organizerName: "New Organizer Co",
        organizerEmail: "new@example.hr",
        adminOrganizersUrl: "https://manifestacije.hr/admin/organizers",
      }),
      5
    );
    expect(contacts.syncOrganizerRegistration).toHaveBeenCalledWith(
      expect.objectContaining({ id: 2, email: "new@example.hr" }),
      expect.objectContaining({ id: 5, name: "New Organizer Co" })
    );
  });

  it("registration still succeeds and returns a session when the welcome email dependency throws", async () => {
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 2, email: "new@example.hr", name: "New Organizer", role: UserRole.ORGANIZER, organizerId: 5, authVersion: 0 }),
      },
      organizer: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 5, name: "New Organizer Co" }),
      },
    };
    const jwt = { sign: jest.fn().mockReturnValue("signed-token") };
    // EmailService.sendOrganizerWelcome never throws in real usage — this simulates
    // an unexpected failure anyway to prove register()'s own try/catch guard keeps
    // registration safe even if that guarantee is ever broken.
    const email = emailMock({ sendOrganizerWelcome: jest.fn().mockRejectedValue(new Error("Resend down")) });
    const service = new AuthService(prisma as never, jwt as never, email as never, contactsMock() as never);

    const session = await service.register({ name: "New Organizer", organizerName: "New Organizer Co", email: "new@example.hr", password: "secret123" });

    expect(session.token).toBe("signed-token");
  });

  it("rejects organizer registration with an admin email", async () => {
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: 1,
          email: "info@manifestacije.hr",
          role: UserRole.ADMIN,
        }),
      },
    };
    const service = new AuthService(prisma as never, { sign: jest.fn() } as never, {} as never, contactsMock() as never);

    await expect(service.register({
      name: "Test User",
      organizerName: "Test Organizer",
      email: " info@manifestacije.hr ",
      password: "secret123",
    })).rejects.toThrow(BadRequestException);
  });
});

describe("AuthService.forgotPassword", () => {
  function makePrisma(overrides: Record<string, unknown> = {}) {
    return {
      user: { findUnique: jest.fn().mockResolvedValue(null) },
      passwordResetToken: {
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
        create: jest.fn().mockResolvedValue({ id: 1 }),
        delete: jest.fn().mockResolvedValue({ id: 1 }),
      },
      ...overrides,
    };
  }

  const KNOWN_USER = { id: 1, email: "organizer@example.hr", authVersion: 0 };

  it("returns the generic success message for a known email", async () => {
    const prisma = makePrisma({ user: { findUnique: jest.fn().mockResolvedValue(KNOWN_USER) } });
    const service = new AuthService(prisma as never, {} as never, emailMock() as never, contactsMock() as never);

    const result = await service.forgotPassword({ email: "organizer@example.hr" });

    expect(result).toEqual({ message: "Ako račun s tom adresom postoji, poslali smo upute za promjenu lozinke." });
  });

  it("returns the exact same generic message for an unknown email", async () => {
    const prisma = makePrisma({ user: { findUnique: jest.fn().mockResolvedValue(null) } });
    const service = new AuthService(prisma as never, {} as never, emailMock() as never, contactsMock() as never);

    const result = await service.forgotPassword({ email: "unknown@example.hr" });

    expect(result).toEqual({ message: "Ako račun s tom adresom postoji, poslali smo upute za promjenu lozinke." });
  });

  it("creates a hashed reset token for a known email, never storing the raw token", async () => {
    const prisma = makePrisma({ user: { findUnique: jest.fn().mockResolvedValue(KNOWN_USER) } });
    const service = new AuthService(prisma as never, {} as never, emailMock() as never, contactsMock() as never);

    await service.forgotPassword({ email: "organizer@example.hr" });

    expect(prisma.passwordResetToken.create).toHaveBeenCalledTimes(1);
    const createArgs = prisma.passwordResetToken.create.mock.calls[0][0];
    expect(createArgs.data.userId).toBe(1);
    expect(createArgs.data.tokenHash).toMatch(/^[a-f0-9]{64}$/); // SHA-256 hex digest
  });

  it("does not create a reset token for an unknown email", async () => {
    const prisma = makePrisma({ user: { findUnique: jest.fn().mockResolvedValue(null) } });
    const service = new AuthService(prisma as never, {} as never, emailMock() as never, contactsMock() as never);

    await service.forgotPassword({ email: "unknown@example.hr" });

    expect(prisma.passwordResetToken.create).not.toHaveBeenCalled();
  });

  it("invalidates previously issued unused tokens for the same user before creating a new one", async () => {
    const prisma = makePrisma({ user: { findUnique: jest.fn().mockResolvedValue(KNOWN_USER) } });
    const service = new AuthService(prisma as never, {} as never, emailMock() as never, contactsMock() as never);

    await service.forgotPassword({ email: "organizer@example.hr" });

    expect(prisma.passwordResetToken.deleteMany).toHaveBeenCalledWith({ where: { userId: 1, usedAt: null } });
  });

  it("sends the email with a reset URL built from the raw token, not the hash", async () => {
    const prisma = makePrisma({ user: { findUnique: jest.fn().mockResolvedValue(KNOWN_USER) } });
    const email = emailMock();
    const service = new AuthService(prisma as never, {} as never, email as never, contactsMock() as never);

    await service.forgotPassword({ email: "organizer@example.hr" });

    expect(email.sendPasswordReset).toHaveBeenCalledTimes(1);
    const [to, data] = email.sendPasswordReset.mock.calls[0];
    expect(to).toBe("organizer@example.hr");
    expect(data.resetUrl).toMatch(/^https:\/\/manifestacije\.hr\/reset-password\?token=/);
    const createArgs = prisma.passwordResetToken.create.mock.calls[0][0];
    const rawTokenFromUrl = decodeURIComponent(data.resetUrl.split("token=")[1]);
    expect(createHash("sha256").update(rawTokenFromUrl).digest("hex")).toBe(createArgs.data.tokenHash);
  });

  it("returns the generic response even when email sending fails, without revealing account existence", async () => {
    const prisma = makePrisma({ user: { findUnique: jest.fn().mockResolvedValue(KNOWN_USER) } });
    const email = emailMock({ sendPasswordReset: jest.fn().mockRejectedValue(new Error("Resend down")) });
    const service = new AuthService(prisma as never, {} as never, email as never, contactsMock() as never);

    const result = await service.forgotPassword({ email: "organizer@example.hr" });

    expect(result).toEqual({ message: "Ako račun s tom adresom postoji, poslali smo upute za promjenu lozinke." });
  });

  it("deletes the newly created token when email sending fails (preferred strategy: no orphaned valid token)", async () => {
    const prisma = makePrisma({ user: { findUnique: jest.fn().mockResolvedValue(KNOWN_USER) } });
    const email = emailMock({ sendPasswordReset: jest.fn().mockRejectedValue(new Error("Resend down")) });
    const service = new AuthService(prisma as never, {} as never, email as never, contactsMock() as never);

    await service.forgotPassword({ email: "organizer@example.hr" });

    expect(prisma.passwordResetToken.delete).toHaveBeenCalledWith({ where: { id: 1 } });
  });
});

describe("AuthService.resetPassword", () => {
  const RAW_TOKEN = "a".repeat(64);
  const TOKEN_HASH = createHash("sha256").update(RAW_TOKEN).digest("hex");

  function makeTx() {
    return {
      user: { update: jest.fn().mockResolvedValue({}) },
      passwordResetToken: { update: jest.fn().mockResolvedValue({}), deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
    };
  }

  it("changes the password for a valid, unused, unexpired token", async () => {
    const tx = makeTx();
    const prisma = {
      passwordResetToken: {
        findUnique: jest.fn().mockResolvedValue({ id: 9, userId: 1, tokenHash: TOKEN_HASH, expiresAt: new Date(Date.now() + 60_000), usedAt: null }),
      },
      $transaction: jest.fn((cb) => cb(tx)),
    };
    const service = new AuthService(prisma as never, {} as never, {} as never, contactsMock() as never);

    const result = await service.resetPassword({ token: RAW_TOKEN, newPassword: "brandNewPassword123" });

    expect(result).toEqual({ message: "Lozinka je uspješno promijenjena." });
    expect(tx.user.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: expect.objectContaining({ authVersion: { increment: 1 } }),
    });
  });

  it("hashes the new password rather than storing it in plain text", async () => {
    const tx = makeTx();
    const prisma = {
      passwordResetToken: {
        findUnique: jest.fn().mockResolvedValue({ id: 9, userId: 1, tokenHash: TOKEN_HASH, expiresAt: new Date(Date.now() + 60_000), usedAt: null }),
      },
      $transaction: jest.fn((cb) => cb(tx)),
    };
    const service = new AuthService(prisma as never, {} as never, {} as never, contactsMock() as never);

    await service.resetPassword({ token: RAW_TOKEN, newPassword: "brandNewPassword123" });

    const updateArgs = tx.user.update.mock.calls[0][0];
    expect(updateArgs.data.passwordHash).not.toBe("brandNewPassword123");
    expect(await bcrypt.compare("brandNewPassword123", updateArgs.data.passwordHash)).toBe(true);
  });

  it("marks the token as used", async () => {
    const tx = makeTx();
    const prisma = {
      passwordResetToken: {
        findUnique: jest.fn().mockResolvedValue({ id: 9, userId: 1, tokenHash: TOKEN_HASH, expiresAt: new Date(Date.now() + 60_000), usedAt: null }),
      },
      $transaction: jest.fn((cb) => cb(tx)),
    };
    const service = new AuthService(prisma as never, {} as never, {} as never, contactsMock() as never);

    await service.resetPassword({ token: RAW_TOKEN, newPassword: "brandNewPassword123" });

    expect(tx.passwordResetToken.update).toHaveBeenCalledWith({ where: { id: 9 }, data: { usedAt: expect.any(Date) } });
  });

  it("invalidates other unused reset tokens for the same user", async () => {
    const tx = makeTx();
    const prisma = {
      passwordResetToken: {
        findUnique: jest.fn().mockResolvedValue({ id: 9, userId: 1, tokenHash: TOKEN_HASH, expiresAt: new Date(Date.now() + 60_000), usedAt: null }),
      },
      $transaction: jest.fn((cb) => cb(tx)),
    };
    const service = new AuthService(prisma as never, {} as never, {} as never, contactsMock() as never);

    await service.resetPassword({ token: RAW_TOKEN, newPassword: "brandNewPassword123" });

    expect(tx.passwordResetToken.deleteMany).toHaveBeenCalledWith({
      where: { userId: 1, usedAt: null, id: { not: 9 } },
    });
  });

  it("rejects an unknown token", async () => {
    const prisma = { passwordResetToken: { findUnique: jest.fn().mockResolvedValue(null) } };
    const service = new AuthService(prisma as never, {} as never, {} as never, contactsMock() as never);

    await expect(service.resetPassword({ token: RAW_TOKEN, newPassword: "brandNewPassword123" }))
      .rejects.toThrow("Poveznica za promjenu lozinke nije valjana ili je istekla.");
  });

  it("rejects an expired token", async () => {
    const prisma = {
      passwordResetToken: {
        findUnique: jest.fn().mockResolvedValue({ id: 9, userId: 1, tokenHash: TOKEN_HASH, expiresAt: new Date(Date.now() - 60_000), usedAt: null }),
      },
    };
    const service = new AuthService(prisma as never, {} as never, {} as never, contactsMock() as never);

    await expect(service.resetPassword({ token: RAW_TOKEN, newPassword: "brandNewPassword123" }))
      .rejects.toThrow(BadRequestException);
  });

  it("rejects an already-used token", async () => {
    const prisma = {
      passwordResetToken: {
        findUnique: jest.fn().mockResolvedValue({ id: 9, userId: 1, tokenHash: TOKEN_HASH, expiresAt: new Date(Date.now() + 60_000), usedAt: new Date() }),
      },
    };
    const service = new AuthService(prisma as never, {} as never, {} as never, contactsMock() as never);

    await expect(service.resetPassword({ token: RAW_TOKEN, newPassword: "brandNewPassword123" }))
      .rejects.toThrow(BadRequestException);
  });

  it("does not touch the user or other tokens when the reset fails validation (no partial update)", async () => {
    const prisma = {
      passwordResetToken: { findUnique: jest.fn().mockResolvedValue(null) },
      $transaction: jest.fn(),
    };
    const service = new AuthService(prisma as never, {} as never, {} as never, contactsMock() as never);

    await expect(service.resetPassword({ token: RAW_TOKEN, newPassword: "brandNewPassword123" })).rejects.toThrow();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});

describe("JwtAuthGuard", () => {
  function context(headers: Record<string, string>) {
    const req = { headers, user: undefined as unknown };
    return {
      switchToHttp: () => ({ getRequest: () => req }),
      getHandler: () => "handler",
      getClass: () => "class",
      req,
    };
  }

  it("rejects non-admin users for admin-only handlers", async () => {
    const ctx = context({ authorization: "Bearer token" });
    const jwt = { verify: jest.fn().mockReturnValue({ id: 2, role: UserRole.ORGANIZER, authVersion: 0 }) };
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue([UserRole.ADMIN]) } as unknown as Reflector;
    const prisma = { user: { findUnique: jest.fn().mockResolvedValue({ id: 2, email: "o@example.hr", role: UserRole.ORGANIZER, organizerId: 1, authVersion: 0 }) } };
    const guard = new JwtAuthGuard(jwt as never, reflector, prisma as never);

    await expect(guard.canActivate(ctx as never)).rejects.toThrow(UnauthorizedException);
  });

  it("allows admin users for admin-only handlers", async () => {
    const ctx = context({ authorization: "Bearer token" });
    const jwt = { verify: jest.fn().mockReturnValue({ id: 1, role: UserRole.ADMIN, authVersion: 0 }) };
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue([UserRole.ADMIN]) } as unknown as Reflector;
    const prisma = { user: { findUnique: jest.fn().mockResolvedValue({ id: 1, email: "a@example.hr", role: UserRole.ADMIN, organizerId: null, authVersion: 0 }) } };
    const guard = new JwtAuthGuard(jwt as never, reflector, prisma as never);

    await expect(guard.canActivate(ctx as never)).resolves.toBe(true);
  });

  it("rejects a token whose authVersion no longer matches the user's current authVersion (invalidated by password reset)", async () => {
    const ctx = context({ authorization: "Bearer token" });
    const jwt = { verify: jest.fn().mockReturnValue({ id: 1, role: UserRole.ADMIN, authVersion: 0 }) };
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(undefined) } as unknown as Reflector;
    // authVersion is now 1 in the DB — user reset their password after this JWT was issued.
    const prisma = { user: { findUnique: jest.fn().mockResolvedValue({ id: 1, email: "a@example.hr", role: UserRole.ADMIN, organizerId: null, authVersion: 1 }) } };
    const guard = new JwtAuthGuard(jwt as never, reflector, prisma as never);

    await expect(guard.canActivate(ctx as never)).rejects.toThrow(UnauthorizedException);
  });

  it("accepts a token when authVersion matches", async () => {
    const ctx = context({ authorization: "Bearer token" });
    const jwt = { verify: jest.fn().mockReturnValue({ id: 1, role: UserRole.ADMIN, authVersion: 2 }) };
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(undefined) } as unknown as Reflector;
    const prisma = { user: { findUnique: jest.fn().mockResolvedValue({ id: 1, email: "a@example.hr", role: UserRole.ADMIN, organizerId: null, authVersion: 2 }) } };
    const guard = new JwtAuthGuard(jwt as never, reflector, prisma as never);

    await expect(guard.canActivate(ctx as never)).resolves.toBe(true);
  });

  it("rejects when the user referenced by the token no longer exists", async () => {
    const ctx = context({ authorization: "Bearer token" });
    const jwt = { verify: jest.fn().mockReturnValue({ id: 999, role: UserRole.ADMIN, authVersion: 0 }) };
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(undefined) } as unknown as Reflector;
    const prisma = { user: { findUnique: jest.fn().mockResolvedValue(null) } };
    const guard = new JwtAuthGuard(jwt as never, reflector, prisma as never);

    await expect(guard.canActivate(ctx as never)).rejects.toThrow(UnauthorizedException);
  });
});
