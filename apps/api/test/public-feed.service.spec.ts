import { EventStatus } from "@prisma/client";
import { PublicFeedService } from "../src/public-feed/public-feed.service";

describe("PublicFeedService", () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it("queries only published public events", async () => {
    jest.useFakeTimers().setSystemTime(new Date("2026-07-03T12:00:00.000Z"));
    const prisma = { event: { findMany: jest.fn().mockResolvedValue([]) } };
    const service = new PublicFeedService(prisma as never);

    await service.events({});

    expect(prisma.event.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        status: EventStatus.PUBLISHED,
        AND: [{
          OR: [
            { endsAt: { gte: new Date("2026-07-03T12:00:00.000Z") } },
            { endsAt: null, startsAt: { gte: new Date("2026-07-03T12:00:00.000Z") } },
          ],
        }],
      },
    }));
  });

  it("builds region, city, free and search filters", async () => {
    jest.useFakeTimers().setSystemTime(new Date("2026-07-03T12:00:00.000Z"));
    const prisma = { event: { findMany: jest.fn().mockResolvedValue([]) } };
    const service = new PublicFeedService(prisma as never);

    await service.events({ region: "slavonija-i-baranja", city: "osijek", free: "true", search: "koncert" });

    expect(prisma.event.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        status: EventStatus.PUBLISHED,
        region: { slug: "slavonija-i-baranja" },
        city: { slug: "osijek" },
        isFree: true,
        OR: expect.arrayContaining([
          { title: { contains: "koncert", mode: "insensitive" } },
          { description: { contains: "koncert", mode: "insensitive" } },
          { city: { name: { contains: "koncert", mode: "insensitive" } } },
          { venue: { name: { contains: "koncert", mode: "insensitive" } } },
        ]),
      }),
    }));
  });

  it("filters category through legacy category and EventCategory join", async () => {
    const prisma = { event: { findMany: jest.fn().mockResolvedValue([]) } };
    const service = new PublicFeedService(prisma as never);

    await service.events({ category: "glazba" });

    expect(prisma.event.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        AND: expect.arrayContaining([
          {
            OR: [
              { category: { slug: "glazba" } },
              { categories: { some: { category: { slug: "glazba" } } } },
            ],
          },
        ]),
      }),
    }));
  });

  it("hides past event detail, map events and sitemap events", async () => {
    jest.useFakeTimers().setSystemTime(new Date("2026-07-03T12:00:00.000Z"));
    const prisma = {
      event: {
        findFirst: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
      },
      region: { findMany: jest.fn().mockResolvedValue([]) },
      city: { findMany: jest.fn().mockResolvedValue([]) },
      category: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const service = new PublicFeedService(prisma as never);

    await service.event("event-slug");
    await service.mapEvents();
    await service.sitemapData();

    const visibility = {
      OR: [
        { endsAt: { gte: new Date("2026-07-03T12:00:00.000Z") } },
        { endsAt: null, startsAt: { gte: new Date("2026-07-03T12:00:00.000Z") } },
      ],
    };
    expect(prisma.event.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ slug: "event-slug", status: EventStatus.PUBLISHED, AND: [visibility] }),
    }));
    expect(prisma.event.findMany.mock.calls[0][0].where).toEqual({ status: EventStatus.PUBLISHED, AND: [visibility] });
    expect(prisma.event.findMany.mock.calls[1][0]).toEqual({
      where: { status: EventStatus.PUBLISHED, AND: [visibility] },
      select: { slug: true, updatedAt: true },
    });
  });

  it("builds today, weekend and explicit date range filters deterministically", async () => {
    jest.useFakeTimers().setSystemTime(new Date(2026, 6, 1, 12, 0, 0, 0));
    const prisma = { event: { findMany: jest.fn().mockResolvedValue([]) } };
    const service = new PublicFeedService(prisma as never);

    await service.events({ today: "true" });
    expect(prisma.event.findMany.mock.calls[0][0].where.startsAt).toEqual({
      gte: new Date(2026, 6, 1, 0, 0, 0, 0),
      lte: new Date(2026, 6, 1, 23, 59, 59, 999),
    });

    await service.events({ weekend: "true" });
    expect(prisma.event.findMany.mock.calls[1][0].where.startsAt).toEqual({
      gte: new Date(2026, 6, 4, 0, 0, 0, 0),
      lte: new Date(2026, 6, 5, 23, 59, 59, 999),
    });

    await service.events({ month: "true" });
    expect(prisma.event.findMany.mock.calls[2][0].where.startsAt).toEqual({
      gte: new Date(2026, 6, 1, 0, 0, 0, 0),
      lte: new Date(2026, 6, 31, 23, 59, 59, 999),
    });

    await service.events({ dateFrom: "2026-08-01", dateTo: "2026-08-31" });
    expect(prisma.event.findMany.mock.calls[3][0].where.startsAt).toEqual({
      gte: new Date("2026-08-01"),
      lte: new Date("2026-08-31"),
    });
  });

  it("returns sitemap data for published events and taxonomy", async () => {
    jest.useFakeTimers().setSystemTime(new Date("2026-07-03T12:00:00.000Z"));
    const prisma = {
      event: { findMany: jest.fn().mockResolvedValue([{ slug: "event", updatedAt: new Date("2026-07-01") }]) },
      region: { findMany: jest.fn().mockResolvedValue([{ slug: "slavonija" }]) },
      city: { findMany: jest.fn().mockResolvedValue([{ slug: "osijek" }]) },
      category: { findMany: jest.fn().mockResolvedValue([{ slug: "glazba" }]) },
    };
    const service = new PublicFeedService(prisma as never);

    const data = await service.sitemapData();

    expect(prisma.event.findMany).toHaveBeenCalledWith({
      where: {
        status: EventStatus.PUBLISHED,
        AND: [{
          OR: [
            { endsAt: { gte: new Date("2026-07-03T12:00:00.000Z") } },
            { endsAt: null, startsAt: { gte: new Date("2026-07-03T12:00:00.000Z") } },
          ],
        }],
      },
      select: { slug: true, updatedAt: true },
    });
    expect(data.events).toHaveLength(1);
    expect(data.regions).toHaveLength(1);
    expect(data.cities).toHaveLength(1);
    expect(data.categories).toHaveLength(1);
  });
});
