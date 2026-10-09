import { BadRequestException, ValidationPipe } from "@nestjs/common";
import { EventStatus } from "@prisma/client";
import { EventsService } from "../src/events/events.service";
import { OrganizerService } from "../src/organizers/organizer.service";
import { OrganizerEventDto } from "../src/organizers/organizer.dto";

/**
 * EVT-06: organizers must be able to clear optional fields (explicit null),
 * save unrelated changes without touching other fields, and save events whose
 * stored links predate URL validation.
 */
const OWN = 7;
const OTHER = 999;

// Matches main.ts: app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }))
const globalPipe = new ValidationPipe({ whitelist: true, transform: true });
const viaPipe = (payload: object) => globalPipe.transform(payload, { type: "body", metatype: OrganizerEventDto, data: "" }) as Promise<OrganizerEventDto>;

function fixture(overrides: Record<string, unknown> = {}) {
  const current = {
    // Direct persistence covers never-published submissions. Published clears
    // are covered against PostgreSQL in event-revisions.integration.spec.ts.
    id: 1, title: "Koncert", slug: "koncert", status: EventStatus.PENDING_REVIEW, organizerId: OWN, isFeatured: false,
    publishedAt: null, cityId: 1, regionId: 1, cityName: "Osijek",
    startsAt: new Date("2099-09-05T16:00:00Z"), endsAt: new Date("2099-09-05T20:00:00Z"), isAllDay: false,
    priceText: "10 EUR", ticketUrl: "https://www.entrio.hr/event/1", sourceUrl: "https://udruga.hr/koncert",
    imageUrl: "https://res.cloudinary.com/demo/image/upload/a.jpg", occurrences: [] as unknown[],
    ...overrides,
  };
  const tx = {
    eventOccurrence: { deleteMany: jest.fn(), update: jest.fn(), create: jest.fn() },
    event: { update: jest.fn().mockImplementation(async ({ data }) => ({ ...current, ...data })) },
  };
  const prisma: any = {
    event: {
      findUnique: jest.fn().mockImplementation(async ({ where }) => where.id ? current : null),
      findFirst: jest.fn().mockImplementation(async ({ where }) =>
        where.id === current.id && where.organizerId === current.organizerId ? current : null),
      count: jest.fn().mockResolvedValue(0),
      create: jest.fn().mockImplementation(async ({ data }) => ({ id: 2, ...data, occurrences: [] })),
      update: jest.fn().mockImplementation(async ({ data }) => ({ ...current, ...data })),
    },
    $transaction: jest.fn().mockImplementation(async (fn: (t: typeof tx) => unknown) => fn(tx)),
    city: { findUnique: jest.fn().mockResolvedValue({ id: 1, name: "Osijek", countyId: 1, county: { regionId: 1 } }) },
    category: { findUnique: jest.fn().mockResolvedValue({ id: 1 }) },
    eventCategory: { upsert: jest.fn(), deleteMany: jest.fn() },
    organizer: { findUniqueOrThrow: jest.fn().mockResolvedValue({ id: OWN, name: "Organizator", status: "CLAIMED" }) },
  };
  const cache = { revalidate: jest.fn().mockResolvedValue(true) };
  const events = new EventsService(prisma, { detectForEvent: jest.fn() } as never, cache as never);
  const email = { webUrl: "https://manifestacije.hr", sendEventSubmitted: jest.fn(), sendEventPublished: jest.fn(), sendAdminNewSubmission: jest.fn() };
  const organizer = new OrganizerService(prisma, events, {} as never, {} as never, email as never,
    { syncEventSubmitter: jest.fn() } as never, cache as never);
  const written = () => prisma.event.update.mock.calls[0]?.[0].data ?? tx.event.update.mock.calls[0]?.[0].data;
  return { prisma, tx, organizer, written };
}

describe("EVT-06 organizer clears optional fields", () => {
  it.each([
    ["endsAt", { startsAt: "2099-09-05T16:00:00.000Z", endsAt: null, isAllDay: false }],
    ["priceText", { priceText: null }],
    ["ticketUrl", { ticketUrl: null }],
    ["imageUrl", { imageUrl: null }],
    ["sourceUrl", { sourceUrl: null }],
  ])("persists explicit null for %s through the real pipe", async (field, payload) => {
    const { organizer, written } = fixture();
    const dto = await viaPipe(payload);
    expect(dto).toHaveProperty(field, null);
    await organizer.updateEvent(OWN, 1, dto);
    expect(written()).toHaveProperty(field, null);
  });

  it("clears everything at once, as the form sends it", async () => {
    const { organizer, written } = fixture();
    await organizer.updateEvent(OWN, 1, await viaPipe({
      title: "Koncert", startsAt: "2099-09-05T16:00:00.000Z", endsAt: null, isAllDay: false,
      isFree: false, priceText: null, ticketUrl: null, sourceUrl: null, imageUrl: null,
    }));
    expect(written()).toEqual(expect.objectContaining({ endsAt: null, priceText: null, ticketUrl: null, sourceUrl: null, imageUrl: null }));
  });
});

describe("EVT-06 unrelated changes leave other fields alone", () => {
  it("a title-only edit writes no schedule, price, link or image fields", async () => {
    const { organizer, written } = fixture();
    await organizer.updateEvent(OWN, 1, await viaPipe({ title: "Novi naslov" }));
    const data = written();
    expect(data.title).toBe("Novi naslov");
    for (const key of ["startsAt", "endsAt", "isAllDay", "priceText", "ticketUrl", "sourceUrl", "imageUrl", "isFree"]) {
      expect(data).not.toHaveProperty(key);
    }
  });

  it("resubmitting unchanged links does not rewrite them", async () => {
    const { organizer, written } = fixture();
    await organizer.updateEvent(OWN, 1, await viaPipe({
      title: "Ispravak", ticketUrl: "https://www.entrio.hr/event/1", sourceUrl: "https://udruga.hr/koncert",
      imageUrl: "https://res.cloudinary.com/demo/image/upload/a.jpg", priceText: "10 EUR",
    }));
    const data = written();
    expect(data).not.toHaveProperty("ticketUrl");
    expect(data).not.toHaveProperty("sourceUrl");
    expect(data).not.toHaveProperty("imageUrl");
    expect(data.priceText).toBe("10 EUR");
  });
});

describe("EVT-06 legacy invalid stored links", () => {
  const legacy = { ticketUrl: "racesmanager", sourceUrl: "javascript:alert(1)" };

  it("an unchanged invalid legacy value does not block saving unrelated changes", async () => {
    const { organizer, written } = fixture(legacy);
    await organizer.updateEvent(OWN, 1, await viaPipe({ title: "Podunavlje Trail 2099", ...legacy }));
    const data = written();
    expect(data.title).toBe("Podunavlje Trail 2099");
    // Left as stored (never rewritten, never validated as a new link).
    expect(data).not.toHaveProperty("ticketUrl");
    expect(data).not.toHaveProperty("sourceUrl");
  });

  it("an invalid legacy value can be cleared with null", async () => {
    const { organizer, written } = fixture(legacy);
    await organizer.updateEvent(OWN, 1, await viaPipe({ ticketUrl: null, sourceUrl: null }));
    expect(written()).toEqual(expect.objectContaining({ ticketUrl: null, sourceUrl: null }));
  });

  it("an invalid legacy value can be replaced with a valid link", async () => {
    const { organizer, written } = fixture(legacy);
    await organizer.updateEvent(OWN, 1, await viaPipe({ ticketUrl: "www.racesmanager.com/podunavlje" }));
    expect(written().ticketUrl).toBe("https://www.racesmanager.com/podunavlje");
  });

  it.each(["javascript:alert(1)", "druga-nevaljana-vrijednost", "data:text/html,x"])("a changed value %j must still be safe", async (value) => {
    const { prisma, organizer } = fixture(legacy);
    await expect(organizer.updateEvent(OWN, 1, await viaPipe({ ticketUrl: value }))).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.event.update).not.toHaveBeenCalled();
  });

  it("a new event can never start with an unsafe link", async () => {
    const { prisma, organizer } = fixture();
    const dto = await viaPipe({ title: "Novi", cityId: 1, categoryId: 1, startsAt: "2099-09-05T18:00:00.000Z", ticketUrl: "racesmanager" });
    await expect(organizer.createEvent(OWN, dto)).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.event.create).not.toHaveBeenCalled();
  });
});

describe("EVT-06 schedules", () => {
  it("keeps an overnight end on the next day", async () => {
    const { organizer, written } = fixture();
    await organizer.updateEvent(OWN, 1, await viaPipe({ startsAt: "2099-09-05T20:00:00.000Z", endsAt: "2099-09-06T00:00:00.000Z", isAllDay: false }));
    expect(written()).toEqual(expect.objectContaining({
      startsAt: new Date("2099-09-05T20:00:00.000Z"), endsAt: new Date("2099-09-06T00:00:00.000Z"), isAllDay: false,
    }));
  });

  it("stores a multi-day range and can later clear only its end", async () => {
    const multi = fixture({ endsAt: new Date("2099-09-07T20:00:00Z") });
    await multi.organizer.updateEvent(OWN, 1, await viaPipe({ startsAt: "2099-09-05T16:00:00.000Z", endsAt: "2099-09-07T20:00:00.000Z", isAllDay: false }));
    expect(multi.written().endsAt).toEqual(new Date("2099-09-07T20:00:00.000Z"));

    const cleared = fixture({ endsAt: new Date("2099-09-07T20:00:00Z") });
    await cleared.organizer.updateEvent(OWN, 1, await viaPipe({ startsAt: "2099-09-05T16:00:00.000Z", endsAt: null, isAllDay: false }));
    expect(cleared.written()).toEqual(expect.objectContaining({ startsAt: new Date("2099-09-05T16:00:00.000Z"), endsAt: null }));
  });

  it("all-day multi-day event keeps its start when the end changes", async () => {
    const { organizer, written } = fixture({ isAllDay: true });
    await organizer.updateEvent(OWN, 1, await viaPipe({ startsAt: "2099-09-04T22:00:00.000Z", endsAt: "2099-09-07T21:59:00.000Z", isAllDay: true }));
    expect(written()).toEqual(expect.objectContaining({ startsAt: new Date("2099-09-04T22:00:00.000Z"), endsAt: new Date("2099-09-07T21:59:00.000Z"), isAllDay: true }));
  });

  it("occurrence-backed events clear one slot's end without touching the others", async () => {
    const { organizer, tx } = fixture({ occurrences: [{ id: 11 }, { id: 12 }] });
    await organizer.updateEvent(OWN, 1, await viaPipe({
      startsAt: "2099-09-05T16:00:00.000Z", endsAt: null, isAllDay: false,
      occurrences: [
        { id: 11, startsAt: "2099-09-05T16:00:00.000Z", endsAt: null, isAllDay: false },
        { id: 12, startsAt: "2099-09-12T16:00:00.000Z", endsAt: "2099-09-12T20:00:00.000Z", isAllDay: false },
      ],
    }));
    const updates = tx.eventOccurrence.update.mock.calls.map(([arg]: [{ where: { id: number }; data: { endsAt: Date | null } }]) => [arg.where.id, arg.data.endsAt]);
    expect(updates).toEqual([[11, null], [12, new Date("2099-09-12T20:00:00.000Z")]]);
    expect(tx.eventOccurrence.deleteMany).toHaveBeenCalledWith({ where: { eventId: 1, id: { notIn: [11, 12] } } });
  });
});

describe("EVT-06 keeps organizer authorization and review workflow", () => {
  it("another organizer cannot clear fields on someone else's event", async () => {
    const { prisma, organizer } = fixture();
    await expect(organizer.updateEvent(OTHER, 1, await viaPipe({ ticketUrl: null, endsAt: null }))).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.event.update).not.toHaveBeenCalled();
  });

  it("clearing fields still sends the event back to review and ignores admin-only fields", async () => {
    const { organizer, written } = fixture();
    await organizer.updateEvent(OWN, 1, { ...(await viaPipe({ priceText: null })), organizerId: OTHER, isFeatured: true, slug: "preuzeto" } as never);
    const data = written();
    expect(data.status).toBe(EventStatus.PENDING_REVIEW);
    expect(data.priceText).toBeNull();
    expect(data).not.toHaveProperty("organizerId");
    expect(data).not.toHaveProperty("isFeatured");
    expect(data).not.toHaveProperty("slug");
  });
});
