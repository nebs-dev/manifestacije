import { createHmac, timingSafeEqual } from "crypto";

const TOLERANCE_SECONDS = 5 * 60;

/**
 * Resend webhooks are signed the Svix way: HMAC-SHA256 over
 * `${svix-id}.${svix-timestamp}.${rawBody}`, keyed by the base64 payload of
 * the `whsec_`-prefixed secret. `svix-signature` may carry several
 * space-separated `v1,<sig>` candidates (key rotation) — any match is valid.
 */
export function verifyResendWebhookSignature(params: {
  svixId: string | undefined;
  svixTimestamp: string | undefined;
  svixSignature: string | undefined;
  rawBody: Buffer;
  secret: string;
}): boolean {
  const { svixId, svixTimestamp, svixSignature, rawBody, secret } = params;
  if (!svixId || !svixTimestamp || !svixSignature) return false;

  const timestamp = Number(svixTimestamp);
  if (!Number.isFinite(timestamp) || Math.abs(Date.now() / 1000 - timestamp) > TOLERANCE_SECONDS) return false;

  const secretBytes = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  const signedContent = `${svixId}.${svixTimestamp}.${rawBody.toString("utf8")}`;
  const expected = createHmac("sha256", secretBytes).update(signedContent).digest();

  return svixSignature.split(" ").some((token) => {
    const [, sig] = token.split(",");
    if (!sig) return false;
    let candidate: Buffer;
    try {
      candidate = Buffer.from(sig, "base64");
    } catch {
      return false;
    }
    return candidate.length === expected.length && timingSafeEqual(candidate, expected);
  });
}
