import { JwtService } from "@nestjs/jwt";
import { UnauthorizedException } from "@nestjs/common";
import { EventPreviewService } from "../src/events/event-preview.service";
import { PublicFeedService } from "../src/public-feed/public-feed.service";
import { JwtAuthGuard } from "../src/auth/jwt-auth.guard";

const jwt = new JwtService({ secret: "test-only-secret" });
const preview = new EventPreviewService(jwt);
const draft = { id: 9, slug: "skica-koncert" };

function feed() {
  const findFirst = jest.fn().mockResolvedValue({ id: draft.id, slug: draft.slug });
  const service = new PublicFeedService({ event: { findFirst } } as never, preview);
  return { service, findFirst };
}

/** The status filter is what keeps an unpublished event off the public page. */
const filtered = (call: { where: Record<string, unknown> }) => "OR" in call.where;

describe("admin preview links", () => {
  it("serves the event whatever its status for a token issued for that slug", async () => {
    const { service, findFirst } = feed();
    await service.event(draft.slug, preview.sign(draft));
    expect(filtered(findFirst.mock.calls[0][0])).toBe(false);
  });

  it.each([
    ["no token", undefined],
    ["a token for another event", preview.sign({ id: 10, slug: "drugi-koncert" })],
    ["a token signed with another secret", new JwtService({ secret: "other" }).sign({ scope: "event-preview", slug: draft.slug })],
    ["a session token without the preview scope", jwt.sign({ id: 1, slug: draft.slug })],
    ["nonsense", "not-a-token"],
  ])("keeps the public status filter with %s", async (_label, token) => {
    const { service, findFirst } = feed();
    await service.event(draft.slug, token as string | undefined);
    expect(filtered(findFirst.mock.calls[0][0])).toBe(true);
  });

  it("stops serving the draft once the link has expired", async () => {
    const expired = jwt.sign({ scope: "event-preview", eventId: draft.id, slug: draft.slug }, { expiresIn: "-1s" });
    const { service, findFirst } = feed();
    await service.event(draft.slug, expired);
    expect(filtered(findFirst.mock.calls[0][0])).toBe(true);
  });

  it("never accepts a preview token as a session", async () => {
    const guard = new JwtAuthGuard(jwt, { getAllAndOverride: () => undefined } as never, { user: { findUnique: jest.fn() } } as never);
    const ctx = {
      switchToHttp: () => ({ getRequest: () => ({ headers: { authorization: `Bearer ${preview.sign(draft)}` } }) }),
      getHandler: () => undefined, getClass: () => undefined,
    } as never;
    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
