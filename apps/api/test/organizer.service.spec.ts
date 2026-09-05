import { BadRequestException } from "@nestjs/common";
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
  };
}

function contactsMock() {
  return {
    syncEventSubmitter: jest.fn().mockResolvedValue(undefined),
  };
}

describe("OrganizerService submitSource", () => {
  it("rejects Facebook URL without screenshot or raw text", async () => {
    const service = new OrganizerService({} as never, {} as never, {} as never, { findCandidates: jest.fn().mockResolvedValue([]) } as never, emailMock() as never, contactsMock() as never, { revalidate: jest.fn().mockResolvedValue(true) } as never);

    await expect(service.submitSource(1, { sourceUrl: "https://facebook.com/events/123" }))
      .rejects.toBeInstanceOf(BadRequestException);
  });

  it("uses LLM parser for Facebook URL with raw text and keeps source in review", async () => {
    const result = parsedResult();
    const prisma = {
      event: { findMany: jest.fn().mockResolvedValue([]) },
      eventSource: { create: jest.fn().mockResolvedValue({ id: 10 }) },
      organizer: { findUnique: jest.fn().mockResolvedValue({ id: 7, name: "Test Organizer" }) },
    };
    const parser = {
      parseBatchWithLlm: jest.fn().mockResolvedValue(result),
      parseBatch: jest.fn(),
    };
    const service = new OrganizerService(prisma as never, {} as never, parser as never, { findCandidates: jest.fn().mockResolvedValue([]) } as never, emailMock() as never, contactsMock() as never, { revalidate: jest.fn().mockResolvedValue(true) } as never);

    await service.submitSource(7, {
      sourceUrl: "https://www.facebook.com/events/123",
      rawText: "Koncert, Osijek, 4.7.2026.",
    });

    expect(parser.parseBatchWithLlm).toHaveBeenCalledWith(expect.objectContaining({
      sourceUrl: "https://www.facebook.com/events/123",
      rawText: "Koncert, Osijek, 4.7.2026.",
    }));
    expect(parser.parseBatch).not.toHaveBeenCalled();
    expect(prisma.eventSource.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        organizerId: 7,
        type: "URL",
        parsedJson: result,
        confidence: 0.8,
        status: "NEEDS_REVIEW",
      }),
    });
  });

  it("stores screenshot evidence URL in parsed JSON when upload exists", async () => {
    const result = parsedResult({ candidates: [{ ...candidate({ confidence: 0.6 }), _status: "pending" }] });
    const prisma = {
      event: { findMany: jest.fn().mockResolvedValue([]) },
      eventSource: { create: jest.fn().mockResolvedValue({ id: 11 }) },
      organizer: { findUnique: jest.fn().mockResolvedValue({ id: 7, name: "Test Organizer" }) },
    };
    const parser = {
      parseBatchWithLlm: jest.fn().mockResolvedValue(result),
    };
    const service = new OrganizerService(prisma as never, {} as never, parser as never, { findCandidates: jest.fn().mockResolvedValue([]) } as never, emailMock() as never, contactsMock() as never, { revalidate: jest.fn().mockResolvedValue(true) } as never);

    await service.submitSource(7, {
      sourceUrl: "https://fb.me/e/abc",
      screenshotBase64: "abc123",
      screenshotMediaType: "image/jpeg",
      sourceImageUrl: "https://cdn.example/poster.jpg",
    });

    expect(parser.parseBatchWithLlm).toHaveBeenCalledWith(expect.objectContaining({
      screenshotBase64: "abc123",
      screenshotMediaType: "image/jpeg",
    }));
    expect(prisma.eventSource.create.mock.calls[0][0].data.parsedJson).toEqual({
      ...result,
      sourceImageUrl: "https://cdn.example/poster.jpg",
    });
  });

  it("keeps non-Facebook submit compatible with rule parser", async () => {
    const result = parsedResult({ sourceUrl: "https://example.com/event" });
    const prisma = {
      event: { findMany: jest.fn().mockResolvedValue([]) },
      eventSource: { create: jest.fn().mockResolvedValue({ id: 12 }) },
      organizer: { findUnique: jest.fn().mockResolvedValue({ id: 7, name: "Test Organizer" }) },
    };
    const parser = {
      parseBatch: jest.fn().mockResolvedValue(result),
      parseBatchWithLlm: jest.fn(),
    };
    const service = new OrganizerService(prisma as never, {} as never, parser as never, { findCandidates: jest.fn().mockResolvedValue([]) } as never, emailMock() as never, contactsMock() as never, { revalidate: jest.fn().mockResolvedValue(true) } as never);

    await service.submitSource(7, { sourceUrl: "https://example.com/event", rawText: "Opis" });

    expect(parser.parseBatch).toHaveBeenCalledWith({
      sourceUrl: "https://example.com/event",
      rawText: "Opis",
    });
    expect(parser.parseBatchWithLlm).not.toHaveBeenCalled();
    expect(prisma.eventSource.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        type: "URL",
        status: "PARSED",
      }),
    });
  });

  it("sends the submitted confirmation to the organizer when their email is known", async () => {
    const result = parsedResult({ sourceUrl: "https://example.com/event" });
    const prisma = {
      event: { findMany: jest.fn().mockResolvedValue([]) },
      eventSource: { create: jest.fn().mockResolvedValue({ id: 20 }) },
      organizer: { findUnique: jest.fn().mockResolvedValue({ id: 7, name: "Test Organizer" }) },
    };
    const parser = { parseBatch: jest.fn().mockResolvedValue(result), parseBatchWithLlm: jest.fn() };
    const email = emailMock();
    const service = new OrganizerService(prisma as never, {} as never, parser as never, { findCandidates: jest.fn().mockResolvedValue([]) } as never, email as never, contactsMock() as never, { revalidate: jest.fn().mockResolvedValue(true) } as never);

    await service.submitSource(7, { sourceUrl: "https://example.com/event", rawText: "Opis" }, "organizer@example.hr");

    expect(email.sendEventSubmitted).toHaveBeenCalledWith("organizer@example.hr", expect.objectContaining({ eventTitle: expect.any(String) }));
  });

  it("does not send a submitted confirmation when no organizer email is known", async () => {
    const result = parsedResult({ sourceUrl: "https://example.com/event" });
    const prisma = {
      event: { findMany: jest.fn().mockResolvedValue([]) },
      eventSource: { create: jest.fn().mockResolvedValue({ id: 21 }) },
      organizer: { findUnique: jest.fn().mockResolvedValue({ id: 7, name: "Test Organizer" }) },
    };
    const parser = { parseBatch: jest.fn().mockResolvedValue(result), parseBatchWithLlm: jest.fn() };
    const email = emailMock();
    const service = new OrganizerService(prisma as never, {} as never, parser as never, { findCandidates: jest.fn().mockResolvedValue([]) } as never, email as never, contactsMock() as never, { revalidate: jest.fn().mockResolvedValue(true) } as never);

    await service.submitSource(7, { sourceUrl: "https://example.com/event", rawText: "Opis" });

    expect(email.sendEventSubmitted).not.toHaveBeenCalled();
  });

  it("always notifies the admin of a new submission regardless of organizer email", async () => {
    const result = parsedResult({ sourceUrl: "https://example.com/event" });
    const prisma = {
      event: { findMany: jest.fn().mockResolvedValue([]) },
      eventSource: { create: jest.fn().mockResolvedValue({ id: 22 }) },
      organizer: { findUnique: jest.fn().mockResolvedValue({ id: 7, name: "Test Organizer" }) },
    };
    const parser = { parseBatch: jest.fn().mockResolvedValue(result), parseBatchWithLlm: jest.fn() };
    const email = emailMock();
    const service = new OrganizerService(prisma as never, {} as never, parser as never, { findCandidates: jest.fn().mockResolvedValue([]) } as never, email as never, contactsMock() as never, { revalidate: jest.fn().mockResolvedValue(true) } as never);

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
      eventSource: { create: jest.fn().mockResolvedValue({ id: 23 }) },
      organizer: { findUnique: jest.fn().mockResolvedValue({ id: 7, name: "Test Organizer" }) },
    };
    const parser = { parseBatch: jest.fn().mockResolvedValue(result), parseBatchWithLlm: jest.fn() };
    const email = {
      webUrl: "https://manifestacije.hr",
      sendEventSubmitted: jest.fn().mockRejectedValue(new Error("Resend down")),
      sendAdminNewSubmission: jest.fn().mockRejectedValue(new Error("Resend down")),
    };
    const service = new OrganizerService(prisma as never, {} as never, parser as never, { findCandidates: jest.fn().mockResolvedValue([]) } as never, email as never, contactsMock() as never, { revalidate: jest.fn().mockResolvedValue(true) } as never);

    const source = await service.submitSource(7, { sourceUrl: "https://example.com/event", rawText: "Opis" }, "organizer@example.hr");

    expect(source).toEqual({ id: 23 });
  });

  it("syncs a Resend contact with source=SOURCE_SUBMISSION when the organizer's email is known", async () => {
    const result = parsedResult({ sourceUrl: "https://example.com/event" });
    const organizer = { id: 7, name: "Test Organizer", status: "CLAIMED" };
    const prisma = {
      event: { findMany: jest.fn().mockResolvedValue([]) },
      eventSource: { create: jest.fn().mockResolvedValue({ id: 30 }) },
      organizer: { findUnique: jest.fn().mockResolvedValue(organizer) },
    };
    const parser = { parseBatch: jest.fn().mockResolvedValue(result), parseBatchWithLlm: jest.fn() };
    const contacts = contactsMock();
    const service = new OrganizerService(prisma as never, {} as never, parser as never, { findCandidates: jest.fn().mockResolvedValue([]) } as never, emailMock() as never, contacts as never, { revalidate: jest.fn().mockResolvedValue(true) } as never);

    await service.submitSource(7, { sourceUrl: "https://example.com/event", rawText: "Opis" }, "organizer@example.hr", 42);

    expect(contacts.syncEventSubmitter).toHaveBeenCalledWith("organizer@example.hr", "SOURCE_SUBMISSION", organizer, 42);
  });

  it("does not sync a Resend contact when no organizer email is known", async () => {
    const result = parsedResult({ sourceUrl: "https://example.com/event" });
    const prisma = {
      event: { findMany: jest.fn().mockResolvedValue([]) },
      eventSource: { create: jest.fn().mockResolvedValue({ id: 31 }) },
      organizer: { findUnique: jest.fn().mockResolvedValue({ id: 7, name: "Test Organizer" }) },
    };
    const parser = { parseBatch: jest.fn().mockResolvedValue(result), parseBatchWithLlm: jest.fn() };
    const contacts = contactsMock();
    const service = new OrganizerService(prisma as never, {} as never, parser as never, { findCandidates: jest.fn().mockResolvedValue([]) } as never, emailMock() as never, contacts as never, { revalidate: jest.fn().mockResolvedValue(true) } as never);

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
    const service = new OrganizerService(prisma as never, events as never, {} as never, { findCandidates: jest.fn().mockResolvedValue([]) } as never, emailMock() as never, contacts as never, { revalidate: jest.fn().mockResolvedValue(true) } as never);

    await service.createEvent(7, {} as never, "organizer@example.hr", 42);

    expect(contacts.syncEventSubmitter).toHaveBeenCalledWith("organizer@example.hr", "EVENT_SUBMISSION", organizer, 42);
  });
});
