import { BadRequestException, ServiceUnavailableException } from "@nestjs/common";
import { OrganizerService } from "../src/organizers/organizer.service";
import { ParsedEventCandidate, ParsedSourceResult } from "../src/ai-parser/ai-event-parser.service";

function candidate(overrides: Partial<ParsedEventCandidate> = {}): ParsedEventCandidate {
  return {
    title: "Facebook koncert",
    description: "Opis",
    startsAt: "2099-07-04T18:00:00.000Z",
    endsAt: "",
    venueName: "Trg",
    address: "",
    city: "Osijek",
    county: "",
    region: "",
    category: "glazba",
    isFree: true,
    priceText: "",
    ticketUrl: "",
    sourceUrl: "https://facebook.com/events/123",
    organizerName: "Organizator",
    imageUrl: "",
    confidence: 0.8,
    missingFields: [],
    warnings: [],
    ...overrides,
  };
}

function parsedResult(overrides: Partial<ParsedSourceResult> = {}): ParsedSourceResult {
  return {
    sourceUrl: "https://facebook.com/events/123",
    sourceType: "single",
    candidates: [{ ...candidate(), _status: "pending" }],
    ...overrides,
  };
}

function emailMock() {
  return {
    webUrl: "https://manifestacije.hr",
    sendEventSubmitted: jest.fn(),
    sendEventPublished: jest.fn(),
    sendAdminNewSubmission: jest.fn(),
    sendAdminAutoPublished: jest.fn(),
  };
}

function contactsMock() {
  return {
    syncEventSubmitter: jest.fn().mockResolvedValue(undefined),
  };
}

/** In-memory EventSource rows plus the transaction/lock calls submitSource makes. */
function sourceTable(firstId: number) {
  const rows: Record<string, unknown>[] = [];
  let nextId = firstId;
  return {
    rows,
    last: () => rows.at(-1)!,
    findFirst: jest.fn(async ({ where }: { where: { organizerId: number; parsedJson: { equals: string } } }) =>
      [...rows].reverse().find((row) => row.organizerId === where.organizerId && (row.parsedJson as { submissionKey?: string }).submissionKey === where.parsedJson.equals) ?? null),
    create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => { const row = { id: nextId++, createdAt: new Date(), ...data }; rows.push(row); return row; }),
    update: jest.fn(async ({ where, data }: { where: { id: number }; data: Record<string, unknown> }) => {
      const row = rows.find((item) => item.id === where.id)!; Object.assign(row, data); return { ...row };
    }),
  };
}

function withTx<T extends object>(prisma: T) {
  const db = prisma as T & { $transaction: unknown; $executeRaw: unknown };
  db.$executeRaw = jest.fn().mockResolvedValue(0);
  db.$transaction = jest.fn(async (fn: (tx: unknown) => unknown) => fn(db));
  return db;
}

describe("OrganizerService submitSource", () => {
  it("does not bypass an attached poster with structured metadata from the accompanying URL", async () => {
    const result = parsedResult({ candidates: [{ ...candidate({ startsAt: "", missingFields: ["startsAt"],
      warnings: ["Vrijeme nije navedeno; potreban je pregled."] }), _status: "pending" }] });
    const prisma = { event: { findMany: jest.fn().mockResolvedValue([]) }, eventSource: sourceTable(1) };
    const parser = { extractJsonLdEvents: jest.fn().mockReturnValue(parsedResult()), parseBatchWithLlm: jest.fn().mockResolvedValue(result), parseBatch: jest.fn() };
    const service = new OrganizerService(withTx(prisma) as never, {} as never, parser as never, { findCandidates: jest.fn().mockResolvedValue([]) } as never, emailMock() as never, contactsMock() as never, { revalidate: jest.fn() } as never);
    const fetch = jest.spyOn(global, "fetch").mockResolvedValueOnce({ ok: true, text: async () => "<html>old schedule</html>" } as never);
    try {
      await service.submitSource(7, { sourceUrl: "https://example.com/event", screenshotBase64: "fixture", screenshotMediaType: "image/png", sourceImageUrl: "https://cdn.example/evidence.png" });
      expect(parser.extractJsonLdEvents).not.toHaveBeenCalled();
      expect(parser.parseBatch).not.toHaveBeenCalled();
      expect(parser.parseBatchWithLlm).toHaveBeenCalledWith(expect.objectContaining({ screenshots: [{ base64: "fixture", mediaType: "image/png" }], rawHtml: "<html>old schedule</html>" }));
      expect(prisma.eventSource.last()).toEqual(expect.objectContaining({ status: "NEEDS_REVIEW", parsedJson: { ...result, sourceImageUrl: "https://cdn.example/evidence.png", sourceImageUrls: ["https://cdn.example/evidence.png"], submissionKey: expect.any(String) } }));
    } finally { fetch.mockRestore(); }
  });

  describe("when AI parsing fails (P1-B)", () => {
    const unavailable = () => new ServiceUnavailableException("AI parsiranje nije konfigurirano. Obratite se administratoru.");
    function setup(parse: jest.Mock, firstId = 50) {
      const prisma = withTx({
        event: { findMany: jest.fn().mockResolvedValue([]) },
        eventSource: sourceTable(firstId),
        organizer: { findUnique: jest.fn().mockResolvedValue({ id: 7, name: "Test Organizer" }) },
      });
      const parser = { parseBatchWithLlm: parse, parseBatch: jest.fn(), extractJsonLdEvents: jest.fn().mockReturnValue(null) };
      const email = emailMock();
      const service = new OrganizerService(prisma as never, {} as never, parser as never, { findCandidates: jest.fn().mockResolvedValue([]) } as never, email as never, contactsMock() as never, { revalidate: jest.fn() } as never);
      return { prisma, parser, email, service };
    }

    it("keeps a text/URL submission for admin review instead of losing it", async () => {
      const { prisma, email, service } = setup(jest.fn().mockRejectedValue(unavailable()));
      const out = await service.submitSource(7, { rawText: "Koncert u Osijeku 20.11.", useLlm: true }, "organizer@example.hr");

      expect(out).toMatchObject({ id: 50, status: "NEEDS_REVIEW", parseStatus: "pending_review", alreadySubmitted: false });
      expect(prisma.eventSource.rows).toHaveLength(1);
      expect(prisma.eventSource.last()).toMatchObject({
        organizerId: 7, rawText: "Koncert u Osijeku 20.11.", confidence: 0,
        parsedJson: expect.objectContaining({ candidates: [], parseError: expect.stringContaining("nije dostupna") }),
      });
      expect(email.sendAdminNewSubmission).toHaveBeenCalledWith(expect.objectContaining({ titleOrSource: "Zaprimljeni sadržaj" }), 50);
      expect(email.sendEventSubmitted).toHaveBeenCalledTimes(1);
    });

    it("persists before invoking the parser", async () => {
      let rowsAtParse = -1;
      const parse = jest.fn();
      const ctx = setup(parse);
      parse.mockImplementation(async () => { rowsAtParse = ctx.prisma.eventSource.rows.length; throw new Error("timeout"); });
      await ctx.service.submitSource(7, { rawText: "Plakat", useLlm: true });
      expect(rowsAtParse).toBe(1);
      expect(ctx.prisma.eventSource.last()).toMatchObject({ status: "NEEDS_REVIEW", parsedJson: expect.objectContaining({ parseError: expect.stringContaining("nije uspjela") }) });
    });

    it("keeps poster bytes only when no uploaded copy exists", async () => {
      const failed = setup(jest.fn().mockRejectedValue(unavailable()));
      await failed.service.submitSource(7, { screenshotBase64: "cG9zdGVy", screenshotMediaType: "image/png" });
      expect(failed.prisma.eventSource.last().parsedJson).toMatchObject({ pendingScreenshots: [{ mediaType: "image/png", base64: "cG9zdGVy" }] });

      const uploaded = setup(jest.fn().mockRejectedValue(unavailable()));
      await uploaded.service.submitSource(7, { screenshotBase64: "cG9zdGVy", screenshotMediaType: "image/png", sourceImageUrl: "https://res.cloudinary.com/demo/poster.png" });
      expect(uploaded.prisma.eventSource.last().parsedJson).toMatchObject({ sourceImageUrl: "https://res.cloudinary.com/demo/poster.png" });
      expect(uploaded.prisma.eventSource.last().parsedJson).not.toHaveProperty("pendingScreenshots");

      const unsupported = setup(jest.fn().mockRejectedValue(unavailable()));
      await unsupported.service.submitSource(7, { screenshotBase64: "PHN2Zz4=", screenshotMediaType: "image/svg+xml" });
      expect(unsupported.prisma.eventSource.last().parsedJson).not.toHaveProperty("pendingScreenshots");
    });

    it("keeps un-uploaded posters as evidence after a successful parse too (EVT-07)", async () => {
      const ok = setup(jest.fn().mockResolvedValue(parsedResult()))
      await ok.service.submitSource(7, { screenshots: [{ base64: "cG9zdGVy", mediaType: "image/png" }, { base64: "ZHJ1Z2k=", mediaType: "image/jpeg", imageUrl: "https://res.cloudinary.com/demo/b.jpg" }] })
      expect(ok.parser.parseBatchWithLlm).toHaveBeenCalledTimes(1)
      expect(ok.prisma.eventSource.last()).toMatchObject({ status: "NEEDS_REVIEW", parsedJson: expect.objectContaining({
        pendingScreenshots: [{ base64: "cG9zdGVy", mediaType: "image/png" }], sourceImageUrls: ["https://res.cloudinary.com/demo/b.jpg"] }) })
    });

    it("a retry of the same content re-parses the same row once the provider recovers, without duplicates or repeat notices", async () => {
      const parse = jest.fn().mockRejectedValueOnce(unavailable()).mockResolvedValueOnce(parsedResult());
      const { prisma, email, service } = setup(parse);
      const dto = { screenshotBase64: "cG9zdGVy", screenshotMediaType: "image/png", rawText: "Plakat" };

      await service.submitSource(7, dto, "organizer@example.hr");
      const retry = await service.submitSource(7, dto, "organizer@example.hr");

      expect(retry).toMatchObject({ id: 50, parseStatus: "parsed", alreadySubmitted: true });
      expect(prisma.eventSource.rows).toHaveLength(1);
      expect(prisma.eventSource.create).toHaveBeenCalledTimes(1);
      const json = prisma.eventSource.last().parsedJson as Record<string, unknown>;
      expect(json.candidates).toHaveLength(1);
      expect(json).not.toHaveProperty("parseError");
      // The original poster stays as evidence for review and later supplements (EVT-07/08).
      expect(json).toHaveProperty("pendingScreenshots");
      expect(email.sendAdminNewSubmission).toHaveBeenCalledTimes(1);
      expect(email.sendEventSubmitted).toHaveBeenCalledTimes(1);
    });

    it("returns an already parsed submission unchanged on resubmit and never re-parses it", async () => {
      const parse = jest.fn().mockResolvedValue(parsedResult());
      const { prisma, service } = setup(parse);
      await service.submitSource(7, { rawText: "Isti tekst", useLlm: true });
      const again = await service.submitSource(7, { rawText: "  Isti tekst  ", useLlm: true });
      expect(again).toMatchObject({ id: 50, parseStatus: "parsed", alreadySubmitted: true });
      expect(parse).toHaveBeenCalledTimes(1);
      expect(prisma.eventSource.rows).toHaveLength(1);
    });

    it("does not merge the same content across organizers or different content", async () => {
      const { prisma, service } = setup(jest.fn().mockRejectedValue(unavailable()));
      await service.submitSource(7, { rawText: "Isti tekst", useLlm: true });
      await service.submitSource(8, { rawText: "Isti tekst", useLlm: true });
      await service.submitSource(7, { rawText: "Drugi tekst", useLlm: true });
      expect(prisma.eventSource.rows).toHaveLength(3);
    });
  });

  it("rejects Facebook URL without screenshot or raw text", async () => {
    const service = new OrganizerService({} as never, {} as never, {} as never, { findCandidates: jest.fn().mockResolvedValue([]) } as never, emailMock() as never, contactsMock() as never, { revalidate: jest.fn().mockResolvedValue(true) } as never);

    await expect(service.submitSource(1, { sourceUrl: "https://facebook.com/events/123" }))
      .rejects.toBeInstanceOf(BadRequestException);
  });

  it("uses LLM parser for Facebook URL with raw text and keeps source in review", async () => {
    const result = parsedResult();
    const prisma = {
      event: { findMany: jest.fn().mockResolvedValue([]) },
      eventSource: sourceTable(10),
      organizer: { findUnique: jest.fn().mockResolvedValue({ id: 7, name: "Test Organizer" }) },
    };
    const parser = {
      parseBatchWithLlm: jest.fn().mockResolvedValue(result),
      parseBatch: jest.fn(),
    };
    const service = new OrganizerService(withTx(prisma) as never, {} as never, parser as never, { findCandidates: jest.fn().mockResolvedValue([]) } as never, emailMock() as never, contactsMock() as never, { revalidate: jest.fn().mockResolvedValue(true) } as never);

    await service.submitSource(7, {
      sourceUrl: "https://www.facebook.com/events/123",
      rawText: "Koncert, Osijek, 4.7.2026.",
    });

    expect(parser.parseBatchWithLlm).toHaveBeenCalledWith(expect.objectContaining({
      sourceUrl: "https://www.facebook.com/events/123",
      rawText: "Koncert, Osijek, 4.7.2026.",
    }));
    expect(parser.parseBatch).not.toHaveBeenCalled();
    expect(prisma.eventSource.last()).toEqual(expect.objectContaining({
      organizerId: 7,
      type: "URL",
      parsedJson: { ...result, submissionKey: expect.any(String) },
      confidence: 0.8,
      status: "NEEDS_REVIEW",
    }));
  });

  it("stores screenshot evidence URL in parsed JSON when upload exists", async () => {
    const result = parsedResult({ candidates: [{ ...candidate({ confidence: 0.6 }), _status: "pending" }] });
    const prisma = {
      event: { findMany: jest.fn().mockResolvedValue([]) },
      eventSource: sourceTable(11),
      organizer: { findUnique: jest.fn().mockResolvedValue({ id: 7, name: "Test Organizer" }) },
    };
    const parser = {
      parseBatchWithLlm: jest.fn().mockResolvedValue(result),
    };
    const service = new OrganizerService(withTx(prisma) as never, {} as never, parser as never, { findCandidates: jest.fn().mockResolvedValue([]) } as never, emailMock() as never, contactsMock() as never, { revalidate: jest.fn().mockResolvedValue(true) } as never);

    await service.submitSource(7, {
      sourceUrl: "https://fb.me/e/abc",
      screenshotBase64: "abc123",
      screenshotMediaType: "image/jpeg",
      sourceImageUrl: "https://cdn.example/poster.jpg",
    });

    expect(parser.parseBatchWithLlm).toHaveBeenCalledWith(expect.objectContaining({
      screenshots: [{ base64: "abc123", mediaType: "image/jpeg" }],
    }));
    expect(prisma.eventSource.last().parsedJson).toEqual({
      ...result,
      sourceImageUrl: "https://cdn.example/poster.jpg",
      sourceImageUrls: ["https://cdn.example/poster.jpg"],
      submissionKey: expect.any(String),
    });
  });

  it("keeps non-Facebook submit compatible with rule parser", async () => {
    const result = parsedResult({ sourceUrl: "https://example.com/event" });
    const prisma = {
      event: { findMany: jest.fn().mockResolvedValue([]) },
      eventSource: sourceTable(12),
      organizer: { findUnique: jest.fn().mockResolvedValue({ id: 7, name: "Test Organizer" }) },
    };
    const parser = {
      parseBatch: jest.fn().mockResolvedValue(result),
      parseBatchWithLlm: jest.fn(),
    };
    const service = new OrganizerService(withTx(prisma) as never, {} as never, parser as never, { findCandidates: jest.fn().mockResolvedValue([]) } as never, emailMock() as never, contactsMock() as never, { revalidate: jest.fn().mockResolvedValue(true) } as never);

    await service.submitSource(7, { sourceUrl: "https://example.com/event", rawText: "Opis" });

    expect(parser.parseBatch).toHaveBeenCalledWith({
      sourceUrl: "https://example.com/event",
      rawText: "Opis",
    });
    expect(parser.parseBatchWithLlm).not.toHaveBeenCalled();
    expect(prisma.eventSource.last()).toEqual(expect.objectContaining({
      type: "URL",
      status: "PARSED",
    }));
  });

  it("sends the submitted confirmation to the organizer when their email is known", async () => {
    const result = parsedResult({ sourceUrl: "https://example.com/event" });
    const prisma = {
      event: { findMany: jest.fn().mockResolvedValue([]) },
      eventSource: sourceTable(20),
      organizer: { findUnique: jest.fn().mockResolvedValue({ id: 7, name: "Test Organizer" }) },
    };
    const parser = { parseBatch: jest.fn().mockResolvedValue(result), parseBatchWithLlm: jest.fn() };
    const email = emailMock();
    const service = new OrganizerService(withTx(prisma) as never, {} as never, parser as never, { findCandidates: jest.fn().mockResolvedValue([]) } as never, email as never, contactsMock() as never, { revalidate: jest.fn().mockResolvedValue(true) } as never);

    await service.submitSource(7, { sourceUrl: "https://example.com/event", rawText: "Opis" }, "organizer@example.hr");

    expect(email.sendEventSubmitted).toHaveBeenCalledWith("organizer@example.hr", expect.objectContaining({ eventTitle: expect.any(String) }));
  });

  it("does not send a submitted confirmation when no organizer email is known", async () => {
    const result = parsedResult({ sourceUrl: "https://example.com/event" });
    const prisma = {
      event: { findMany: jest.fn().mockResolvedValue([]) },
      eventSource: sourceTable(21),
      organizer: { findUnique: jest.fn().mockResolvedValue({ id: 7, name: "Test Organizer" }) },
    };
    const parser = { parseBatch: jest.fn().mockResolvedValue(result), parseBatchWithLlm: jest.fn() };
    const email = emailMock();
    const service = new OrganizerService(withTx(prisma) as never, {} as never, parser as never, { findCandidates: jest.fn().mockResolvedValue([]) } as never, email as never, contactsMock() as never, { revalidate: jest.fn().mockResolvedValue(true) } as never);

    await service.submitSource(7, { sourceUrl: "https://example.com/event", rawText: "Opis" });

    expect(email.sendEventSubmitted).not.toHaveBeenCalled();
  });

  it("always notifies the admin of a new submission regardless of organizer email", async () => {
    const result = parsedResult({ sourceUrl: "https://example.com/event" });
    const prisma = {
      event: { findMany: jest.fn().mockResolvedValue([]) },
      eventSource: sourceTable(22),
      organizer: { findUnique: jest.fn().mockResolvedValue({ id: 7, name: "Test Organizer" }) },
    };
    const parser = { parseBatch: jest.fn().mockResolvedValue(result), parseBatchWithLlm: jest.fn() };
    const email = emailMock();
    const service = new OrganizerService(withTx(prisma) as never, {} as never, parser as never, { findCandidates: jest.fn().mockResolvedValue([]) } as never, email as never, contactsMock() as never, { revalidate: jest.fn().mockResolvedValue(true) } as never);

    await service.submitSource(7, { sourceUrl: "https://example.com/event", rawText: "Opis" });

    expect(email.sendAdminNewSubmission).toHaveBeenCalledWith(
      expect.objectContaining({ organizerLabel: "Test Organizer" }),
      22
    );
  });

  it("main operation still succeeds and returns the created source even when the email dependency throws", async () => {
    // EmailService.send* never throws in real usage (it catches provider errors
    // internally) — this simulates an unexpected failure in that dependency anyway
    // to prove submitSource's own try/catch guard keeps the business operation safe.
    const result = parsedResult({ sourceUrl: "https://example.com/event" });
    const prisma = {
      event: { findMany: jest.fn().mockResolvedValue([]) },
      eventSource: sourceTable(23),
      organizer: { findUnique: jest.fn().mockResolvedValue({ id: 7, name: "Test Organizer" }) },
    };
    const parser = { parseBatch: jest.fn().mockResolvedValue(result), parseBatchWithLlm: jest.fn() };
    const email = {
      webUrl: "https://manifestacije.hr",
      sendEventSubmitted: jest.fn().mockRejectedValue(new Error("Resend down")),
      sendAdminNewSubmission: jest.fn().mockRejectedValue(new Error("Resend down")),
    };
    const service = new OrganizerService(withTx(prisma) as never, {} as never, parser as never, { findCandidates: jest.fn().mockResolvedValue([]) } as never, email as never, contactsMock() as never, { revalidate: jest.fn().mockResolvedValue(true) } as never);

    const source = await service.submitSource(7, { sourceUrl: "https://example.com/event", rawText: "Opis" }, "organizer@example.hr");

    expect(source).toMatchObject({ id: 23, parseStatus: "parsed", alreadySubmitted: false });
  });

  it("syncs a Resend contact with source=SOURCE_SUBMISSION when the organizer's email is known", async () => {
    const result = parsedResult({ sourceUrl: "https://example.com/event" });
    const organizer = { id: 7, name: "Test Organizer", status: "CLAIMED" };
    const prisma = {
      event: { findMany: jest.fn().mockResolvedValue([]) },
      eventSource: sourceTable(30),
      organizer: { findUnique: jest.fn().mockResolvedValue(organizer) },
    };
    const parser = { parseBatch: jest.fn().mockResolvedValue(result), parseBatchWithLlm: jest.fn() };
    const contacts = contactsMock();
    const service = new OrganizerService(withTx(prisma) as never, {} as never, parser as never, { findCandidates: jest.fn().mockResolvedValue([]) } as never, emailMock() as never, contacts as never, { revalidate: jest.fn().mockResolvedValue(true) } as never);

    await service.submitSource(7, { sourceUrl: "https://example.com/event", rawText: "Opis" }, "organizer@example.hr", 42);

    expect(contacts.syncEventSubmitter).toHaveBeenCalledWith("organizer@example.hr", "SOURCE_SUBMISSION", organizer, 42);
  });

  it("does not sync a Resend contact when no organizer email is known", async () => {
    const result = parsedResult({ sourceUrl: "https://example.com/event" });
    const prisma = {
      event: { findMany: jest.fn().mockResolvedValue([]) },
      eventSource: sourceTable(31),
      organizer: { findUnique: jest.fn().mockResolvedValue({ id: 7, name: "Test Organizer" }) },
    };
    const parser = { parseBatch: jest.fn().mockResolvedValue(result), parseBatchWithLlm: jest.fn() };
    const contacts = contactsMock();
    const service = new OrganizerService(withTx(prisma) as never, {} as never, parser as never, { findCandidates: jest.fn().mockResolvedValue([]) } as never, emailMock() as never, contacts as never, { revalidate: jest.fn().mockResolvedValue(true) } as never);

    await service.submitSource(7, { sourceUrl: "https://example.com/event", rawText: "Opis" });

    expect(contacts.syncEventSubmitter).not.toHaveBeenCalled();
  });
});

describe("OrganizerService createEvent", () => {
  it("syncs a Resend contact with source=EVENT_SUBMISSION after creating the event", async () => {
    const organizer = { id: 7, name: "Test Organizer", status: "CLAIMED" };
    const event = { id: 99, title: "Koncert", slug: "koncert", startsAt: new Date(), cityName: "Osijek" };
    const prisma = { organizer: { findUniqueOrThrow: jest.fn().mockResolvedValue(organizer) } };
    const events = { createFromDto: jest.fn().mockResolvedValue(event) };
    const contacts = contactsMock();
    const service = new OrganizerService(withTx(prisma) as never, events as never, {} as never, { findCandidates: jest.fn().mockResolvedValue([]) } as never, emailMock() as never, contacts as never, { revalidate: jest.fn().mockResolvedValue(true) } as never);

    await service.createEvent(7, {} as never, "organizer@example.hr", 42);

    expect(contacts.syncEventSubmitter).toHaveBeenCalledWith("organizer@example.hr", "EVENT_SUBMISSION", organizer, 42);
  });
});

describe("OrganizerService notification email triggers", () => {
  const event = { id: 51, title: "Novi događaj", slug: "novi-dogadaj", startsAt: new Date("2099-10-10T12:00:00Z"), cityName: "Zagreb" };
  function fixture(status: string) {
    const prisma = { organizer: { findUniqueOrThrow: jest.fn().mockResolvedValue({ id: 7, name: "Udruga", status, email: "scraped@example.test" }) } };
    const email = emailMock(), events = { createFromDto: jest.fn().mockResolvedValue(event) };
    const service = new OrganizerService(withTx(prisma) as never, events as never, {} as never, {} as never, email as never, contactsMock() as never, {} as never);
    return { service, email, events };
  }
  it("sends one trusted publication notice to admin and one confirmation to the authenticated organizer", async () => {
    const { service, email, events } = fixture("TRUSTED");
    await service.createEvent(7, {} as never, "signed-in@example.test", 42);
    expect(events.createFromDto).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ status: "PUBLISHED", createdByUserId: 42 }));
    expect(email.sendAdminAutoPublished).toHaveBeenCalledTimes(1);
    expect(email.sendAdminAutoPublished).toHaveBeenCalledWith(expect.objectContaining({ title: event.title, adminEventUrl: "https://manifestacije.hr/admin/events/51", publicEventUrl: "https://manifestacije.hr/eventi/novi-dogadaj" }), 51);
    expect(email.sendAdminNewSubmission).not.toHaveBeenCalled();
    expect(email.sendEventSubmitted).not.toHaveBeenCalled();
    expect(email.sendEventPublished).toHaveBeenCalledWith("signed-in@example.test", expect.anything(), 51);
  });
  it("preserves the pending-submission email without sending a publication email", async () => {
    const { service, email } = fixture("VERIFIED");
    await service.createEvent(7, {} as never, "signed-in@example.test", 42);
    expect(email.sendAdminNewSubmission).toHaveBeenCalledTimes(1); expect(email.sendAdminAutoPublished).not.toHaveBeenCalled();
    expect(email.sendEventSubmitted).toHaveBeenCalledTimes(1); expect(email.sendEventPublished).not.toHaveBeenCalled();
  });
  it("never emails scraped or unclaimed profile addresses", async () => {
    const { service, email } = fixture("TRUSTED");
    await service.createEvent(7, {} as never, undefined, 42);
    expect(email.sendEventPublished).not.toHaveBeenCalled(); expect(email.sendEventSubmitted).not.toHaveBeenCalled();
    expect(email.sendAdminAutoPublished).toHaveBeenCalledTimes(1);
  });
  it("keeps creation successful if the admin email dependency fails", async () => {
    const { service, email } = fixture("TRUSTED"); email.sendAdminAutoPublished.mockRejectedValue(new Error("Provider unavailable"));
    await expect(service.createEvent(7, {} as never, undefined, 42)).resolves.toEqual(event);
  });
});
