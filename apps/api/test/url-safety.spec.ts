import { BadRequestException, ValidationPipe } from "@nestjs/common";
import { EventStatus } from "@prisma/client";
import { normalizeSafeHttpUrl, requireSafeHttpUrl } from "../src/common/safe-url";
import { EventsService } from "../src/events/events.service";
import { OrganizerService } from "../src/organizers/organizer.service";
import { OrganizerEventDto, OrganizerProfileDto, SubmitSourceDto } from "../src/organizers/organizer.dto";
import { AdminEventDto, CandidateOverrideDto, PartnerDto, UpdateEventSourceDto } from "../src/admin/admin.dto";
import { AdminService } from "../src/admin/admin.service";
import { auditParsedJson, auditRows, classifyStoredUrl } from "../src/scripts/audit-unsafe-urls";

const DANGEROUS = [
  "javascript:alert(1)",
  "JaVaScRiPt:alert(document.cookie)",
  "  javascript:alert(1)",
  "java\tscript:alert(1)",
  "\u0001javascript:alert(1)",
  "data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==",
  "vbscript:msgbox(1)",
  "file:///etc/passwd",
  "/relative/path",
  "\\\\evil.com",
  "TBA",
];

// Matches main.ts: app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }))
const globalPipe = new ValidationPipe({ whitelist: true, transform: true });
const viaPipe = (payload: object, metatype: new () => object) =>
  globalPipe.transform(payload, { type: "body", metatype, data: "" });

describe("normalizeSafeHttpUrl", () => {
  it.each([
    "https://www.entrio.hr/event/koncert-123",
    "http://example.com/a?b=1#c",
    "https://res.cloudinary.com/demo/image/upload/v1/event.jpg",
  ])("keeps %s unchanged", (url) => {
    expect(normalizeSafeHttpUrl(url)).toBe(url);
  });

  it.each([
    ["www.entrio.hr", "https://www.entrio.hr"],
    ["entrio.hr/koncert?id=5", "https://entrio.hr/koncert?id=5"],
    ["www.entrio.hr:8080/x", "https://www.entrio.hr:8080/x"],
    ["//cdn.example.com/a.jpg", "https://cdn.example.com/a.jpg"],
  ])("prefixes scheme-less %s with https", (input, expected) => {
    expect(normalizeSafeHttpUrl(input)).toBe(expected);
  });

  it.each(DANGEROUS)("rejects %j", (input) => {
    expect(normalizeSafeHttpUrl(input)).toBeNull();
  });

  it("allows tel:/mailto: only when contact links are enabled (ticket links)", () => {
    expect(normalizeSafeHttpUrl("tel:099-488-9294", { allowContactLinks: true })).toBe("tel:099-488-9294");
    expect(normalizeSafeHttpUrl("tel:+385 1 234 5678", { allowContactLinks: true })).toBe("tel:+385 1 234 5678");
    expect(normalizeSafeHttpUrl("mailto:ulaznice@udruga.hr", { allowContactLinks: true })).toBe("mailto:ulaznice@udruga.hr");
    expect(normalizeSafeHttpUrl("tel:099-488-9294")).toBeNull();
    expect(normalizeSafeHttpUrl("mailto:ulaznice@udruga.hr")).toBeNull();
    for (const bad of ["tel:javascript:alert(1)", "tel:<script>", "mailto:a@b.hr?body=<x>", ...DANGEROUS]) {
      expect(normalizeSafeHttpUrl(bad, { allowContactLinks: true })).toBeNull();
    }
  });

  it("leaves blank values alone so they keep their 'clear field' meaning", () => {
    expect(requireSafeHttpUrl("", "ticketUrl")).toBe("");
    expect(requireSafeHttpUrl(null, "sourceUrl")).toBeNull();
    expect(requireSafeHttpUrl(undefined, "imageUrl")).toBeUndefined();
  });
});

describe("URL fields in request DTOs", () => {
  // Event content URL fields are normalized by the pipe and enforced by
  // EventsService (it knows the stored value, so unchanged legacy values do
  // not block unrelated edits). These run the real pipe and then the service.
  it.each(["ticketUrl", "sourceUrl", "imageUrl"])("organizer event %s: javascript: is rejected after the pipe", async (field) => {
    const { prisma, organizer } = organizerFixture();
    const dto = await viaPipe({ ...BASE, [field]: "javascript:alert(1)" }, OrganizerEventDto);
    await expect(organizer.createEvent(7, dto as never)).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.event.create).not.toHaveBeenCalled();
  });

  it("admin event: data: image URL is rejected after the pipe", async () => {
    const { prisma, events } = organizerFixture();
    const dto = await viaPipe({ imageUrl: "data:image/svg+xml,<svg onload=alert(1)>" }, AdminEventDto);
    await expect(events.updateEvent(1, dto as never)).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.event.update).not.toHaveBeenCalled();
  });

  it("accepts tel: ticket links but not tel:/mailto: source or image links", async () => {
    const { prisma, events } = organizerFixture();
    await expect(viaPipe({ ticketUrl: "tel:099-488-9294" }, OrganizerEventDto)).resolves.toEqual(expect.objectContaining({ ticketUrl: "tel:099-488-9294" }));
    await events.updateEvent(1, await viaPipe({ ticketUrl: "tel:099-488-9294" }, AdminEventDto) as never);
    expect(prisma.event.update.mock.calls[0][0].data.ticketUrl).toBe("tel:099-488-9294");
    await expect(events.updateEvent(1, await viaPipe({ sourceUrl: "tel:099-488-9294" }, OrganizerEventDto) as never)).rejects.toBeInstanceOf(BadRequestException);
    await expect(events.updateEvent(1, await viaPipe({ imageUrl: "mailto:a@b.hr" }, AdminEventDto) as never)).rejects.toBeInstanceOf(BadRequestException);
  });

  it("normalizes scheme-less links and preserves legitimate ones", async () => {
    const dto = await viaPipe({
      ticketUrl: "www.entrio.hr/koncert",
      sourceUrl: "https://www.facebook.com/events/123",
      imageUrl: "https://res.cloudinary.com/demo/image/upload/a.jpg",
    }, OrganizerEventDto) as OrganizerEventDto;
    expect(dto.ticketUrl).toBe("https://www.entrio.hr/koncert");
    expect(dto.sourceUrl).toBe("https://www.facebook.com/events/123");
    expect(dto.imageUrl).toBe("https://res.cloudinary.com/demo/image/upload/a.jpg");
  });

  it("still accepts empty strings and null for clearing", async () => {
    await expect(viaPipe({ ticketUrl: "", sourceUrl: null }, OrganizerEventDto)).resolves.toEqual(expect.objectContaining({ ticketUrl: "", sourceUrl: null }));
    await expect(viaPipe({ sourceUrl: null }, UpdateEventSourceDto)).resolves.toEqual(expect.objectContaining({ sourceUrl: null }));
  });

  it("rejects unsafe organizer submission and evidence image links", async () => {
    await expect(viaPipe({ sourceUrl: "javascript:alert(1)" }, SubmitSourceDto)).rejects.toBeInstanceOf(BadRequestException);
    await expect(viaPipe({ rawText: "x", sourceImageUrl: "javascript:alert(1)" }, SubmitSourceDto)).rejects.toBeInstanceOf(BadRequestException);
  });

  it("rejects unsafe candidate overrides, partner and organizer website links", async () => {
    await expect(viaPipe({ ticketUrl: "javascript:alert(1)" }, CandidateOverrideDto)).rejects.toBeInstanceOf(BadRequestException);
    await expect(viaPipe({ name: "P", logoUrl: "https://cdn.example.com/a.png", websiteUrl: "javascript:alert(1)" }, PartnerDto)).rejects.toBeInstanceOf(BadRequestException);
    await expect(viaPipe({ websiteUrl: "javascript:alert(1)" }, OrganizerProfileDto)).rejects.toBeInstanceOf(BadRequestException);
    await expect(viaPipe({ websiteUrl: "www.udruga.hr" }, OrganizerProfileDto)).resolves.toEqual(expect.objectContaining({ websiteUrl: "https://www.udruga.hr" }));
  });
});

function organizerFixture() {
  const current = {
    id: 1, title: "Postojeći", slug: "postojeci", status: EventStatus.PENDING_REVIEW, organizerId: 7, isFeatured: false,
    publishedAt: null, cityId: 1, regionId: 1, startsAt: new Date("2099-09-05T12:00:00Z"), endsAt: null, occurrences: [],
  };
  const prisma: any = {
    event: {
      findUnique: jest.fn().mockImplementation(async ({ where }) => where.id ? current : null),
      findFirst: jest.fn().mockResolvedValue(current),
      count: jest.fn().mockResolvedValue(0),
      create: jest.fn().mockImplementation(async ({ data }) => ({ id: 2, ...data, occurrences: [] })),
      update: jest.fn().mockImplementation(async ({ data }) => ({ ...current, ...data })),
    },
    city: { findUnique: jest.fn().mockResolvedValue({ id: 1, name: "Osijek", countyId: 1, county: { regionId: 1 } }) },
    category: { findUnique: jest.fn().mockResolvedValue({ id: 1 }) },
    eventCategory: { upsert: jest.fn(), deleteMany: jest.fn() },
    organizer: { findUniqueOrThrow: jest.fn().mockResolvedValue({ id: 7, name: "Organizator", status: "CLAIMED" }) },
  };
  const cache = { revalidate: jest.fn().mockResolvedValue(true) };
  const events = new EventsService(prisma, { detectForEvent: jest.fn() } as never, cache as never);
  const email = { webUrl: "https://manifestacije.hr", sendEventSubmitted: jest.fn(), sendEventPublished: jest.fn(), sendAdminNewSubmission: jest.fn() };
  const organizer = new OrganizerService(prisma, events, {} as never, {} as never, email as never,
    { syncEventSubmitter: jest.fn() } as never, cache as never);
  return { prisma, events, organizer };
}

const BASE = { title: "Koncert", cityId: 1, categoryId: 1, startsAt: "2099-09-05T18:00:00.000Z" };

describe("event writes enforce safe URLs even when the DTO pipe is bypassed", () => {
  it.each(["ticketUrl", "sourceUrl", "imageUrl"])("organizer create rejects javascript: %s without writing", async (field) => {
    const { prisma, organizer } = organizerFixture();
    await expect(organizer.createEvent(7, { ...BASE, [field]: "javascript:alert(1)" } as never)).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.event.create).not.toHaveBeenCalled();
  });

  it("organizer update rejects data: links without writing", async () => {
    const { prisma, organizer } = organizerFixture();
    await expect(organizer.updateEvent(7, 1, { ticketUrl: "data:text/html,<script>alert(1)</script>" } as never)).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.event.update).not.toHaveBeenCalled();
  });

  it("organizer create stores legitimate and scheme-less links", async () => {
    const { prisma, organizer } = organizerFixture();
    await organizer.createEvent(7, { ...BASE, ticketUrl: "www.entrio.hr/koncert", sourceUrl: "https://www.facebook.com/events/1", imageUrl: "https://res.cloudinary.com/x/image/upload/a.jpg" } as never);
    expect(prisma.event.create.mock.calls[0][0].data).toEqual(expect.objectContaining({
      ticketUrl: "https://www.entrio.hr/koncert",
      sourceUrl: "https://www.facebook.com/events/1",
      imageUrl: "https://res.cloudinary.com/x/image/upload/a.jpg",
    }));
  });

  it("organizer update keeps an existing tel: ticket link", async () => {
    const { prisma, organizer } = organizerFixture();
    await organizer.updateEvent(7, 1, { ticketUrl: "tel:099-488-9294" } as never);
    expect(prisma.event.update.mock.calls[0][0].data).toEqual(expect.objectContaining({ ticketUrl: "tel:099-488-9294" }));
  });

  it("organizer update keeps clearing semantics for blank links", async () => {
    const { prisma, organizer } = organizerFixture();
    await organizer.updateEvent(7, 1, { ticketUrl: "", sourceUrl: null } as never);
    expect(prisma.event.update.mock.calls[0][0].data).toEqual(expect.objectContaining({ ticketUrl: "", sourceUrl: null }));
  });

  it("admin update rejects vbscript: image URLs", async () => {
    const { prisma, events } = organizerFixture();
    await expect(events.updateEvent(1, { imageUrl: "vbscript:msgbox(1)" })).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.event.update).not.toHaveBeenCalled();
  });
});

describe("admin candidate approval drops unsafe parsed links", () => {
  it("never forwards javascript:/data: links from parsed candidates", async () => {
    const parsedJson = {
      sourceUrl: "https://source.example",
      sourceType: "batch",
      candidates: [{
        title: "Koncert", description: "Opis", startsAt: "2099-07-04T18:00:00.000Z", city: "", category: "glazba", organizerName: "",
        ticketUrl: "javascript:alert(1)", sourceUrl: "data:text/html,x", imageUrl: "javascript:alert(1)",
        missingFields: [], warnings: [], _status: "pending",
      }],
    };
    const prisma = {
      eventSource: {
        findUnique: jest.fn().mockResolvedValue({ id: 1, parsedJson, sourceUrl: "https://www.entrio.hr/izvor", organizerId: null }),
        update: jest.fn().mockResolvedValue({ id: 1 }),
      },
      category: { findFirst: jest.fn().mockResolvedValue({ id: 22 }) },
    };
    const events = { createFromDto: jest.fn().mockResolvedValue({ id: 44 }) };
    const uploads = { uploadEventImageFromUrl: jest.fn().mockResolvedValue(null) };
    Object.assign(prisma, { $queryRaw: jest.fn().mockResolvedValue([]), $transaction: (work: (tx: typeof prisma) => unknown) => work(prisma) });
    const service = new AdminService(prisma as never, events as never, {} as never, {} as never, { revalidate: jest.fn().mockResolvedValue(true) } as never, {} as never, uploads as never);

    await service.createEventFromSource(1, 0);

    expect(uploads.uploadEventImageFromUrl).not.toHaveBeenCalled();
    expect(events.createFromDto).toHaveBeenCalledWith(expect.objectContaining({
      ticketUrl: undefined,
      sourceUrl: "https://www.entrio.hr/izvor",
      imageUrl: undefined,
    }), expect.any(Object), expect.anything());
  });
});

describe("read-only stored URL audit", () => {
  it("classifies stored values", () => {
    expect(classifyStoredUrl("https://entrio.hr")).toBeNull();
    expect(classifyStoredUrl("")).toBeNull();
    expect(classifyStoredUrl(null)).toBeNull();
    expect(classifyStoredUrl("www.entrio.hr")).toBe("SCHEMELESS");
    expect(classifyStoredUrl("javascript:alert(1)")).toBe("UNSAFE");
    expect(classifyStoredUrl("racesmanager")).toBe("UNSAFE");
    expect(classifyStoredUrl("tel:099-488-9294", { allowContactLinks: true })).toBeNull();
  });

  it("reports row and parsed-candidate findings", () => {
    expect(auditRows("Event", [{ id: 6, ticketUrl: "tel:099-488-9294", sourceUrl: "tel:099-488-9294", imageUrl: null }], ["ticketUrl", "sourceUrl", "imageUrl"]))
      .toEqual([expect.objectContaining({ id: 6, field: "sourceUrl", status: "UNSAFE" })]);
    expect(auditRows("Event", [{ id: 5, ticketUrl: "javascript:alert(1)", sourceUrl: "https://ok.hr", imageUrl: null }], ["ticketUrl", "sourceUrl", "imageUrl"]))
      .toEqual([{ table: "Event", id: 5, field: "ticketUrl", status: "UNSAFE", value: "javascript:alert(1)" }]);
    expect(auditParsedJson([{ id: 9, parsedJson: { sourceImageUrl: "data:x", candidates: [{ ticketUrl: "https://ok.hr" }, { sourceUrl: "javascript:x" }] } }]))
      .toEqual([
        expect.objectContaining({ table: "EventSource.parsedJson", id: 9, field: "sourceImageUrl", status: "UNSAFE" }),
        expect.objectContaining({ id: 9, field: "candidates[1].sourceUrl", status: "UNSAFE" }),
      ]);
  });
});
