/**
 * Mints the same session token the API issues, so a test can start on an
 * authenticated screen without spending one of the ten login attempts a minute
 * the throttle allows (see seed-accounts.ts for the reasoning).
 *
 * Shape and algorithm follow apps/api: JwtModule.register({ secret,
 * signOptions: { expiresIn: "7d" } }) signs HS256, and AuthService.session()
 * puts exactly these claims in the payload. JwtAuthGuard then re-reads the
 * user from the database and compares `authVersion`, so a stale token is
 * rejected here exactly as it would be in production.
 */
import { createHmac } from "node:crypto";
import { JWT_SECRET } from "./env";

const base64url = (input: Buffer | string) =>
  Buffer.from(input).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

export type SessionClaims = {
  id: number;
  email: string;
  role: "ADMIN" | "ORGANIZER";
  organizerId: number | null;
  authVersion: number;
};

export function signSession(claims: SessionClaims, ttlSeconds = 7 * 24 * 60 * 60): string {
  const issuedAt = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = base64url(JSON.stringify({ ...claims, iat: issuedAt, exp: issuedAt + ttlSeconds }));
  const signature = base64url(createHmac("sha256", JWT_SECRET).update(`${header}.${payload}`).digest());
  return `${header}.${payload}.${signature}`;
}
