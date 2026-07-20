import { createHmac } from "crypto";
import { verifyResendWebhookSignature } from "../src/webhooks/verify-resend-signature";

const SECRET = "whsec_" + Buffer.from("test-signing-key-bytes").toString("base64");

function sign(svixId: string, svixTimestamp: string, body: string): string {
  const secretBytes = Buffer.from(SECRET.replace(/^whsec_/, ""), "base64");
  const signedContent = `${svixId}.${svixTimestamp}.${body}`;
  const sig = createHmac("sha256", secretBytes).update(signedContent).digest("base64");
  return `v1,${sig}`;
}

describe("verifyResendWebhookSignature", () => {
  it("accepts a correctly signed payload", () => {
    const body = JSON.stringify({ type: "contact.updated" });
    const svixId = "msg_1";
    const svixTimestamp = String(Math.floor(Date.now() / 1000));
    const svixSignature = sign(svixId, svixTimestamp, body);

    const valid = verifyResendWebhookSignature({
      svixId,
      svixTimestamp,
      svixSignature,
      rawBody: Buffer.from(body),
      secret: SECRET,
    });

    expect(valid).toBe(true);
  });

  it("accepts when one of several space-separated signature candidates matches", () => {
    const body = JSON.stringify({ type: "contact.updated" });
    const svixId = "msg_1";
    const svixTimestamp = String(Math.floor(Date.now() / 1000));
    const real = sign(svixId, svixTimestamp, body);
    const svixSignature = `v1,bm9wZQ== ${real}`;

    const valid = verifyResendWebhookSignature({ svixId, svixTimestamp, svixSignature, rawBody: Buffer.from(body), secret: SECRET });

    expect(valid).toBe(true);
  });

  it("rejects a tampered body", () => {
    const svixId = "msg_1";
    const svixTimestamp = String(Math.floor(Date.now() / 1000));
    const svixSignature = sign(svixId, svixTimestamp, JSON.stringify({ type: "contact.updated" }));

    const valid = verifyResendWebhookSignature({
      svixId,
      svixTimestamp,
      svixSignature,
      rawBody: Buffer.from(JSON.stringify({ type: "contact.deleted" })),
      secret: SECRET,
    });

    expect(valid).toBe(false);
  });

  it("rejects a signature made with the wrong secret", () => {
    const body = JSON.stringify({ type: "contact.updated" });
    const svixId = "msg_1";
    const svixTimestamp = String(Math.floor(Date.now() / 1000));
    const wrongSecretBytes = Buffer.from("a-completely-different-key");
    const wrongSig = `v1,${createHmac("sha256", wrongSecretBytes).update(`${svixId}.${svixTimestamp}.${body}`).digest("base64")}`;

    const valid = verifyResendWebhookSignature({ svixId, svixTimestamp, svixSignature: wrongSig, rawBody: Buffer.from(body), secret: SECRET });

    expect(valid).toBe(false);
  });

  it("rejects a stale timestamp outside the tolerance window", () => {
    const body = JSON.stringify({ type: "contact.updated" });
    const svixId = "msg_1";
    const staleTimestamp = String(Math.floor(Date.now() / 1000) - 3600);
    const svixSignature = sign(svixId, staleTimestamp, body);

    const valid = verifyResendWebhookSignature({ svixId, svixTimestamp: staleTimestamp, svixSignature, rawBody: Buffer.from(body), secret: SECRET });

    expect(valid).toBe(false);
  });

  it("rejects when any required header is missing", () => {
    const valid = verifyResendWebhookSignature({
      svixId: undefined,
      svixTimestamp: String(Math.floor(Date.now() / 1000)),
      svixSignature: "v1,whatever",
      rawBody: Buffer.from("{}"),
      secret: SECRET,
    });

    expect(valid).toBe(false);
  });
});
