import { EventStatus } from "@prisma/client";
import { EventsService } from "../src/events/events.service";
import { AdminService } from "../src/admin/admin.service";
import { OrganizerService } from "../src/organizers/organizer.service";

function fixture(status: EventStatus = EventStatus.PUBLISHED) {
  const current = { id: 1, title: "Event", slug: "event", status, publishedAt: status === EventStatus.PUBLISHED ? new Date() : null,
    cityId: 1, regionId: 1, startsAt: new Date("2099-09-05T12:00:00Z"), endsAt: null, occurrences: [] };
  const prisma: any = {
    event: {
      findUnique: jest.fn().mockImplementation(async ({ where }) => where.id ? current : null),
      findFirst: jest.fn().mockResolvedValue(current),
      findMany: jest.fn().mockResolvedValue([current]),
      count: jest.fn().mockResolvedValue(status === EventStatus.PUBLISHED ? 1 : 0),
      create: jest.fn().mockImplementation(async ({ data }) => ({ ...current, ...data })),
      update: jest.fn().mockImplementation(async ({ data }) => ({ ...current, ...data })),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      delete: jest.fn().mockResolvedValue(current),
    },
    city: { findUnique: jest.fn().mockResolvedValue({ id: 1, name: "Osijek", countyId: 1, county: { regionId: 1 } }) },
    category: { findUnique: jest.fn().mockResolvedValue({ id: 1 }) },
    eventCategory: { upsert: jest.fn(), deleteMany: jest.fn() },
    eventOccurrence: { create: jest.fn(), update: jest.fn(), deleteMany: jest.fn() },
    eventSource: { updateMany: jest.fn() },
    eventDuplicateCandidate: { deleteMany: jest.fn() },
    organizer: { findUniqueOrThrow: jest.fn().mockResolvedValue({ id: 1, name: "Organizer", status: "TRUSTED" }) },
  };
  prisma.$transaction = jest.fn(async (fn: any) => typeof fn === "function" ? fn(prisma) : Promise.all(fn));
  const cache = { revalidate: jest.fn().mockResolvedValue(true) };
  const events = new EventsService(prisma, { detectForEvent: jest.fn() } as never, cache as never);
  const admin = new AdminService(prisma, events, {} as never, {} as never, cache as never, {} as never, {} as never);
  const organizer = new OrganizerService(prisma, events, {} as never, {} as never, {} as never,
    { syncEventSubmitter: jest.fn() } as never, cache as never);
  return { current, prisma, cache, events, admin, organizer };
}

describe("public event mutation invalidation", () => {
  it("admin create + publish invalidates once through shared event service", async () => {
    const { admin, cache } = fixture();
    await admin.createEvent({ title: "New", cityId: 1, categoryId: 1, status: EventStatus.PUBLISHED } as never);
    expect(cache.revalidate).toHaveBeenCalledTimes(1);
    expect(cache.revalidate).toHaveBeenCalledWith("events");
  });
  it("draft creation does not invalidate", async () => {
    const { admin, cache } = fixture(EventStatus.DRAFT);
    await admin.createEvent({ title: "Draft", cityId: 1, categoryId: 1 } as never);
    expect(cache.revalidate).not.toHaveBeenCalled();
  });
  it.each([
    { title: "Changed" }, { description: "Changed" }, { slug: "changed" },
    { imageUrl: "https://image.example/new.jpg" }, { ticketUrl: "https://tickets.example" },
    { priceText: "10 EUR" }, { categoryIds: [1, 2] }, { cityId: 1 },
    { startsAt: "2099-09-06T12:00:00Z" },
    { occurrences: [{ startsAt: "2099-09-06T12:00:00Z", endsAt: "2099-09-06T14:00:00Z" }] },
  ])("published edit invalidates after writes: %j", async dto => {
    const { admin, cache, prisma } = fixture();
    await admin.updateEvent(1, dto as never);
    expect(cache.revalidate).toHaveBeenCalledTimes(1);
    expect(prisma.event.update.mock.invocationCallOrder[0]).toBeLessThan(cache.revalidate.mock.invocationCallOrder[0]);
  });
  it("private draft edit does not invalidate", async () => {
    const { admin, cache } = fixture(EventStatus.DRAFT);
    await admin.updateEvent(1, { title: "Private" } as never);
    expect(cache.revalidate).not.toHaveBeenCalled();
  });
  it("empty public update does not invalidate", async () => {
    const { admin, cache } = fixture();
    await admin.updateEvent(1, {} as never);
    expect(cache.revalidate).not.toHaveBeenCalled();
  });
  it("previously published archived detail edits invalidate", async () => {
    const { admin, cache, current } = fixture(EventStatus.ARCHIVED);
    current.publishedAt = new Date();
    await admin.updateEvent(1, { description: "Historical correction" } as never);
    expect(cache.revalidate).toHaveBeenCalledWith("events");
  });
  it("draft edit to a shared public venue invalidates", async () => {
    const { admin, cache, prisma } = fixture(EventStatus.DRAFT);
    prisma.venue = { upsert: jest.fn().mockResolvedValue({ id: 2 }) };
    prisma.event.count.mockResolvedValue(1);
    await admin.updateEvent(1, { venueName: "Shared venue" } as never);
    expect(cache.revalidate).toHaveBeenCalledWith("events");
  });
  it.each([EventStatus.DRAFT, EventStatus.ARCHIVED, EventStatus.PENDING_REVIEW])("unpublish to %s invalidates", async status => {
    const { admin, cache } = fixture();
    await admin.setEventStatus(1, status);
    expect(cache.revalidate).toHaveBeenCalledWith("events");
  });
  it("deletion invalidates after transaction commits", async () => {
    const { admin, cache } = fixture();
    await admin.deleteEvent(1);
    expect(cache.revalidate).toHaveBeenCalledWith("events");
  });
  it("private draft deletion does not invalidate", async () => {
    const { admin, cache } = fixture(EventStatus.DRAFT);
    await admin.deleteEvent(1);
    expect(cache.revalidate).not.toHaveBeenCalled();
  });
  it.each(["add", "remove"] as const)("bulk category %s invalidates", async action => {
    const { admin, cache } = fixture();
    await admin.bulkAssignCategory([1], 2, action);
    expect(cache.revalidate).toHaveBeenCalledWith("events");
  });
  it("bulk draft category changes do not invalidate", async () => {
    const { admin, cache } = fixture(EventStatus.DRAFT);
    await admin.bulkAssignCategory([1], 2, "add");
    expect(cache.revalidate).not.toHaveBeenCalled();
  });
  it("bulk date shifts invalidate", async () => {
    const { admin, cache } = fixture();
    await admin.bulkShiftDates([1], 1);
    expect(cache.revalidate).toHaveBeenCalledWith("events");
  });
  it("bulk publication invalidates previously private events", async () => {
    const { admin, cache, prisma } = fixture(EventStatus.DRAFT);
    prisma.event.findMany.mockResolvedValue([]); // no organizer notification recipients
    await admin.bulkSetStatus([1], EventStatus.PUBLISHED);
    expect(cache.revalidate).toHaveBeenCalledWith("events");
  });
  it("trusted organizer publication invalidates through shared service", async () => {
    const { organizer, cache } = fixture();
    await organizer.createEvent(1, { title: "New", cityId: 1, categoryId: 1 } as never);
    expect(cache.revalidate).toHaveBeenCalledTimes(1);
  });
  it("organizer edit published to pending invalidates", async () => {
    const { organizer, cache } = fixture();
    const result = await organizer.updateEvent(1, 1, { title: "Review edit" });
    expect(result.status).toBe(EventStatus.PENDING_REVIEW);
    expect(cache.revalidate).toHaveBeenCalledWith("events");
  });
  it("waits for delivery but preserves committed mutation on delivery failure", async () => {
    const { admin, cache, prisma } = fixture();
    let finish!: (success: boolean) => void;
    cache.revalidate.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
    let completed = false;
    const save = admin.updateEvent(1, { title: "Saved" } as never).then(result => { completed = true; return result; });
    while (!finish) await new Promise(resolve => setImmediate(resolve));
    expect(prisma.event.update).toHaveBeenCalled();
    expect(completed).toBe(false);
    finish(false);
    expect((await save).title).toBe("Saved");
  });
});
