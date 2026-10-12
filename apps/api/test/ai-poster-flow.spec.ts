import { ExecutionContext, INestApplication, Logger, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import Anthropic from "@anthropic-ai/sdk";
import { AdminController } from "../src/admin/admin.controller";
import { AdminService } from "../src/admin/admin.service";
import { UploadsService } from "../src/admin/uploads.service";
import { AiEventParserService } from "../src/ai-parser/ai-event-parser.service";
import { JwtAuthGuard } from "../src/auth/jwt-auth.guard";
import { OrganizerClaimService } from "../src/organizer-claims/organizer-claim.service";
import { OrganizerController } from "../src/organizers/organizer.controller";
import { OrganizerService } from "../src/organizers/organizer.service";

jest.mock("@anthropic-ai/sdk", () => ({ __esModule: true, default: jest.fn() }));

// Real local HTTP, controllers, validation, multipart upload, parser and source
// review classification. Anthropic transcripts, CDN, auth and DB are mocked;
// this suite does not establish real OCR or production credential validity.
describe("poster ingestion HTTP flow (mocked external services)", () => {
  let app: INestApplication;
  let base: string;
  let create: jest.Mock;
  const originalEnv = process.env;
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aSuoAAAAASUVORK5CYII=", "base64");
  let stored: Record<string, unknown> = {};
  const prisma: Record<string, unknown> & { eventSource: Record<string, jest.Mock> } = {
    event: { findMany: jest.fn().mockResolvedValue([]) },
    eventSource: {
      create: jest.fn().mockImplementation(async ({ data }) => (stored = { id: 1, ...data })),
      findFirst: jest.fn().mockResolvedValue(null),
      update: jest.fn().mockImplementation(async ({ data }) => (stored = { ...stored, ...data })),
    },
    $executeRaw: jest.fn().mockResolvedValue(0),
    $transaction: jest.fn(async (fn: (tx: unknown) => unknown): Promise<unknown> => fn(prisma as unknown)),
  };

  beforeAll(async () => {
    process.env = { ...originalEnv, ANTHROPIC_API_KEY: "synthetic-key", CLOUDINARY_URL: "cloudinary://synthetic:synthetic@fixture" };
    const parser = new AiEventParserService();
    const uploads = new UploadsService();
    const admin = new AdminService(prisma as never, {} as never, parser, {} as never, {} as never, {} as never, uploads);
    const organizer = new OrganizerService(prisma as never, {} as never, parser,
      { findCandidates: jest.fn().mockResolvedValue([]) } as never, {} as never, {} as never, {} as never);
    const module = await Test.createTestingModule({
      controllers: [AdminController, OrganizerController],
      providers: [{ provide: AdminService, useValue: admin }, { provide: OrganizerService, useValue: organizer },
        { provide: UploadsService, useValue: uploads }, { provide: OrganizerClaimService, useValue: {} }],
    }).overrideGuard(JwtAuthGuard).useValue({ canActivate(ctx: ExecutionContext) {
      ctx.switchToHttp().getRequest().user = { id: 1, organizerId: 7 };
      return true;
    } }).compile();
    app = module.createNestApplication({ logger: false });
    app.setGlobalPrefix("api");
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.listen(0, "127.0.0.1");
    base = await app.getUrl();
  });
  beforeEach(() => {
    create = jest.fn();
    (Anthropic as unknown as jest.Mock).mockImplementation(() => ({ messages: { create } }));
    prisma.eventSource.create.mockClear();
    jest.spyOn(Logger.prototype, "error").mockImplementation(() => undefined);
  });
  afterEach(() => jest.restoreAllMocks());
  afterAll(async () => { await app?.close(); process.env = originalEnv; });

  const paths = ["/api/admin/event-sources/manual-email", "/api/organizer/events/submit-url"];
  for (const path of paths) {
    it.each([
      ["12. siječnja 2099.", "20:00", "2099-01-12", "+01:00"],
      ["12. srpnja 2099.", "20.00", "2099-07-12", "+02:00"],
      ["12. rujna 2099.", "20 h", "2099-09-12", "+02:00"],
      ["12. listopada 2099.", "20:00", "2099-10-12", "+02:00"],
      ["12. listopada 2099.", "", "2099-10-12", ""],
      ["12. listopada 2099.", "20:00 ili 21:00", "2099-10-12", ""],
    ])(`${path}: preserves Croatian date evidence and review state for %s / %s`, async (dateText, timeText, date, offset) => {
      create.mockResolvedValue({ content: [{ type: "text", text: JSON.stringify({
        title: "Testni koncert", city: "Osijek", category: "glazba", startsAt: `${date}T20:00:00`, dateText, timeText, confidence: 0.9,
      }) }] });
      const response = await fetch(base + path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
        screenshotBase64: png.toString("base64"), screenshotMediaType: "image/png", useLlm: false,
      }) });
      expect(response.status).toBe(201);
      const source = await response.json();
      const candidate = source.parsedJson.candidates[0];
      expect(candidate.startsAt).toBe(offset ? `${date}T20:00:00${offset}` : "");
      expect(source.status).toBe(offset ? "PARSED" : "NEEDS_REVIEW");
      if (!offset) {
        expect(candidate.missingFields).toContain("startsAt");
        expect(candidate.warnings.join(" ")).toContain("pregled");
      }
      expect(create.mock.calls[0][0].messages[0].content[0]).toEqual({
        type: "image", source: { type: "base64", media_type: "image/png", data: png.toString("base64") },
      });
    });

    it(`${path}: sanitizes provider auth errors${path.includes("organizer") ? " and keeps the organizer submission for review" : " and creates no source"}`, async () => {
      create.mockRejectedValue({ status: 401, message: "synthetic-key" });
      const response = await fetch(base + path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
        screenshotBase64: png.toString("base64"), screenshotMediaType: "image/png",
      }) });
      const body = await response.text();
      expect(body).not.toContain("synthetic-key");
      if (!path.includes("organizer")) {
        // Admin manual parsing reports the failure immediately; nothing is lost.
        expect(response.status).toBe(503);
        expect(prisma.eventSource.create).not.toHaveBeenCalled();
        return;
      }
      // P1-B: organizer submissions are stored before parsing and kept on failure.
      expect(response.status).toBe(201);
      expect(JSON.parse(body)).toMatchObject({ parseStatus: "pending_review", status: "NEEDS_REVIEW" });
      expect(prisma.eventSource.create).toHaveBeenCalledTimes(1);
      expect(stored.parsedJson).toMatchObject({ candidates: [], parseError: expect.stringContaining("nije dostupna"),
        pendingScreenshots: [{ mediaType: "image/png", base64: png.toString("base64") }] });
    });
  }

  describe("multiple screenshots (EVT-07)", () => {
    const png2 = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAIAAAABCAYAAAD0In+KAAAAEUlEQVR42mP8z8Dwn4GBgQEADQUCAQ5n3J8AAAAASUVORK5CYII=", "base64");
    const shot = (buffer: Buffer, extra: Record<string, unknown> = {}) => ({ base64: buffer.toString("base64"), mediaType: "image/png", ...extra });
    const reply = { content: [{ type: "text", text: JSON.stringify({ title: "Spojeni koncert", city: "Osijek", category: "glazba", startsAt: "2099-07-12T20:00:00", dateText: "12. srpnja 2099.", timeText: "20:00", confidence: 0.9 }) }] };
    for (const path of paths) {
      it(`${path}: sends all images in one provider request and stores uploaded copies`, async () => {
        create.mockResolvedValue(reply);
        const response = await fetch(base + path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
          rawText: "Dodatni tekst", screenshots: [shot(png, { imageUrl: "https://res.cloudinary.com/demo/a.png" }), shot(png2, { imageUrl: "https://res.cloudinary.com/demo/b.png" }), shot(png)],
        }) });
        expect(response.status).toBe(201);
        expect(create).toHaveBeenCalledTimes(1);
        const content = create.mock.calls[0][0].messages[0].content;
        expect(content.filter((block: { type: string }) => block.type === "image")).toHaveLength(2);
        expect(content.at(-1).text).toContain("Priloženo je 2 slika istog izvora");
        const source = await response.json();
        expect(source.parsedJson.candidates).toHaveLength(1);
        expect(source.parsedJson.sourceImageUrls).toEqual(["https://res.cloudinary.com/demo/a.png", "https://res.cloudinary.com/demo/b.png"]);
        expect(source.parsedJson.sourceImageUrl).toBe("https://res.cloudinary.com/demo/a.png");
      });

      it(`${path}: rejects too many, unsupported or malformed images before calling the provider`, async () => {
        const post = (screenshots: unknown[]) => fetch(base + path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ rawText: "x", screenshots }) });
        expect((await post([shot(png), shot(png2), shot(png), shot(png2), shot(png)])).status).toBe(400);
        const svg = await post([{ base64: Buffer.from("<svg/>").toString("base64"), mediaType: "image/svg+xml" }]);
        expect(svg.status).toBe(400);
        expect(await svg.text()).toContain("JPEG, PNG, WebP i GIF");
        expect((await post([{ base64: "not base64!", mediaType: "image/png" }])).status).toBe(400);
        expect((await post([{ ...shot(png), imageUrl: "javascript:alert(1)" }])).status).toBe(400);
        expect(create).not.toHaveBeenCalled();
      });
    }
  });

  it.each(["admin", "organizer"])("%s: accepts a multipart screenshot and returns stored evidence metadata", async role => {
    const realFetch = global.fetch;
    jest.spyOn(global, "fetch").mockImplementation(async (input, init) => {
      if (String(input).startsWith("https://api.cloudinary.com/")) {
        const form = init!.body as FormData;
        expect(Buffer.from(await (form.get("file") as Blob).arrayBuffer())).toEqual(png);
        return new Response(JSON.stringify({ secure_url: "https://cdn.example/fixture.png", public_id: "fixture", width: 1, height: 1, format: "png" }), { status: 200 });
      }
      return realFetch(input, init);
    });
    const form = new FormData();
    form.append("file", new Blob([png], { type: "image/png" }), "fixture.png");
    const response = await fetch(`${base}/api/${role}/uploads/event-image`, { method: "POST", body: form });
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ imageUrl: "https://cdn.example/fixture.png", publicId: "fixture", width: 1, height: 1, format: "png" });
  });
});
