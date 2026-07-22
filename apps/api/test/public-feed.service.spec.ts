import { EventStatus } from "@prisma/client";
import { currentWeekendRange } from "../src/common/weekend";
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
          { organizer: { name: { contains: "koncert", mode: "insensitive" } } },
          { category: { name: { contains: "koncert", mode: "insensitive" } } },
          { categories: { some: { category: { name: { contains: "koncert", mode: "insensitive" } } } } },
          { region: { name: { contains: "koncert", mode: "insensitive" } } },
          { county: { name: { contains: "koncert", mode: "insensitive" } } },
          { address: { contains: "koncert", mode: "insensitive" } },
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
    const now = new Date("2026-07-01T10:00:00.000Z");
    jest.useFakeTimers().setSystemTime(now);
    const prisma = { event: { findMany: jest.fn().mockResolvedValue([]) } };
    const service = new PublicFeedService(prisma as never);

    const overlap = (start: Date, end: Date) => ({
      startsAt: { lte: end },
      OR: [{ endsAt: { gte: start } }, { endsAt: null, startsAt: { gte: start } }],
    });

    await service.events({ today: "true" });
    expect(prisma.event.findMany.mock.calls[0][0].where.AND).toEqual(expect.arrayContaining([
      overlap(new Date(2026, 6, 1, 0, 0, 0, 0), new Date(2026, 6, 1, 23, 59, 59, 999)),
    ]));

    await service.events({ weekend: "true" });
    const weekend = currentWeekendRange(now);
    expect(prisma.event.findMany.mock.calls[1][0].where.AND).toEqual(expect.arrayContaining([
      overlap(weekend.start, weekend.end),
    ]));

    await service.events({ month: "true" });
    expect(prisma.event.findMany.mock.calls[2][0].where.AND).toEqual(expect.arrayContaining([
      overlap(new Date(2026, 6, 1, 0, 0, 0, 0), new Date(2026, 6, 31, 23, 59, 59, 999)),
    ]));

    await service.events({ dateFrom: "2026-08-01", dateTo: "2026-08-31" });
    expect(prisma.event.findMany.mock.calls[3][0].where.startsAt).toEqual({
      gte: new Date("2026-08-01"),
      lte: new Date("2026-08-31"),
    });
  });

  it("returns sitemap data for published events and taxonomy", async () => {
    jest.useFakeTimers().setSystemTime(new Date("2026-07-03T12:00:00.000Z"));
    const prisma = {
      event: {
        findMany: jest.fn()
          .mockResolvedValueOnce([{ slug: "event", updatedAt: new Date("2026-07-01") }])
          .mockResolvedValueOnce([
            {
              city: { slug: "osijek" },
              region: { slug: "slavonija-i-baranja" },
              category: { slug: "glazba" },
              categories: [{ category: { slug: "festivali" } }],
            },
          ]),
      },
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
    expect(data.cityCategories).toEqual([
      { citySlug: "osijek", categorySlug: "festivali" },
      { citySlug: "osijek", categorySlug: "glazba" },
    ]);
    expect(data.regionCategories).toEqual([
      { regionSlug: "slavonija-i-baranja", categorySlug: "festivali" },
      { regionSlug: "slavonija-i-baranja", categorySlug: "glazba" },
    ]);
  });
});
