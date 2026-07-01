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
      imageAlt: "Alt",
      imageCredit: "Foto kredit",
      imageSourceUrl: "https://source.example/image",
    }, {});

    expect(prisma.event.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        imageUrl: "https://res.cloudinary.com/demo/image/upload/event.jpg",
        imageAlt: "Alt",
        imageCredit: "Foto kredit",
        imageSourceUrl: "https://source.example/image",
      }),
    }));
    expect(prisma.eventCategory.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { eventId_categoryId: { eventId: 10, categoryId: 4 } },
      create: expect.objectContaining({ eventId: 10, categoryId: 4, isPrimary: true }),
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
      create: expect.objectContaining({ categoryId: 4, isPrimary: true }),
    }));
    expect(prisma.eventCategory.upsert).toHaveBeenNthCalledWith(2, expect.objectContaining({
      create: expect.objectContaining({ categoryId: 8, isPrimary: false }),
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
      imageAlt: null,
      imageCredit: null,
      imageSourceUrl: null,
    });

    expect(prisma.event.update).toHaveBeenCalledWith({
      where: { id: 10 },
      data: expect.objectContaining({
        imageUrl: null,
        imageAlt: null,
        imageCredit: null,
        imageSourceUrl: null,
      }),
    });
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
