import { randomBytes, createHash } from "crypto";

/** Cryptographically random raw token — sent to the user in the reset email URL, never stored. */
export function generateResetToken(): string {
  return randomBytes(32).toString("hex");
}

/** One-way hash of the raw token — this is the only form persisted in PasswordResetToken.tokenHash. */
export function hashResetToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex");
}
