import * as bcrypt from "bcryptjs";
import { UserRole } from "@prisma/client";
import { createAdminUser, normalizeAdminInput } from "../src/scripts/admin-user-provisioning";

describe("admin user provisioning", () => {
  it("normalizes the email and creates a bcrypt-hashed ADMIN user", async () => {
    const user = {
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({ id: 42, email: "editor@example.hr", name: "Event Editor" }),
    };

    const created = await createAdminUser(user as never, {
      email: " Editor@Example.HR ",
      name: " Event Editor ",
      password: "long-enough-password",
    });

    expect(created).toEqual({ id: 42, email: "editor@example.hr", name: "Event Editor" });
    expect(user.findUnique).toHaveBeenCalledWith({ where: { email: "editor@example.hr" }, select: { id: true } });
    const createInput = user.create.mock.calls[0][0];
    expect(createInput.data).toMatchObject({
      email: "editor@example.hr",
      name: "Event Editor",
      role: UserRole.ADMIN,
    });
    expect(await bcrypt.compare("long-enough-password", createInput.data.passwordHash)).toBe(true);
  });

  it("refuses an existing email before hashing or creating a user", async () => {
    const user = {
      findUnique: jest.fn().mockResolvedValue({ id: 7 }),
      create: jest.fn(),
    };

    await expect(createAdminUser(user as never, {
      email: "editor@example.hr",
      name: "Event Editor",
      password: "long-enough-password",
    })).rejects.toThrow("An account already exists for this email. No changes were made.");

    expect(user.create).not.toHaveBeenCalled();
  });

  it("turns a concurrent unique-email conflict into a safe duplicate error", async () => {
    const user = {
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockRejectedValue({ code: "P2002" }),
    };

    await expect(createAdminUser(user as never, {
      email: "editor@example.hr",
      name: "Event Editor",
      password: "long-enough-password",
    })).rejects.toThrow("An account already exists for this email. No changes were made.");
  });

  it("requires a valid email, name, and reset-compatible password length", () => {
    expect(() => normalizeAdminInput({ email: "not-an-email", name: "Editor", password: "long-enough-password" })).toThrow("Email must be valid.");
    expect(() => normalizeAdminInput({ email: "editor@example.hr", name: " ", password: "long-enough-password" })).toThrow("Name is required.");
    expect(() => normalizeAdminInput({ email: "editor@example.hr", name: "Editor", password: "short" })).toThrow("Password must be at least 10 characters.");
  });
});
