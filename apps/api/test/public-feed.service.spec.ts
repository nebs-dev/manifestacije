import { EventStatus } from "@prisma/client";
import { currentWeekendRange } from "../src/common/weekend";
import { PublicFeedService } from "../src/public-feed/public-feed.service";

const legacyVisibility = (now: Date) => ({
  OR: [{ endsAt: { gt: now } }, { endsAt: null, startsAt: { gte: now } }],
});

const visibility = (now: Date) => ({
  OR: [
    { occurrences: { some: legacyVisibility(now) } },
    { AND: [{ occurrences: { none: {} } }, legacyVisibility(now)] },
  ],
});

const occurrenceOverlap = (start: Date, end: Date) => {
  const overlap = {
    startsAt: { lte: end },
    OR: [{ endsAt: { gt: start } }, { endsAt: null, startsAt: { gte: start } }],
  };
  return {
    OR: [
      { occurrences: { some: overlap } },
      { AND: [{ occurrences: { none: {} } }, overlap] },
    ],
  };
};

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
        AND: [visibility(new Date("2026-07-03T12:00:00.000Z"))],
      },
    }));
  });

  it("builds region, city and free filters before application-level search", async () => {
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
      }),
    }));
  });

  it("searches without Croatian diacritics and tolerates one-letter typos", async () => {
    jest.useFakeTimers().setSystemTime(new Date("2026-07-03T12:00:00.000Z"));
    const rows = [
      {
        id: 1,
        title: "Đakovački vezovi",
        description: "Folklorni program",
        startsAt: new Date("2026-07-05T18:00:00.000Z"),
        cityName: "Đakovo",
        address: "Strossmayerov trg, Đakovo",
        priceText: null,
        sourceUrl: null,
        organizer: { name: "TZ Đakovo", slug: "tz-dakovo", websiteUrl: null },
        venue: { name: "Centar za kulturu Đakovo", address: "Đakovo" },
        city: { name: "Đakovo", slug: "dakovo" },
        county: { name: "Osječko-baranjska", slug: "osjecko-baranjska" },
        region: { name: "Slavonija i Baranja", slug: "slavonija-i-baranja" },
        category: { name: "Manifestacije", slug: "manifestacije" },
        categories: [],
      },
      {
        id: 2,
        title: "Koncert u Osijeku",
        description: "Glazbeni program",
        startsAt: new Date("2026-07-06T18:00:00.000Z"),
        cityName: "Osijek",
        address: "Tvrđa, Osijek",
        priceText: null,
        sourceUrl: null,
        organizer: { name: "Organizator", slug: "organizator", websiteUrl: null },
        venue: { name: "Tvrđa", address: "Osijek" },
        city: { name: "Osijek", slug: "osijek" },
        county: { name: "Osječko-baranjska", slug: "osjecko-baranjska" },
        region: { name: "Slavonija i Baranja", slug: "slavonija-i-baranja" },
        category: { name: "Glazba", slug: "glazba" },
        categories: [],
      },
    ];
    const prisma = { event: { findMany: jest.fn().mockResolvedValue(rows) } };
    const service = new PublicFeedService(prisma as never);

    await expect(service.events({ search: "Dakovo" })).resolves.toEqual([rows[0]]);
    await expect(service.events({ search: "Osjek" })).resolves.toEqual([rows[1]]);
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

  it("keeps historical detail accessible while hiding past events from map and sitemap", async () => {
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

    const visible = visibility(new Date("2026-07-03T12:00:00.000Z"));
    expect(prisma.event.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        slug: "event-slug",
        OR: [
          { status: EventStatus.PUBLISHED },
          { status: EventStatus.ARCHIVED, publishedAt: { not: null } },
        ],
      },
    }));
    const mapQuery = prisma.event.findMany.mock.calls[0][0];
    expect(mapQuery.where).toEqual({ status: EventStatus.PUBLISHED, AND: [visible] });
    expect(mapQuery).not.toHaveProperty("include");
    expect(mapQuery.select).toEqual(expect.objectContaining({
      slug: true,
      title: true,
      startsAt: true,
      lat: true,
      lng: true,
      occurrences: expect.any(Object),
    }));
    expect(mapQuery.select).not.toHaveProperty("description");
    expect(mapQuery.select).not.toHaveProperty("imageUrl");
    expect(prisma.event.findMany.mock.calls[1][0]).toEqual({
      where: { status: EventStatus.PUBLISHED, AND: [visible] },
      select: { slug: true, updatedAt: true },
    });
  });

  it("builds today, weekend and explicit date range filters deterministically", async () => {
    const now = new Date("2026-07-01T10:00:00.000Z");
    jest.useFakeTimers().setSystemTime(now);
    const prisma = { event: { findMany: jest.fn().mockResolvedValue([]) } };
    const service = new PublicFeedService(prisma as never);

    await service.events({ today: "true" });
    expect(prisma.event.findMany.mock.calls[0][0].where.AND).toEqual(expect.arrayContaining([
      occurrenceOverlap(new Date("2026-06-30T22:00:00.000Z"), new Date("2026-07-01T21:59:59.999Z")),
    ]));

    await service.events({ weekend: "true" });
    const weekend = currentWeekendRange(now);
    expect(prisma.event.findMany.mock.calls[1][0].where.AND).toEqual(expect.arrayContaining([
      occurrenceOverlap(weekend.start, weekend.end),
    ]));

    await service.events({ month: "true" });
    expect(prisma.event.findMany.mock.calls[2][0].where.AND).toEqual(expect.arrayContaining([
      occurrenceOverlap(new Date("2026-06-30T22:00:00.000Z"), new Date("2026-07-31T21:59:59.999Z")),
    ]));

    await service.events({ dateFrom: "2026-08-01", dateTo: "2026-08-31" });
    expect(prisma.event.findMany.mock.calls[3][0].where.AND).toEqual(expect.arrayContaining([
      occurrenceOverlap(new Date("2026-07-31T22:00:00.000Z"), new Date("2026-08-31T21:59:59.999Z")),
    ]));
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
        AND: [visibility(new Date("2026-07-03T12:00:00.000Z"))],
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
    expect(data.weekendCities).toEqual([{ slug: "osijek" }]);
    expect(data.weekendRegions).toEqual([{ slug: "slavonija" }]);
  });
});
