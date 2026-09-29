import { PrismaClient, UserRole } from "@prisma/client";
import * as bcrypt from "bcryptjs";

export type CreateAdminInput = {
  email: string;
  name: string;
  password: string;
};

export type CreatedAdmin = {
  id: number;
  email: string;
  name: string;
};

type UserClient = Pick<PrismaClient["user"], "findUnique" | "create">;

export function normalizeAdminInput(input: CreateAdminInput): CreateAdminInput {
  const email = input.email.trim().toLowerCase();
  const name = input.name.trim();

  if (!email) throw new Error("Email is required.");
  if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error("Email must be valid.");
  if (!name) throw new Error("Name is required.");
  if (input.password.length < 10) throw new Error("Password must be at least 10 characters.");
  if (input.password.length > 128) throw new Error("Password must be at most 128 characters.");

  return { email, name, password: input.password };
}

export async function createAdminUser(user: UserClient, input: CreateAdminInput): Promise<CreatedAdmin> {
  const normalized = normalizeAdminInput(input);
  const existing = await user.findUnique({ where: { email: normalized.email }, select: { id: true } });
  if (existing) throw new Error("An account already exists for this email. No changes were made.");

  const passwordHash = await bcrypt.hash(normalized.password, 10);

  try {
    return await user.create({
      data: {
        email: normalized.email,
        name: normalized.name,
        passwordHash,
        role: UserRole.ADMIN,
      },
      select: { id: true, email: true, name: true },
    });
  } catch (error) {
    if (isUniqueEmailError(error)) {
      throw new Error("An account already exists for this email. No changes were made.");
    }
    throw error;
  }
}

function isUniqueEmailError(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
}
