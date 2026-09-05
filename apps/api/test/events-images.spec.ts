import { EventsService } from "../src/events/events.service";

describe("EventsService image fields", () => {
  it("rejects unknown city on create", async () => {
    const prisma = {
      city: { findUnique: jest.fn().mockResolvedValue(null) },
    };
    const service = new EventsService(prisma as never, { detectForEvent: jest.fn() } as never, { revalidate: jest.fn().mockResolvedValue(true) } as never);

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
    const service = new EventsService(prisma as never, { detectForEvent: jest.fn() } as never, { revalidate: jest.fn().mockResolvedValue(true) } as never);

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
        count: jest.fn().mockResolvedValue(0),
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 10 }),
      },
      eventCategory: { upsert: jest.fn() },
    };
    const service = new EventsService(prisma as never, { detectForEvent: jest.fn() } as never, { revalidate: jest.fn().mockResolvedValue(true) } as never);

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
        count: jest.fn().mockResolvedValue(0),
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 10 }),
      },
      eventCategory: { upsert: jest.fn() },
    };
    const service = new EventsService(prisma as never, { detectForEvent: jest.fn() } as never, { revalidate: jest.fn().mockResolvedValue(true) } as never);

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
    const service = new EventsService(prisma as never, { detectForEvent: jest.fn() } as never, { revalidate: jest.fn().mockResolvedValue(true) } as never);

    await expect(service.updateEvent(10, { organizerId: 999 })).rejects.toThrow("Unknown organizerId");
  });

  it("saves an updated, normalized slug", async () => {
    const prisma = {
      event: {
        count: jest.fn().mockResolvedValue(0),
        findUnique: jest.fn()
          .mockResolvedValueOnce({ id: 10, cityId: 1, regionId: 3, slug: "old-slug" }) // load current
          .mockResolvedValueOnce(null), // no event already has the new slug
        update: jest.fn().mockResolvedValue({ id: 10, slug: "novi-slug" }),
      },
    };
    const service = new EventsService(prisma as never, { detectForEvent: jest.fn() } as never, { revalidate: jest.fn().mockResolvedValue(true) } as never);

    await service.updateEvent(10, { slug: "  Novi Slug!  " });

    expect(prisma.event.findUnique).toHaveBeenNthCalledWith(2, { where: { slug: "novi-slug" } });
    expect(prisma.event.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ slug: "novi-slug" }),
    }));
  });

  it("rejects a slug already taken by a different event", async () => {
    const prisma = {
      event: {
        count: jest.fn().mockResolvedValue(0),
        findUnique: jest.fn()
          .mockResolvedValueOnce({ id: 10, cityId: 1, regionId: 3, slug: "old-slug" })
          .mockResolvedValueOnce({ id: 99, slug: "taken-slug" }),
      },
    };
    const service = new EventsService(prisma as never, { detectForEvent: jest.fn() } as never, { revalidate: jest.fn().mockResolvedValue(true) } as never);

    await expect(service.updateEvent(10, { slug: "taken-slug" })).rejects.toThrow("Taj slug je već zauzet.");
  });

  it("does not check for a collision when the slug is unchanged", async () => {
    const prisma = {
      event: {
        count: jest.fn().mockResolvedValue(0),
        findUnique: jest.fn().mockResolvedValueOnce({ id: 10, cityId: 1, regionId: 3, slug: "same-slug" }),
        update: jest.fn().mockResolvedValue({ id: 10 }),
      },
    };
    const service = new EventsService(prisma as never, { detectForEvent: jest.fn() } as never, { revalidate: jest.fn().mockResolvedValue(true) } as never);

    await service.updateEvent(10, { slug: "same-slug" });

    expect(prisma.event.findUnique).toHaveBeenCalledTimes(1);
    expect(prisma.event.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.not.objectContaining({ slug: expect.anything() }),
    }));
  });

  it("persists image fields on update", async () => {
    const prisma = {
      event: {
        count: jest.fn().mockResolvedValue(0),
        findUnique: jest.fn().mockResolvedValue({ id: 10, cityId: 1, regionId: 3 }),
        update: jest.fn().mockResolvedValue({ id: 10 }),
      },
    };
    const service = new EventsService(prisma as never, { detectForEvent: jest.fn() } as never, { revalidate: jest.fn().mockResolvedValue(true) } as never);

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
    const city = { id: 7, name: "Belišće", countyId: 8, county: { regionId: 1, region: { slug: "slavonija-i-baranja" } } };
    const prisma = {
      event: {
        count: jest.fn().mockResolvedValue(0),
        findUnique: jest.fn().mockResolvedValue({ id: 10, cityId: null, cityName: "Belišće" }),
        update: jest.fn().mockResolvedValue({ id: 10 }),
      },
      city: {
        findMany: jest.fn().mockResolvedValue([city]),
        findFirst: jest.fn().mockResolvedValue(city),
      },
      venue: {
        upsert: jest.fn().mockResolvedValue({ id: 12 }),
      },
    };
    const service = new EventsService(prisma as never, { detectForEvent: jest.fn() } as never, { revalidate: jest.fn().mockResolvedValue(true) } as never);

    await service.updateEvent(10, {
      venueName: "Park hrvatskih branitelja",
      address: "Belišće, Belišće",
      lat: 45.6809,
      lng: 18.4056,
    });

    expect(prisma.city.findFirst).toHaveBeenCalledWith({
      where: {
        OR: [
          { name: { equals: "Belišće", mode: "insensitive" } },
          { slug: "belisce" },
        ],
      },
      include: { county: { include: { region: true } } },
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

  it("uses precise location city metadata to set city, county and region", async () => {
    const city = { id: 1, name: "Osijek", countyId: 2, county: { regionId: 3, region: { slug: "slavonija-i-baranja" } } };
    const prisma = {
      event: {
        count: jest.fn().mockResolvedValue(0),
        findUnique: jest.fn().mockResolvedValue({ id: 10, cityId: null, cityName: "Donji Kukuljica" }),
        update: jest.fn().mockResolvedValue({ id: 10 }),
      },
      city: {
        findMany: jest.fn().mockResolvedValue([city]),
        findFirst: jest.fn().mockResolvedValue(city),
      },
    };
    const service = new EventsService(prisma as never, { detectForEvent: jest.fn() } as never, { revalidate: jest.fn().mockResolvedValue(true) } as never);

    await service.updateEvent(10, {
      cityName: "Osijek",
      countyName: "Osječko-baranjska",
      regionSlug: "slavonija-i-baranja",
      address: 'Dječji kreativni centar "DOKKICA", Osijek',
      lat: 45.555,
      lng: 18.695,
    });

    expect(prisma.event.update).toHaveBeenCalledWith({
      where: { id: 10 },
      data: expect.objectContaining({
        cityName: "Osijek",
        cityId: 1,
        countyId: 2,
        regionId: 3,
        address: 'Dječji kreativni centar "DOKKICA", Osijek',
        lat: 45.555,
        lng: 18.695,
      }),
    });
  });

  it("overwrites a stale cityId when precise location resolves a different city", async () => {
    const osijek = { id: 1, name: "Osijek", countyId: 2, county: { regionId: 3, region: { slug: "slavonija-i-baranja" } } };
    const prisma = {
      event: {
        count: jest.fn().mockResolvedValue(0),
        findUnique: jest.fn().mockResolvedValue({ id: 10, cityId: 99, regionId: 999, cityName: "Stari grad" }),
        update: jest.fn().mockResolvedValue({ id: 10 }),
      },
      city: {
        findMany: jest.fn().mockResolvedValue([osijek]),
        findFirst: jest.fn().mockResolvedValue(osijek),
        findUnique: jest.fn(),
      },
    };
    const service = new EventsService(prisma as never, { detectForEvent: jest.fn() } as never, { revalidate: jest.fn().mockResolvedValue(true) } as never);

    await service.updateEvent(10, {
      cityId: 99,
      cityName: "Osijek",
      address: 'Dječji kreativni centar "DOKKICA", Osijek',
      lat: 45.555,
      lng: 18.695,
    });

    expect(prisma.city.findUnique).not.toHaveBeenCalledWith({ where: { id: 99 }, include: { county: true } });
    expect(prisma.event.update).toHaveBeenCalledWith({
      where: { id: 10 },
      data: expect.objectContaining({
        cityName: "Osijek",
        cityId: 1,
        countyId: 2,
        regionId: 3,
      }),
    });
  });

  it("resolves city from precise address even without Google city metadata", async () => {
    const osijek = { id: 1, name: "Osijek", countyId: 2, county: { regionId: 3, region: { slug: "slavonija-i-baranja" } } };
    const prisma = {
      event: {
        count: jest.fn().mockResolvedValue(0),
        findUnique: jest.fn().mockResolvedValue({ id: 10, cityId: 99, regionId: 999, cityName: "Stari grad" }),
        update: jest.fn().mockResolvedValue({ id: 10 }),
      },
      city: {
        findMany: jest.fn().mockResolvedValue([osijek]),
        findFirst: jest.fn().mockResolvedValue(osijek),
      },
    };
    const service = new EventsService(prisma as never, { detectForEvent: jest.fn() } as never, { revalidate: jest.fn().mockResolvedValue(true) } as never);

    await service.updateEvent(10, {
      address: "Zadarska ul. 33, Osijek",
      lat: 45.555,
      lng: 18.695,
    });

    expect(prisma.event.update).toHaveBeenCalledWith({
      where: { id: 10 },
      data: expect.objectContaining({
        cityName: "Osijek",
        cityId: 1,
        countyId: 2,
        regionId: 3,
      }),
    });
  });

  it("prefers known city in address over stale Google/admin cityName metadata", async () => {
    const osijek = { id: 1, name: "Osijek", countyId: 2, county: { regionId: 3, region: { slug: "slavonija-i-baranja" } } };
    const donjiKukljica = { id: 99, name: "Donji Kukljica", countyId: 98, county: { regionId: 97, region: { slug: "dalmacija" } } };
    const prisma = {
      event: {
        count: jest.fn().mockResolvedValue(0),
        findUnique: jest.fn().mockResolvedValue({ id: 10, cityId: 99, regionId: 97, cityName: "Donji Kukljica" }),
        update: jest.fn().mockResolvedValue({ id: 10 }),
      },
      city: {
        findMany: jest.fn().mockResolvedValue([donjiKukljica, osijek]),
        findFirst: jest.fn().mockResolvedValue(osijek),
      },
    };
    const service = new EventsService(prisma as never, { detectForEvent: jest.fn() } as never, { revalidate: jest.fn().mockResolvedValue(true) } as never);

    await service.updateEvent(10, {
      cityName: "Donji Kukljica",
      address: 'Dječji kreativni centar "DOKKICA", Osijek',
      lat: 45.555,
      lng: 18.695,
    });

    expect(prisma.city.findFirst).toHaveBeenCalledWith({
      where: {
        OR: [
          { name: { equals: "Osijek", mode: "insensitive" } },
          { slug: "osijek" },
        ],
      },
      include: { county: { include: { region: true } } },
    });
    expect(prisma.event.update).toHaveBeenCalledWith({
      where: { id: 10 },
      data: expect.objectContaining({
        cityName: "Osijek",
        cityId: 1,
        countyId: 2,
        regionId: 3,
      }),
    });
  });

  it("moves an unchanged venue name under the city resolved from the new precise address", async () => {
    const osijek = { id: 1, name: "Osijek", countyId: 2, county: { regionId: 3, region: { slug: "slavonija-i-baranja" } } };
    const prisma = {
      event: {
        count: jest.fn().mockResolvedValue(0),
        findUnique: jest.fn().mockResolvedValue({ id: 10, cityId: 99, regionId: 97, cityName: "Stari grad" }),
        update: jest.fn().mockResolvedValue({ id: 10 }),
      },
      city: {
        findMany: jest.fn().mockResolvedValue([osijek]),
        findFirst: jest.fn().mockResolvedValue(osijek),
      },
      venue: {
        upsert: jest.fn().mockResolvedValue({ id: 44 }),
      },
    };
    const service = new EventsService(prisma as never, { detectForEvent: jest.fn() } as never, { revalidate: jest.fn().mockResolvedValue(true) } as never);

    await service.updateEvent(10, {
      venueName: "Garaza",
      address: "Zadarska ul. 33, Osijek",
      lat: 45.555,
      lng: 18.695,
    });

    expect(prisma.venue.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { slug_cityId: { slug: "garaza", cityId: 1 } },
      create: expect.objectContaining({ name: "Garaza", cityId: 1 }),
    }));
    expect(prisma.event.update).toHaveBeenCalledWith({
      where: { id: 10 },
      data: expect.objectContaining({
        cityName: "Osijek",
        cityId: 1,
        countyId: 2,
        regionId: 3,
        venueId: 44,
      }),
    });
  });

  it("clears endsAt when explicitly set to null (e.g. duplicated event with a stale end date)", async () => {
    const prisma = {
      event: {
        count: jest.fn().mockResolvedValue(0),
        findUnique: jest.fn().mockResolvedValue({ id: 10, cityId: 1, regionId: 3 }),
        update: jest.fn().mockResolvedValue({ id: 10 }),
      },
    };
    const service = new EventsService(prisma as never, { detectForEvent: jest.fn() } as never, { revalidate: jest.fn().mockResolvedValue(true) } as never);

    await service.updateEvent(10, { endsAt: null });

    expect(prisma.event.update).toHaveBeenCalledWith({
      where: { id: 10 },
      data: expect.objectContaining({ endsAt: null }),
    });
  });

  it("sets endsAt to the parsed date when a value is supplied", async () => {
    const prisma = {
      event: {
        count: jest.fn().mockResolvedValue(0),
        findUnique: jest.fn().mockResolvedValue({ id: 10, cityId: 1, regionId: 3 }),
        update: jest.fn().mockResolvedValue({ id: 10 }),
      },
    };
    const service = new EventsService(prisma as never, { detectForEvent: jest.fn() } as never, { revalidate: jest.fn().mockResolvedValue(true) } as never);

    await service.updateEvent(10, { endsAt: "2026-08-29T02:00:00.000Z" });

    expect(prisma.event.update).toHaveBeenCalledWith({
      where: { id: 10 },
      data: expect.objectContaining({ endsAt: new Date("2026-08-29T02:00:00.000Z") }),
    });
  });

  it("leaves endsAt untouched when omitted from the update payload", async () => {
    const prisma = {
      event: {
        count: jest.fn().mockResolvedValue(0),
        findUnique: jest.fn().mockResolvedValue({ id: 10 }),
        update: jest.fn().mockResolvedValue({ id: 10 }),
      },
    };
    const service = new EventsService(prisma as never, { detectForEvent: jest.fn() } as never, { revalidate: jest.fn().mockResolvedValue(true) } as never);

    await service.updateEvent(10, { title: "Renamed" });

    const data = prisma.event.update.mock.calls[0][0].data;
    expect("endsAt" in data).toBe(false);
  });

  it("sets publishedAt when update status publishes the event", async () => {
    jest.useFakeTimers().setSystemTime(new Date("2026-07-01T12:00:00.000Z"));
    const prisma = {
      event: {
        count: jest.fn().mockResolvedValue(0),
        findUnique: jest.fn().mockResolvedValue({ id: 10, cityId: 1, regionId: 3 }),
        update: jest.fn().mockResolvedValue({ id: 10 }),
      },
    };
    const service = new EventsService(prisma as never, { detectForEvent: jest.fn() } as never, { revalidate: jest.fn().mockResolvedValue(true) } as never);

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

  it("rejects publishing when location cannot be mapped to city and region", async () => {
    const prisma = {
      event: {
        count: jest.fn().mockResolvedValue(0),
        findUnique: jest.fn().mockResolvedValue({ id: 10, cityId: null, regionId: null }),
        update: jest.fn(),
      },
    };
    const service = new EventsService(prisma as never, { detectForEvent: jest.fn() } as never, { revalidate: jest.fn().mockResolvedValue(true) } as never);

    await expect(service.updateEvent(10, { status: "PUBLISHED" as never })).rejects.toThrow("Lokacija nije mapirana na grad/regiju.");
    expect(prisma.event.update).not.toHaveBeenCalled();
  });
});
