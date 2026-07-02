import { BadRequestException } from "@nestjs/common";
import { OrganizerService } from "../src/organizers/organizer.service";
import { ParsedEventCandidate, ParsedSourceResult } from "../src/ai-parser/ai-event-parser.service";

function candidate(overrides: Partial<ParsedEventCandidate> = {}): ParsedEventCandidate {
  return {
    title: "Facebook koncert",
    description: "Opis",
    startsAt: "2026-07-04T18:00:00.000Z",
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

describe("OrganizerService submitSource", () => {
  it("rejects Facebook URL without screenshot or raw text", async () => {
    const service = new OrganizerService({} as never, {} as never, {} as never);

    await expect(service.submitSource(1, { sourceUrl: "https://facebook.com/events/123" }))
      .rejects.toBeInstanceOf(BadRequestException);
  });

  it("uses LLM parser for Facebook URL with raw text and keeps source in review", async () => {
    const result = parsedResult();
    const prisma = {
      eventSource: { create: jest.fn().mockResolvedValue({ id: 10 }) },
    };
    const parser = {
      parseBatchWithLlm: jest.fn().mockResolvedValue(result),
      parseBatch: jest.fn(),
    };
    const service = new OrganizerService(prisma as never, {} as never, parser as never);

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
      eventSource: { create: jest.fn().mockResolvedValue({ id: 11 }) },
    };
    const parser = {
      parseBatchWithLlm: jest.fn().mockResolvedValue(result),
    };
    const service = new OrganizerService(prisma as never, {} as never, parser as never);

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
      eventSource: { create: jest.fn().mockResolvedValue({ id: 12 }) },
    };
    const parser = {
      parseBatch: jest.fn().mockResolvedValue(result),
      parseBatchWithLlm: jest.fn(),
    };
    const service = new OrganizerService(prisma as never, {} as never, parser as never);

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
});
