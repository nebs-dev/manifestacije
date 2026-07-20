import { BadRequestException, UnauthorizedException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { UserRole } from "@prisma/client";
import * as bcrypt from "bcryptjs";
import { AuthService } from "../src/auth/auth.service";
import { JwtAuthGuard } from "../src/auth/jwt-auth.guard";

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
          passwordHash,
        }),
      },
    };
    const jwt = { sign: jest.fn().mockReturnValue("signed-token") };
    const service = new AuthService(prisma as never, jwt as never, { webUrl: "https://manifestacije.hr", sendOrganizerWelcome: jest.fn() } as never);

    const session = await service.login({ email: " Admin@Example.hr ", password: "secret123" });

    expect(session.token).toBe("signed-token");
    expect(session.user).toEqual(expect.objectContaining({ id: 1, role: UserRole.ADMIN }));
    expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { email: "admin@example.hr" } });
    expect(jwt.sign).toHaveBeenCalledWith(expect.objectContaining({ id: 1, email: "admin@example.hr", role: UserRole.ADMIN }));
  });

  it("rejects bad credentials", async () => {
    const passwordHash = await bcrypt.hash("secret123", 10);
    const prisma = {
      user: { findUnique: jest.fn().mockResolvedValue({ passwordHash }) },
    };
    const service = new AuthService(prisma as never, { sign: jest.fn() } as never, {} as never);

    await expect(service.login({ email: "admin@example.hr", password: "wrong" })).rejects.toThrow(UnauthorizedException);
  });

  it("sends the organizer welcome email after a successful registration", async () => {
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 2, email: "new@example.hr", name: "New Organizer", role: UserRole.ORGANIZER, organizerId: 5 }),
      },
      organizer: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 5, name: "New Organizer Co" }),
      },
    };
    const jwt = { sign: jest.fn().mockReturnValue("signed-token") };
    const sendOrganizerWelcome = jest.fn().mockResolvedValue(undefined);
    const service = new AuthService(prisma as never, jwt as never, { webUrl: "https://manifestacije.hr", sendOrganizerWelcome } as never);

    await service.register({ name: "New Organizer", organizerName: "New Organizer Co", email: "new@example.hr", password: "secret123" });

    expect(sendOrganizerWelcome).toHaveBeenCalledWith("new@example.hr", { organizerName: "New Organizer Co", webUrl: "https://manifestacije.hr" });
  });

  it("registration still succeeds and returns a session when the welcome email dependency throws", async () => {
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 2, email: "new@example.hr", name: "New Organizer", role: UserRole.ORGANIZER, organizerId: 5 }),
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
    const sendOrganizerWelcome = jest.fn().mockRejectedValue(new Error("Resend down"));
    const service = new AuthService(prisma as never, jwt as never, { webUrl: "https://manifestacije.hr", sendOrganizerWelcome } as never);

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
    const service = new AuthService(prisma as never, { sign: jest.fn() } as never, {} as never);

    await expect(service.register({
      name: "Test User",
      organizerName: "Test Organizer",
      email: " info@manifestacije.hr ",
      password: "secret123",
    })).rejects.toThrow(BadRequestException);
  });
});

describe("JwtAuthGuard", () => {
  function context(headers: Record<string, string>, role: UserRole) {
    const req = { headers, user: undefined as unknown };
    return {
      switchToHttp: () => ({ getRequest: () => req }),
      getHandler: () => "handler",
      getClass: () => "class",
      req,
      role,
    };
  }

  it("rejects non-admin users for admin-only handlers", () => {
    const ctx = context({ authorization: "Bearer token" }, UserRole.ORGANIZER);
    const jwt = { verify: jest.fn().mockReturnValue({ id: 2, role: UserRole.ORGANIZER }) };
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue([UserRole.ADMIN]) } as unknown as Reflector;
    const guard = new JwtAuthGuard(jwt as never, reflector);

    expect(() => guard.canActivate(ctx as never)).toThrow(UnauthorizedException);
  });

  it("allows admin users for admin-only handlers", () => {
    const ctx = context({ authorization: "Bearer token" }, UserRole.ADMIN);
    const jwt = { verify: jest.fn().mockReturnValue({ id: 1, role: UserRole.ADMIN }) };
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue([UserRole.ADMIN]) } as unknown as Reflector;
    const guard = new JwtAuthGuard(jwt as never, reflector);

    expect(guard.canActivate(ctx as never)).toBe(true);
  });
});
