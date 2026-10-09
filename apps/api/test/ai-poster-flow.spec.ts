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
  const prisma = {
    event: { findMany: jest.fn().mockResolvedValue([]) },
    eventSource: { create: jest.fn().mockImplementation(async ({ data }) => ({ id: 1, ...data })) },
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

    it(`${path}: returns sanitized provider auth errors and creates no source`, async () => {
      create.mockRejectedValue({ status: 401, message: "synthetic-key" });
      const response = await fetch(base + path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
        screenshotBase64: png.toString("base64"), screenshotMediaType: "image/png",
      }) });
      expect(response.status).toBe(503);
      expect(await response.text()).not.toContain("synthetic-key");
      expect(prisma.eventSource.create).not.toHaveBeenCalled();
    });
  }

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
