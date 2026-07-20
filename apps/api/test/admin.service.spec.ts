import { EventStatus } from "@prisma/client";
import { AdminService } from "../src/admin/admin.service";
import { ParsedEventCandidate, ParsedSourceResult } from "../src/ai-parser/ai-event-parser.service";

function candidate(overrides: Partial<ParsedEventCandidate> = {}): ParsedEventCandidate {
  return {
    title: "Ljetni koncert",
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
    sourceUrl: "https://source.example/event",
    organizerName: "TZ Osijek",
    imageUrl: "https://source.example/image.jpg",
    imageCredit: "Organizator",
    imageSourceUrl: "https://source.example/event",
    confidence: 0.82,
    missingFields: [],
    warnings: [],
    ...overrides,
  };
}

function parsedResult(candidates: ParsedEventCandidate[]): ParsedSourceResult {
  return { sourceUrl: "https://source.example", sourceType: "batch", candidates: candidates.map((c) => ({ ...c, _status: "pending" })) };
}

describe("AdminService ingestion workflow", () => {
  it("stores parsed JSON, confidence and status for manual email sources", async () => {
    const result = parsedResult([candidate({ confidence: 0.8 }), candidate({ confidence: 0.6, missingFields: ["startsAt"] })]);
    const prisma = {
      eventSource: { create: jest.fn().mockResolvedValue({ id: 1 }) },
    };
    const parser = { parseBatch: jest.fn().mockResolvedValue(result) };
    const service = new AdminService(prisma as never, {} as never, parser as never, {} as never, {} as never, {} as never);

    await service.createManualEmail({ rawText: "raw", sourceUrl: "https://source.example", rawEmailSubject: "Subject", rawEmailFrom: "from@example.hr" });

    expect(prisma.eventSource.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        rawText: "raw",
        parsedJson: result,
        confidence: 0.7,
        status: "NEEDS_REVIEW",
      }),
    });
  });

  it("adds fetch warning when URL fetch fails", async () => {
    const result = parsedResult([candidate()]);
    const prisma = {
      eventSource: { create: jest.fn().mockResolvedValue({ id: 1 }) },
    };
    const parser = { parseBatch: jest.fn().mockResolvedValue(result) };
    const service = new AdminService(prisma as never, {} as never, parser as never, {} as never, {} as never, {} as never);
    jest.spyOn(global, "fetch").mockRejectedValueOnce(new Error("network down"));

    await service.parseUrl({ sourceUrl: "https://source.example/event" });

    const parsedJson = prisma.eventSource.create.mock.calls[0][0].data.parsedJson as ParsedSourceResult;
    expect(parsedJson.candidates[0].warnings[0]).toContain("Failed to fetch URL");
  });

  it("creates event with fallbacks when candidate fields are missing", async () => {
    const sourceParsed = parsedResult([candidate({ startsAt: "", city: "", organizerName: "" })]);
    const prisma = {
      eventSource: {
        findUnique: jest.fn().mockResolvedValue({ id: 1, parsedJson: sourceParsed, sourceUrl: "https://source.example", organizerId: null }),
        update: jest.fn().mockResolvedValue({ id: 1 }),
      },
      category: { findFirst: jest.fn().mockResolvedValue({ id: 22 }) },
    };
    const events = { createFromDto: jest.fn().mockResolvedValue({ id: 44 }) };
    const service = new AdminService(prisma as never, events as never, {} as never, {} as never, {} as never, {} as never);

    await service.createEventFromSource(1, 0);

    expect(events.createFromDto).toHaveBeenCalledWith(expect.objectContaining({
      cityId: undefined,
      categoryId: 22,
      startsAt: undefined,
    }), expect.any(Object));
  });

  it("creates event from candidate with taxonomy, organizer and image fields, then marks candidate created", async () => {
    const sourceParsed = parsedResult([candidate({ missingFields: ["startsAt"], warnings: ["Original warning"] })]);
    const prisma = {
      eventSource: {
        findUnique: jest.fn().mockResolvedValue({ id: 1, parsedJson: sourceParsed, sourceUrl: "https://source.example", organizerId: null }),
        update: jest.fn().mockResolvedValue({ id: 1 }),
      },
      city: { findFirst: jest.fn().mockResolvedValue({ id: 11 }) },
      category: { findFirst: jest.fn().mockResolvedValue({ id: 22 }) },
      organizer: {
        findFirst: jest.fn().mockResolvedValue({ id: 33 }),
      },
    };
    const events = { createFromDto: jest.fn().mockResolvedValue({ id: 44 }) };
    const service = new AdminService(prisma as never, events as never, {} as never, {} as never, {} as never, {} as never);

    const created = await service.createEventFromSource(1, 0, { startsAt: "2026-07-05T19:00:00.000Z" });

    expect(created).toEqual({ event: { id: 44 }, candidateIndex: 0 });
    expect(events.createFromDto).toHaveBeenCalledWith(expect.objectContaining({
      cityId: 11,
      categoryId: 22,
      startsAt: "2026-07-05T19:00:00.000Z",
      imageUrl: "https://source.example/image.jpg",
    }), expect.objectContaining({ organizerId: 33, status: EventStatus.PENDING_REVIEW, sourceType: "URL_SUBMISSION" }));
    const updatedParsed = prisma.eventSource.update.mock.calls[0][0].data.parsedJson as ParsedSourceResult;
    expect(updatedParsed.candidates[0]._status).toBe("created");
    expect(updatedParsed.candidates[0]._eventId).toBe(44);
    expect(updatedParsed.candidates[0].category).toBe("glazba");
    expect(updatedParsed.candidates[0].missingFields).toEqual(["startsAt"]);
    expect(updatedParsed.candidates[0].warnings).toEqual(["Original warning"]);
  });

  it("passes edited categoryIds from candidate overrides into event creation", async () => {
    const sourceParsed = parsedResult([candidate({ category: "glazba" })]);
    const prisma = {
      eventSource: {
        findUnique: jest.fn().mockResolvedValue({ id: 1, parsedJson: sourceParsed, sourceUrl: "https://source.example", organizerId: null }),
        update: jest.fn().mockResolvedValue({ id: 1 }),
      },
      city: { findFirst: jest.fn().mockResolvedValue({ id: 11 }) },
      category: { findUnique: jest.fn().mockResolvedValue({ id: 44 }) },
      organizer: { findFirst: jest.fn().mockResolvedValue({ id: 33 }) },
    };
    const events = { createFromDto: jest.fn().mockResolvedValue({ id: 55 }) };
    const service = new AdminService(prisma as never, events as never, {} as never, {} as never, {} as never, {} as never);

    await service.createEventFromSource(1, 0, { categoryIds: [44, 45] });

    expect(events.createFromDto).toHaveBeenCalledWith(expect.objectContaining({
      categoryId: 44,
      categoryIds: [44, 45],
    }), expect.any(Object));
    const updatedParsed = prisma.eventSource.update.mock.calls[0][0].data.parsedJson as ParsedSourceResult;
    expect(updatedParsed.candidates[0].category).toBe("glazba");
  });

  it("ignores a candidate while preserving missingFields and warnings", async () => {
    const sourceParsed = parsedResult([candidate({ missingFields: ["city"], warnings: ["Needs city"] })]);
    const prisma = {
      eventSource: {
        findUnique: jest.fn().mockResolvedValue({ id: 1, parsedJson: sourceParsed }),
        update: jest.fn().mockResolvedValue({ id: 1 }),
      },
    };
    const service = new AdminService(prisma as never, {} as never, {} as never, {} as never, {} as never, {} as never);

    await service.ignoreCandidate(1, 0);

    const updatedParsed = prisma.eventSource.update.mock.calls[0][0].data.parsedJson as ParsedSourceResult;
    expect(updatedParsed.candidates[0]._status).toBe("ignored");
    expect(updatedParsed.candidates[0].missingFields).toEqual(["city"]);
    expect(updatedParsed.candidates[0].warnings).toEqual(["Needs city"]);
  });

  it("deletes event by unlinking sources and removing duplicate candidates first", async () => {
    const tx = {
      eventSource: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      eventDuplicateCandidate: { deleteMany: jest.fn().mockResolvedValue({ count: 2 }) },
      event: { delete: jest.fn().mockResolvedValue({ id: 9 }) },
    };
    const prisma = {
      $transaction: jest.fn((callback) => callback(tx)),
    };
    const revalidate = { revalidate: jest.fn() };
    const service = new AdminService(prisma as never, {} as never, {} as never, {} as never, revalidate as never, {} as never);

    await service.deleteEvent(9);

    expect(tx.eventSource.updateMany).toHaveBeenCalledWith({ where: { eventId: 9 }, data: { eventId: null } });
    expect(tx.eventDuplicateCandidate.deleteMany).toHaveBeenCalledWith({ where: { OR: [{ eventAId: 9 }, { eventBId: 9 }] } });
    expect(tx.event.delete).toHaveBeenCalledWith({ where: { id: 9 } });
  });

  it("duplicates an event as draft and copies category joins", async () => {
    const current = {
      id: 9,
      title: "Original",
      description: "Opis",
      shortDescription: "Kratko",
      organizerId: 1,
      venueId: 2,
      cityId: 3,
      countyId: 4,
      regionId: 5,
      categoryId: 6,
      startsAt: new Date("2026-07-04T18:00:00.000Z"),
      endsAt: null,
      isAllDay: false,
      isFree: true,
      priceText: null,
      ticketUrl: null,
      sourceUrl: "https://source.example",
      imageUrl: null,
      imageCredit: null,
      imageSourceUrl: null,
      address: null,
      lat: null,
      lng: null,
      sourceType: "MANUAL",
      extractionConfidence: null,
      categories: [{ categoryId: 6, source: "MANUAL", confidence: null }],
    };
    const prisma = {
      event: {
        findUnique: jest.fn()
          .mockResolvedValueOnce(current)
          .mockResolvedValueOnce(null),
        create: jest.fn().mockResolvedValue({ id: 10, title: "Original (kopija)" }),
      },
      eventCategory: { create: jest.fn() },
    };
    const service = new AdminService(prisma as never, {} as never, {} as never, {} as never, {} as never, {} as never);

    await service.duplicateEvent(9);

    expect(prisma.event.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        title: "Original (kopija)",
        status: "DRAFT",
        sourceUrl: "https://source.example",
      }),
    }));
    expect(prisma.eventCategory.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ eventId: 10, categoryId: 6, source: "MANUAL" }),
    });
  });
});

describe("AdminService.setEventStatus organizer notifications", () => {
  function makePrisma(overrides: {
    currentStatus: EventStatus;
    event?: Record<string, unknown>;
  }) {
    const event = overrides.event ?? {
      id: 5,
      title: "Ljetni koncert",
      slug: "ljetni-koncert",
      startsAt: new Date("2026-07-04T18:00:00.000Z"),
      cityName: "Osijek",
      organizer: { email: "organizer@example.hr" },
    };
    return {
      event: {
        findUnique: jest.fn()
          .mockResolvedValueOnce({ status: overrides.currentStatus })
          .mockResolvedValueOnce(event),
        update: jest.fn().mockResolvedValue({ id: event.id, organizerId: 1 }),
      },
    };
  }

  function makeEmail() {
    return { webUrl: "https://manifestacije.hr", sendEventPublished: jest.fn(), sendEventRejected: jest.fn() };
  }

  it("sends the published email when status actually transitions to PUBLISHED", async () => {
    const prisma = makePrisma({ currentStatus: EventStatus.PENDING_REVIEW });
    const revalidate = { revalidate: jest.fn() };
    const email = makeEmail();
    const service = new AdminService(prisma as never, {} as never, {} as never, {} as never, revalidate as never, email as never);

    await service.setEventStatus(5, EventStatus.PUBLISHED);

    expect(email.sendEventPublished).toHaveBeenCalledTimes(1);
    expect(email.sendEventPublished).toHaveBeenCalledWith(
      "organizer@example.hr",
      expect.objectContaining({ eventTitle: "Ljetni koncert", publicEventUrl: "https://manifestacije.hr/eventi/ljetni-koncert" }),
      5
    );
  });

  it("does not send a duplicate published email when the event is already PUBLISHED", async () => {
    const prisma = makePrisma({ currentStatus: EventStatus.PUBLISHED });
    const revalidate = { revalidate: jest.fn() };
    const email = makeEmail();
    const service = new AdminService(prisma as never, {} as never, {} as never, {} as never, revalidate as never, email as never);

    await service.setEventStatus(5, EventStatus.PUBLISHED);

    expect(email.sendEventPublished).not.toHaveBeenCalled();
  });

  it("sends the rejected email when status actually transitions to REJECTED", async () => {
    const prisma = makePrisma({ currentStatus: EventStatus.PENDING_REVIEW });
    const revalidate = { revalidate: jest.fn() };
    const email = makeEmail();
    const service = new AdminService(prisma as never, {} as never, {} as never, {} as never, revalidate as never, email as never);

    await service.setEventStatus(5, EventStatus.REJECTED);

    expect(email.sendEventRejected).toHaveBeenCalledTimes(1);
    expect(email.sendEventRejected).toHaveBeenCalledWith("organizer@example.hr", expect.objectContaining({ eventTitle: "Ljetni koncert" }), 5);
  });

  it("does not send a duplicate rejected email when the event is already REJECTED", async () => {
    const prisma = makePrisma({ currentStatus: EventStatus.REJECTED });
    const revalidate = { revalidate: jest.fn() };
    const email = makeEmail();
    const service = new AdminService(prisma as never, {} as never, {} as never, {} as never, revalidate as never, email as never);

    await service.setEventStatus(5, EventStatus.REJECTED);

    expect(email.sendEventRejected).not.toHaveBeenCalled();
  });

  it("does not send any email when the event has no organizer email on file", async () => {
    const prisma = makePrisma({
      currentStatus: EventStatus.PENDING_REVIEW,
      event: {
        id: 5,
        title: "Ljetni koncert",
        slug: "ljetni-koncert",
        startsAt: new Date("2026-07-04T18:00:00.000Z"),
        cityName: "Osijek",
        organizer: null,
      },
    });
    const revalidate = { revalidate: jest.fn() };
    const email = makeEmail();
    const service = new AdminService(prisma as never, {} as never, {} as never, {} as never, revalidate as never, email as never);

    await service.setEventStatus(5, EventStatus.PUBLISHED);

    expect(email.sendEventPublished).not.toHaveBeenCalled();
  });

  it("does not send a notification for statuses other than PUBLISHED/REJECTED (e.g. ARCHIVED)", async () => {
    const prisma = makePrisma({ currentStatus: EventStatus.PUBLISHED });
    const revalidate = { revalidate: jest.fn() };
    const email = makeEmail();
    const service = new AdminService(prisma as never, {} as never, {} as never, {} as never, revalidate as never, email as never);

    await service.setEventStatus(5, EventStatus.ARCHIVED);

    expect(email.sendEventPublished).not.toHaveBeenCalled();
    expect(email.sendEventRejected).not.toHaveBeenCalled();
  });

  it("main operation still succeeds and returns the updated event when the email provider throws", async () => {
    const prisma = makePrisma({ currentStatus: EventStatus.PENDING_REVIEW });
    const revalidate = { revalidate: jest.fn() };
    const email = { webUrl: "https://manifestacije.hr", sendEventPublished: jest.fn().mockRejectedValue(new Error("Resend down")), sendEventRejected: jest.fn() };
    const service = new AdminService(prisma as never, {} as never, {} as never, {} as never, revalidate as never, email as never);

    const result = await service.setEventStatus(5, EventStatus.PUBLISHED);

    expect(result).toEqual({ id: 5, organizerId: 1 });
  });
});
