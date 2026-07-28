import { EventStatus } from "@prisma/client";
import { AdminService } from "../src/admin/admin.service";
import { ParsedEventCandidate, ParsedSourceResult } from "../src/ai-parser/ai-event-parser.service";

// Image re-hosting is a network side effect these tests do not exercise;
// returning null makes AdminService keep the original image URL.
const uploadsStub = { uploadEventImageFromUrl: async () => null };

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
  it("orders the full admin events query by startsAt before limiting results", async () => {
    const prisma = {
      event: { findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0) },
      // Listing runs the page query and its count in one transaction; the
      // stub just resolves whatever the two calls already returned.
      $transaction: jest.fn().mockImplementation((ops: unknown[]) => Promise.all(ops)),
    };
    const service = new AdminService(prisma as never, {} as never, {} as never, {} as never, {} as never, {} as never, uploadsStub as never);

    await service.allEvents({ sortBy: "startsAt", sortDir: "desc" });

    expect(prisma.event.findMany).toHaveBeenCalledWith(expect.objectContaining({
      orderBy: [{ startsAt: "desc" }, { id: "asc" }],
      // Listing is paginated, so the limit is the default page size.
      take: 25,
      skip: 0,
    }));
  });

  it("orders pending events by startsAt by default", async () => {
    const prisma = {
      event: { findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0) },
      // Listing runs the page query and its count in one transaction; the
      // stub just resolves whatever the two calls already returned.
      $transaction: jest.fn().mockImplementation((ops: unknown[]) => Promise.all(ops)),
    };
    const service = new AdminService(prisma as never, {} as never, {} as never, {} as never, {} as never, {} as never, uploadsStub as never);

    await service.pendingEvents();

    expect(prisma.event.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { status: EventStatus.PENDING_REVIEW },
      orderBy: [{ startsAt: "asc" }, { id: "asc" }],
    }));
  });

  it("stores parsed JSON, confidence and status for manual email sources", async () => {
    const result = parsedResult([candidate({ confidence: 0.8 }), candidate({ confidence: 0.6, missingFields: ["startsAt"] })]);
    const prisma = {
      eventSource: { create: jest.fn().mockResolvedValue({ id: 1 }) },
    };
    const parser = { parseBatch: jest.fn().mockResolvedValue(result) };
    const service = new AdminService(prisma as never, {} as never, parser as never, {} as never, {} as never, {} as never, uploadsStub as never);

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
    const service = new AdminService(prisma as never, {} as never, parser as never, {} as never, {} as never, {} as never, uploadsStub as never);
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
    const service = new AdminService(prisma as never, events as never, {} as never, {} as never, {} as never, {} as never, uploadsStub as never);

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
      city: { findFirst: jest.fn().mockResolvedValue({ id: 11, county: { region: { slug: "slavonija-i-baranja" } } }) },
      category: { findFirst: jest.fn().mockResolvedValue({ id: 22 }) },
      organizer: {
        findMany: jest.fn().mockResolvedValue([{ id: 33, name: "TZ Osijek" }]),
      },
    };
    const events = { createFromDto: jest.fn().mockResolvedValue({ id: 44 }) };
    const service = new AdminService(prisma as never, events as never, {} as never, {} as never, {} as never, {} as never, uploadsStub as never);

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

  it("does not create a canonical unknown region from parser region text", async () => {
    const sourceParsed = parsedResult([candidate({ city: "Belišće", region: "Nepoznata regija" })]);
    const prisma = {
      eventSource: {
        findUnique: jest.fn().mockResolvedValue({ id: 1, parsedJson: sourceParsed, sourceUrl: "https://source.example", organizerId: null }),
        update: jest.fn().mockResolvedValue({ id: 1 }),
      },
      city: {
        findFirst: jest.fn().mockResolvedValue(null),
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 7 }),
      },
      region: {
        upsert: jest.fn().mockResolvedValue({ id: 3 }),
      },
      county: {
        upsert: jest.fn().mockResolvedValue({ id: 2 }),
      },
      category: { findFirst: jest.fn().mockResolvedValue({ id: 22 }) },
      organizer: { findMany: jest.fn().mockResolvedValue([{ id: 33, name: "TZ Osijek" }]) },
    };
    jest.spyOn(global, "fetch").mockRejectedValueOnce(new Error("offline"));
    const events = { createFromDto: jest.fn().mockResolvedValue({ id: 44 }) };
    const service = new AdminService(prisma as never, events as never, {} as never, {} as never, {} as never, {} as never, uploadsStub as never);

    await service.createEventFromSource(1, 0);

    expect(prisma.region.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { slug: "slavonija-i-baranja" },
    }));
    expect(prisma.region.upsert).not.toHaveBeenCalledWith(expect.objectContaining({
      where: { slug: "nepoznata-regija" },
    }));
    jest.restoreAllMocks();
  });

  it("passes edited categoryIds from candidate overrides into event creation", async () => {
    const sourceParsed = parsedResult([candidate({ category: "glazba" })]);
    const prisma = {
      eventSource: {
        findUnique: jest.fn().mockResolvedValue({ id: 1, parsedJson: sourceParsed, sourceUrl: "https://source.example", organizerId: null }),
        update: jest.fn().mockResolvedValue({ id: 1 }),
      },
      city: { findFirst: jest.fn().mockResolvedValue({ id: 11, county: { region: { slug: "slavonija-i-baranja" } } }) },
      category: { findUnique: jest.fn().mockResolvedValue({ id: 44 }) },
      organizer: { findMany: jest.fn().mockResolvedValue([{ id: 33, name: "TZ Osijek" }]) },
    };
    const events = { createFromDto: jest.fn().mockResolvedValue({ id: 55 }) };
    const service = new AdminService(prisma as never, events as never, {} as never, {} as never, {} as never, {} as never, uploadsStub as never);

    await service.createEventFromSource(1, 0, { categoryIds: [44, 45] });

    expect(events.createFromDto).toHaveBeenCalledWith(expect.objectContaining({
      categoryId: 44,
      categoryIds: [44, 45],
    }), expect.any(Object));
    const updatedParsed = prisma.eventSource.update.mock.calls[0][0].data.parsedJson as ParsedSourceResult;
    expect(updatedParsed.candidates[0].category).toBe("glazba");
  });

  it("passes isAllDay from candidate overrides into event creation", async () => {
    const sourceParsed = parsedResult([candidate()]);
    const prisma = {
      eventSource: {
        findUnique: jest.fn().mockResolvedValue({ id: 1, parsedJson: sourceParsed, sourceUrl: "https://source.example", organizerId: null }),
        update: jest.fn().mockResolvedValue({ id: 1 }),
      },
      city: { findFirst: jest.fn().mockResolvedValue({ id: 11, county: { region: { slug: "slavonija-i-baranja" } } }) },
      category: { findFirst: jest.fn().mockResolvedValue({ id: 22 }) },
      organizer: { findMany: jest.fn().mockResolvedValue([{ id: 33, name: "TZ Osijek" }]) },
    };
    const events = { createFromDto: jest.fn().mockResolvedValue({ id: 44 }) };
    const service = new AdminService(prisma as never, events as never, {} as never, {} as never, {} as never, {} as never, uploadsStub as never);

    await service.createEventFromSource(1, 0, { isAllDay: true });

    expect(events.createFromDto).toHaveBeenCalledWith(expect.objectContaining({ isAllDay: true }), expect.any(Object));
  });

  it("falls back to the source's own URL when the candidate override doesn't touch sourceUrl", async () => {
    const sourceParsed = parsedResult([candidate({ sourceUrl: "" })]);
    const prisma = {
      eventSource: {
        findUnique: jest.fn().mockResolvedValue({ id: 1, parsedJson: sourceParsed, sourceUrl: "https://source.example/original", organizerId: null }),
        update: jest.fn().mockResolvedValue({ id: 1 }),
      },
      city: { findFirst: jest.fn().mockResolvedValue({ id: 11, county: { region: { slug: "slavonija-i-baranja" } } }) },
      category: { findFirst: jest.fn().mockResolvedValue({ id: 22 }) },
      organizer: { findMany: jest.fn().mockResolvedValue([{ id: 33, name: "TZ Osijek" }]) },
    };
    const events = { createFromDto: jest.fn().mockResolvedValue({ id: 44 }) };
    const service = new AdminService(prisma as never, events as never, {} as never, {} as never, {} as never, {} as never, uploadsStub as never);

    await service.createEventFromSource(1, 0);

    expect(events.createFromDto).toHaveBeenCalledWith(expect.objectContaining({ sourceUrl: "https://source.example/original" }), expect.any(Object));
  });

  it("does not fall back to the source's own URL when the admin explicitly clears sourceUrl", async () => {
    const sourceParsed = parsedResult([candidate()]);
    const prisma = {
      eventSource: {
        findUnique: jest.fn().mockResolvedValue({ id: 1, parsedJson: sourceParsed, sourceUrl: "https://source.example/original", organizerId: null }),
        update: jest.fn().mockResolvedValue({ id: 1 }),
      },
      city: { findFirst: jest.fn().mockResolvedValue({ id: 11, county: { region: { slug: "slavonija-i-baranja" } } }) },
      category: { findFirst: jest.fn().mockResolvedValue({ id: 22 }) },
      organizer: { findMany: jest.fn().mockResolvedValue([{ id: 33, name: "TZ Osijek" }]) },
    };
    const events = { createFromDto: jest.fn().mockResolvedValue({ id: 44 }) };
    const service = new AdminService(prisma as never, events as never, {} as never, {} as never, {} as never, {} as never, uploadsStub as never);

    await service.createEventFromSource(1, 0, { sourceUrl: null });

    expect(events.createFromDto).toHaveBeenCalledWith(expect.objectContaining({ sourceUrl: undefined }), expect.any(Object));
  });

  it("ignores a candidate while preserving missingFields and warnings", async () => {
    const sourceParsed = parsedResult([candidate({ missingFields: ["city"], warnings: ["Needs city"] })]);
    const prisma = {
      eventSource: {
        findUnique: jest.fn().mockResolvedValue({ id: 1, parsedJson: sourceParsed }),
        update: jest.fn().mockResolvedValue({ id: 1 }),
      },
    };
    const service = new AdminService(prisma as never, {} as never, {} as never, {} as never, {} as never, {} as never, uploadsStub as never);

    await service.ignoreCandidate(1, 0);

    const updatedParsed = prisma.eventSource.update.mock.calls[0][0].data.parsedJson as ParsedSourceResult;
    expect(updatedParsed.candidates[0]._status).toBe("ignored");
    expect(updatedParsed.candidates[0].missingFields).toEqual(["city"]);
    expect(updatedParsed.candidates[0].warnings).toEqual(["Needs city"]);
  });

  it("deletes an organizer's linked User accounts too, so the email can register again", async () => {
    const prisma = {
      event: { count: jest.fn().mockResolvedValue(0) },
      user: { deleteMany: jest.fn().mockResolvedValue({ count: 1 }) },
      organizer: { delete: jest.fn().mockResolvedValue({ id: 7 }) },
      $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
    };
    const service = new AdminService(prisma as never, {} as never, {} as never, {} as never, {} as never, {} as never, uploadsStub as never);

    const result = await service.deleteOrganizer(7);

    expect(result).toEqual({ id: 7 });
    expect(prisma.user.deleteMany).toHaveBeenCalledWith({ where: { organizerId: 7 } });
    expect(prisma.organizer.delete).toHaveBeenCalledWith({ where: { id: 7 } });
  });

  it("refuses to delete an organizer that still has events", async () => {
    const prisma = {
      event: { count: jest.fn().mockResolvedValue(3) },
      organizer: { delete: jest.fn() },
      $transaction: jest.fn(),
    };
    const service = new AdminService(prisma as never, {} as never, {} as never, {} as never, {} as never, {} as never, uploadsStub as never);

    await expect(service.deleteOrganizer(7)).rejects.toThrow(/3 događaja/);
    expect(prisma.organizer.delete).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
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
    const service = new AdminService(prisma as never, {} as never, {} as never, {} as never, revalidate as never, {} as never, uploadsStub as never);

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
    const service = new AdminService(prisma as never, {} as never, {} as never, {} as never, {} as never, {} as never, uploadsStub as never);

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
    const service = new AdminService(prisma as never, {} as never, {} as never, {} as never, revalidate as never, email as never, uploadsStub as never);

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
    const service = new AdminService(prisma as never, {} as never, {} as never, {} as never, revalidate as never, email as never, uploadsStub as never);

    await service.setEventStatus(5, EventStatus.PUBLISHED);

    expect(email.sendEventPublished).not.toHaveBeenCalled();
  });

  it("sends the rejected email when status actually transitions to REJECTED", async () => {
    const prisma = makePrisma({ currentStatus: EventStatus.PENDING_REVIEW });
    const revalidate = { revalidate: jest.fn() };
    const email = makeEmail();
    const service = new AdminService(prisma as never, {} as never, {} as never, {} as never, revalidate as never, email as never, uploadsStub as never);

    await service.setEventStatus(5, EventStatus.REJECTED);

    expect(email.sendEventRejected).toHaveBeenCalledTimes(1);
    expect(email.sendEventRejected).toHaveBeenCalledWith("organizer@example.hr", expect.objectContaining({ eventTitle: "Ljetni koncert" }), 5);
  });

  it("does not send a duplicate rejected email when the event is already REJECTED", async () => {
    const prisma = makePrisma({ currentStatus: EventStatus.REJECTED });
    const revalidate = { revalidate: jest.fn() };
    const email = makeEmail();
    const service = new AdminService(prisma as never, {} as never, {} as never, {} as never, revalidate as never, email as never, uploadsStub as never);

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
    const service = new AdminService(prisma as never, {} as never, {} as never, {} as never, revalidate as never, email as never, uploadsStub as never);

    await service.setEventStatus(5, EventStatus.PUBLISHED);

    expect(email.sendEventPublished).not.toHaveBeenCalled();
  });

  it("does not send a notification for statuses other than PUBLISHED/REJECTED (e.g. ARCHIVED)", async () => {
    const prisma = makePrisma({ currentStatus: EventStatus.PUBLISHED });
    const revalidate = { revalidate: jest.fn() };
    const email = makeEmail();
    const service = new AdminService(prisma as never, {} as never, {} as never, {} as never, revalidate as never, email as never, uploadsStub as never);

    await service.setEventStatus(5, EventStatus.ARCHIVED);

    expect(email.sendEventPublished).not.toHaveBeenCalled();
    expect(email.sendEventRejected).not.toHaveBeenCalled();
  });

  it("main operation still succeeds and returns the updated event when the email provider throws", async () => {
    const prisma = makePrisma({ currentStatus: EventStatus.PENDING_REVIEW });
    const revalidate = { revalidate: jest.fn() };
    const email = { webUrl: "https://manifestacije.hr", sendEventPublished: jest.fn().mockRejectedValue(new Error("Resend down")), sendEventRejected: jest.fn() };
    const service = new AdminService(prisma as never, {} as never, {} as never, {} as never, revalidate as never, email as never, uploadsStub as never);

    const result = await service.setEventStatus(5, EventStatus.PUBLISHED);

    expect(result).toEqual({ id: 5, organizerId: 1 });
  });
});

describe("AdminService.organizers", () => {
  it("maps _count.users to a hasUser flag instead of exposing status as the claimed signal", async () => {
    const prisma = {
      organizer: {
        findMany: jest.fn().mockResolvedValue([
          { id: 1, name: "Claimed via user", status: "UNCLAIMED", adminViewedAt: null, _count: { users: 1 } },
          { id: 2, name: "Verified but never registered", status: "VERIFIED", adminViewedAt: new Date("2026-07-21T10:00:00Z"), _count: { users: 0 } },
        ]),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    const service = new AdminService(prisma as never, {} as never, {} as never, {} as never, {} as never, {} as never, uploadsStub as never);

    const result = await service.organizers();

    expect(result).toEqual([
      { id: 1, name: "Claimed via user", status: "UNCLAIMED", adminViewedAt: null, hasUser: true },
      { id: 2, name: "Verified but never registered", status: "VERIFIED", adminViewedAt: new Date("2026-07-21T10:00:00Z"), hasUser: false },
    ]);
    expect(prisma.organizer.updateMany).toHaveBeenCalledWith({
      where: { id: { in: [1] } },
      data: { adminViewedAt: expect.any(Date) },
    });
  });
});

describe("AdminService.users", () => {
  it("lists users including organizer attachment, without exposing passwordHash", async () => {
    const prisma = {
      user: {
        findMany: jest.fn().mockResolvedValue([
          { id: 1, email: "admin@example.hr", name: "Admin", role: "ADMIN", organizerId: null, organizer: null, createdAt: new Date() },
        ]),
      },
    };
    const service = new AdminService(prisma as never, {} as never, {} as never, {} as never, {} as never, {} as never, uploadsStub as never);

    await service.users();

    const args = prisma.user.findMany.mock.calls[0][0];
    expect(args.select.passwordHash).toBeUndefined();
    expect(args.select).toMatchObject({ id: true, email: true, role: true, organizerId: true, organizer: expect.anything() });
  });
});

describe("AdminService.deleteUser", () => {
  it("deletes a user by id", async () => {
    const prisma = { user: { delete: jest.fn().mockResolvedValue({ id: 5 }) } };
    const service = new AdminService(prisma as never, {} as never, {} as never, {} as never, {} as never, {} as never, uploadsStub as never);

    const result = await service.deleteUser(5, 1);

    expect(result).toEqual({ id: 5 });
    expect(prisma.user.delete).toHaveBeenCalledWith({ where: { id: 5 } });
  });

  it("refuses to delete your own account", async () => {
    const prisma = { user: { delete: jest.fn() } };
    const service = new AdminService(prisma as never, {} as never, {} as never, {} as never, {} as never, {} as never, uploadsStub as never);

    await expect(service.deleteUser(1, 1)).rejects.toThrow(/vlastiti račun/);
    expect(prisma.user.delete).not.toHaveBeenCalled();
  });
});

describe("AdminService.deleteCity", () => {
  it("blocks deleting a city that still has direct events", async () => {
    const prisma = {
      event: {
        count: jest.fn()
          .mockResolvedValueOnce(2)
          .mockResolvedValueOnce(0),
      },
      $transaction: jest.fn(),
    };
    const service = new AdminService(prisma as never, {} as never, {} as never, {} as never, {} as never, {} as never, uploadsStub as never);

    await expect(service.deleteCity(518)).rejects.toThrow("Grad ima 2 događaja");
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("blocks deleting a city that has events through venues", async () => {
    const prisma = {
      event: {
        count: jest.fn()
          .mockResolvedValueOnce(0)
          .mockResolvedValueOnce(1),
      },
      $transaction: jest.fn(),
    };
    const service = new AdminService(prisma as never, {} as never, {} as never, {} as never, {} as never, {} as never, uploadsStub as never);

    await expect(service.deleteCity(518)).rejects.toThrow("Grad ima 1 događaja preko lokacija");
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("deletes orphan venues before deleting an otherwise unused city", async () => {
    const tx = {
      venue: { deleteMany: jest.fn().mockResolvedValue({ count: 1 }) },
      city: { delete: jest.fn().mockResolvedValue({ id: 518, name: "Podravlje" }) },
    };
    const prisma = {
      event: {
        count: jest.fn()
          .mockResolvedValueOnce(0)
          .mockResolvedValueOnce(0),
      },
      $transaction: jest.fn(async (callback) => callback(tx)),
    };
    const service = new AdminService(prisma as never, {} as never, {} as never, {} as never, {} as never, {} as never, uploadsStub as never);

    const result = await service.deleteCity(518);

    expect(prisma.event.count).toHaveBeenNthCalledWith(1, { where: { cityId: 518 } });
    expect(prisma.event.count).toHaveBeenNthCalledWith(2, { where: { venue: { cityId: 518 } } });
    expect(tx.venue.deleteMany).toHaveBeenCalledWith({ where: { cityId: 518 } });
    expect(tx.city.delete).toHaveBeenCalledWith({ where: { id: 518 } });
    expect(result).toEqual({ id: 518, name: "Podravlje" });
  });
});

describe("AdminService city taxonomy writes", () => {
  it("rejects creating a city whose normalized name matches an existing city slug", async () => {
    const prisma = {
      city: {
        findFirst: jest.fn().mockResolvedValue({ id: 3, name: "Đakovo", slug: "dakovo" }),
        create: jest.fn(),
      },
    };
    const service = new AdminService(prisma as never, {} as never, {} as never, {} as never, {} as never, {} as never, uploadsStub as never);

    await expect(service.createCity({ name: "Dakovo", slug: "dakovo-2", countyId: 1 })).rejects.toThrow("Grad već postoji: Đakovo (dakovo).");
    expect(prisma.city.create).not.toHaveBeenCalled();
  });

  it("allows updating a city when the only normalized duplicate is itself", async () => {
    const prisma = {
      city: {
        findFirst: jest.fn().mockResolvedValue(null),
        update: jest.fn().mockResolvedValue({ id: 3, name: "Đakovo" }),
      },
    };
    const service = new AdminService(prisma as never, {} as never, {} as never, {} as never, {} as never, {} as never, uploadsStub as never);

    const result = await service.updateCity(3, { name: "Đakovo", slug: "dakovo", countyId: 1 });

    expect(prisma.city.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ NOT: { id: 3 } }),
    }));
    expect(result).toEqual({ id: 3, name: "Đakovo" });
  });
});
