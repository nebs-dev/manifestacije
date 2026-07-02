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
    const service = new AuthService(prisma as never, jwt as never);

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
    const service = new AuthService(prisma as never, { sign: jest.fn() } as never);

    await expect(service.login({ email: "admin@example.hr", password: "wrong" })).rejects.toThrow(UnauthorizedException);
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
    const service = new AuthService(prisma as never, { sign: jest.fn() } as never);

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
