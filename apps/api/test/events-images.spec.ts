import { EventsService } from "../src/events/events.service";

describe("EventsService image fields", () => {
  it("rejects unknown city on create", async () => {
    const prisma = {
      city: { findUnique: jest.fn().mockResolvedValue(null) },
    };
    const service = new EventsService(prisma as never, { detectForEvent: jest.fn() } as never);

    await expect(service.createFromDto({
      title: "Test event",
      description: "Opis",
      cityId: 999,
      categoryId: 4,
      startsAt: "2026-07-01T10:00:00.000Z",
    }, {})).rejects.toThrow("Unknown cityId");
  });

  it("rejects unknown category on create", async () => {
    const prisma = {
      city: { findUnique: jest.fn().mockResolvedValue({ id: 1, countyId: 2, county: { regionId: 3 } }) },
      category: { findUnique: jest.fn().mockResolvedValue(null) },
    };
    const service = new EventsService(prisma as never, { detectForEvent: jest.fn() } as never);

    await expect(service.createFromDto({
      title: "Test event",
      description: "Opis",
      cityId: 1,
      categoryId: 999,
      startsAt: "2026-07-01T10:00:00.000Z",
    }, {})).rejects.toThrow("Unknown categoryId");
  });

  it("persists image fields on create", async () => {
    const prisma = {
      city: { findUnique: jest.fn().mockResolvedValue({ id: 1, countyId: 2, county: { regionId: 3 } }) },
      category: { findUnique: jest.fn().mockResolvedValue({ id: 4 }) },
      event: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 10 }),
      },
      eventCategory: { upsert: jest.fn() },
    };
    const service = new EventsService(prisma as never, { detectForEvent: jest.fn() } as never);

    await service.createFromDto({
      title: "Test event",
      description: "Opis",
      cityId: 1,
      categoryId: 4,
      startsAt: "2026-07-01T10:00:00.000Z",
      imageUrl: "https://res.cloudinary.com/demo/image/upload/event.jpg",
    }, {});

    expect(prisma.event.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        imageUrl: "https://res.cloudinary.com/demo/image/upload/event.jpg",
      }),
    }));
    expect(prisma.eventCategory.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { eventId_categoryId: { eventId: 10, categoryId: 4 } },
      create: expect.objectContaining({ eventId: 10, categoryId: 4, source: "MANUAL" }),
    }));
  });

  it("uses supplied categoryIds to create primary and secondary category joins", async () => {
    const prisma = {
      city: { findUnique: jest.fn().mockResolvedValue({ id: 1, countyId: 2, county: { regionId: 3 } }) },
      category: { findUnique: jest.fn().mockResolvedValue({ id: 4 }) },
      event: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 10 }),
      },
      eventCategory: { upsert: jest.fn() },
    };
    const service = new EventsService(prisma as never, { detectForEvent: jest.fn() } as never);

    await service.createFromDto({
      title: "Test event",
      description: "Opis",
      cityId: 1,
      categoryId: 4,
      categoryIds: [4, 8],
      startsAt: "2026-07-01T10:00:00.000Z",
    }, {});

    expect(prisma.eventCategory.upsert).toHaveBeenNthCalledWith(1, expect.objectContaining({
      create: expect.objectContaining({ categoryId: 4 }),
    }));
    expect(prisma.eventCategory.upsert).toHaveBeenNthCalledWith(2, expect.objectContaining({
      create: expect.objectContaining({ categoryId: 8 }),
    }));
  });

  it("rejects unknown organizer on update", async () => {
    const prisma = {
      event: { findUnique: jest.fn().mockResolvedValue({ id: 10 }) },
      organizer: { findUnique: jest.fn().mockResolvedValue(null) },
    };
    const service = new EventsService(prisma as never, { detectForEvent: jest.fn() } as never);

    await expect(service.updateEvent(10, { organizerId: 999 })).rejects.toThrow("Unknown organizerId");
  });

  it("persists image fields on update", async () => {
    const prisma = {
      event: {
        findUnique: jest.fn().mockResolvedValue({ id: 10 }),
        update: jest.fn().mockResolvedValue({ id: 10 }),
      },
    };
    const service = new EventsService(prisma as never, { detectForEvent: jest.fn() } as never);

    await service.updateEvent(10, {
      imageUrl: null,
    });

    expect(prisma.event.update).toHaveBeenCalledWith({
      where: { id: 10 },
      data: expect.objectContaining({
        imageUrl: null,
      }),
    });
  });

  it("resolves existing city/region when adding a custom venue to a cityName-only event", async () => {
    const city = { id: 7, name: "Belišće", countyId: 8, county: { regionId: 1 } };
    const prisma = {
      event: {
        findUnique: jest.fn().mockResolvedValue({ id: 10, cityId: null, cityName: "Belišće" }),
        update: jest.fn().mockResolvedValue({ id: 10 }),
      },
      city: {
        findFirst: jest.fn().mockResolvedValue(city),
      },
      venue: {
        upsert: jest.fn().mockResolvedValue({ id: 12 }),
      },
    };
    const service = new EventsService(prisma as never, { detectForEvent: jest.fn() } as never);

    await service.updateEvent(10, {
      venueName: "Park hrvatskih branitelja",
      address: "Belišće, Belišće",
      lat: 45.6809,
      lng: 18.4056,
    });

    expect(prisma.city.findFirst).toHaveBeenCalledWith({
      where: { name: { equals: "Belišće", mode: "insensitive" } },
      include: { county: true },
    });
    expect(prisma.venue.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { slug_cityId: { slug: "park-hrvatskih-branitelja", cityId: 7 } },
      create: expect.objectContaining({ name: "Park hrvatskih branitelja", cityId: 7 }),
    }));
    expect(prisma.event.update).toHaveBeenCalledWith({
      where: { id: 10 },
      data: expect.objectContaining({
        cityName: "Belišće",
        cityId: 7,
        countyId: 8,
        regionId: 1,
        venueId: 12,
      }),
    });
  });

  it("clears endsAt when explicitly set to null (e.g. duplicated event with a stale end date)", async () => {
    const prisma = {
      event: {
        findUnique: jest.fn().mockResolvedValue({ id: 10 }),
        update: jest.fn().mockResolvedValue({ id: 10 }),
      },
    };
    const service = new EventsService(prisma as never, { detectForEvent: jest.fn() } as never);

    await service.updateEvent(10, { endsAt: null });

    expect(prisma.event.update).toHaveBeenCalledWith({
      where: { id: 10 },
      data: expect.objectContaining({ endsAt: null }),
    });
  });

  it("sets endsAt to the parsed date when a value is supplied", async () => {
    const prisma = {
      event: {
        findUnique: jest.fn().mockResolvedValue({ id: 10 }),
        update: jest.fn().mockResolvedValue({ id: 10 }),
      },
    };
    const service = new EventsService(prisma as never, { detectForEvent: jest.fn() } as never);

    await service.updateEvent(10, { endsAt: "2026-08-29T02:00:00.000Z" });

    expect(prisma.event.update).toHaveBeenCalledWith({
      where: { id: 10 },
      data: expect.objectContaining({ endsAt: new Date("2026-08-29T02:00:00.000Z") }),
    });
  });

  it("leaves endsAt untouched when omitted from the update payload", async () => {
    const prisma = {
      event: {
        findUnique: jest.fn().mockResolvedValue({ id: 10 }),
        update: jest.fn().mockResolvedValue({ id: 10 }),
      },
    };
    const service = new EventsService(prisma as never, { detectForEvent: jest.fn() } as never);

    await service.updateEvent(10, { title: "Renamed" });

    const data = prisma.event.update.mock.calls[0][0].data;
    expect("endsAt" in data).toBe(false);
  });

  it("sets publishedAt when update status publishes the event", async () => {
    jest.useFakeTimers().setSystemTime(new Date("2026-07-01T12:00:00.000Z"));
    const prisma = {
      event: {
        findUnique: jest.fn().mockResolvedValue({ id: 10 }),
        update: jest.fn().mockResolvedValue({ id: 10 }),
      },
    };
    const service = new EventsService(prisma as never, { detectForEvent: jest.fn() } as never);

    await service.updateEvent(10, { status: "PUBLISHED" as never });

    expect(prisma.event.update).toHaveBeenCalledWith({
      where: { id: 10 },
      data: expect.objectContaining({
        status: "PUBLISHED",
        publishedAt: new Date("2026-07-01T12:00:00.000Z"),
      }),
    });
    jest.useRealTimers();
  });
});
