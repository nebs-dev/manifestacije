import { Injectable } from "@nestjs/common";
import { Prisma, EventStatus } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { currentWeekendRange } from "../common/weekend";

const eventInclude = {
  organizer: true,
  venue: true,
  city: true,
  county: true,
  region: true,
  category: true,
  categories: {
    include: { category: true },
    orderBy: [{ category: { sortOrder: "asc" } }],
  },
} satisfies Prisma.EventInclude;

@Injectable()
export class PublicFeedService {
  constructor(private readonly prisma: PrismaService) {}

  async events(query: Record<string, string | undefined>) {
    const where = await this.publicWhere(query);
    return this.prisma.event.findMany({ where, include: eventInclude, orderBy: { startsAt: "asc" }, take: 500 });
  }

  async event(slug: string) {
    return this.prisma.event.findFirst({
      where: {
        slug,
        status: EventStatus.PUBLISHED,
        AND: [this.publicVisibilityWhere(new Date())],
      },
      include: eventInclude,
    });
  }

  /** Only the fields needed for the public claim-request page header — never
   *  the organizer's email, which the claim flow must not reveal. */
  organizerBySlug(slug: string) {
    return this.prisma.organizer.findUnique({
      where: { slug },
      select: { id: true, name: true, slug: true, status: true },
    });
  }

  regions() {
    return this.prisma.region.findMany({ orderBy: { sortOrder: "asc" } });
  }

  cities() {
    return this.prisma.city.findMany({ include: { county: { include: { region: true } } }, orderBy: { name: "asc" } });
  }

  categories() {
    return this.prisma.category.findMany({ orderBy: { sortOrder: "asc" } });
  }

  partners() {
    return this.prisma.partner.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" } });
  }

  async byRegion(slug: string) {
    return this.events({ region: slug });
  }

  async byCity(slug: string) {
    return this.events({ city: slug });
  }

  async byCategory(slug: string) {
    return this.events({ category: slug });
  }

  async mapEvents() {
    return this.prisma.event.findMany({
      where: { status: EventStatus.PUBLISHED, AND: [this.publicVisibilityWhere(new Date())] },
      include: eventInclude,
      orderBy: { startsAt: "asc" },
      take: 200
    });
  }

  async sitemapData() {
    const visibleEventWhere: Prisma.EventWhereInput = { status: EventStatus.PUBLISHED, AND: [this.publicVisibilityWhere(new Date())] };
    const weekend = currentWeekendRange(new Date());
    const weekendEventWhere: Prisma.EventWhereInput = {
      ...visibleEventWhere,
      AND: [
        this.publicVisibilityWhere(new Date()),
        this.periodOverlapWhere(weekend.start, weekend.end),
      ],
    };
    // Only list taxonomy pages that currently have at least one visible event —
    // empty listing pages are noindexed (see web app/*/[slug]/page.tsx) and
    // shouldn't be submitted to crawlers via the sitemap either.
    const [events, regions, cities, categories, comboEvents, weekendCities, weekendRegions] = await Promise.all([
      this.prisma.event.findMany({
        where: visibleEventWhere,
        select: { slug: true, updatedAt: true },
      }),
      this.prisma.region.findMany({ where: { events: { some: visibleEventWhere } }, select: { slug: true } }),
      this.prisma.city.findMany({ where: { events: { some: visibleEventWhere } }, select: { slug: true } }),
      this.prisma.category.findMany({
        where: { OR: [{ events: { some: visibleEventWhere } }, { eventCats: { some: { event: visibleEventWhere } } }] },
        select: { slug: true },
      }),
      this.prisma.event.findMany({
        where: visibleEventWhere,
        select: {
          city: { select: { slug: true } },
          region: { select: { slug: true } },
          category: { select: { slug: true } },
          categories: { select: { category: { select: { slug: true } } } },
        },
      }),
      this.prisma.city.findMany({ where: { events: { some: weekendEventWhere } }, select: { slug: true } }),
      this.prisma.region.findMany({ where: { events: { some: weekendEventWhere } }, select: { slug: true } }),
    ]);
    const cityCategoryKeys = new Set<string>();
    const regionCategoryKeys = new Set<string>();

    for (const event of comboEvents) {
      const categorySlugs = new Set([
        event.category?.slug,
        ...event.categories.map((eventCategory) => eventCategory.category.slug),
      ].filter((slug): slug is string => Boolean(slug)));

      for (const categorySlug of categorySlugs) {
        if (event.city?.slug) cityCategoryKeys.add(`${event.city.slug}::${categorySlug}`);
        if (event.region?.slug) regionCategoryKeys.add(`${event.region.slug}::${categorySlug}`);
      }
    }

    const cityCategories = [...cityCategoryKeys].sort().map((key) => {
      const [citySlug, categorySlug] = key.split("::");
      return { citySlug, categorySlug };
    });
    const regionCategories = [...regionCategoryKeys].sort().map((key) => {
      const [regionSlug, categorySlug] = key.split("::");
      return { regionSlug, categorySlug };
    });

    return { events, regions, cities, categories, cityCategories, regionCategories, weekendCities, weekendRegions };
  }

  private async publicWhere(query: Record<string, string | undefined>): Promise<Prisma.EventWhereInput> {
    const where: Prisma.EventWhereInput = { status: EventStatus.PUBLISHED };
    const now = new Date();
    this.addAnd(where, this.publicVisibilityWhere(now));

    if (query.region) where.region = { slug: query.region };
    if (query.county) where.county = { slug: query.county };
    if (query.city) where.city = { slug: query.city };
    if (query.free === "true") where.isFree = true;
    if (query.search) {
      const norm = this.normalizeSearch(query.search);
      const textClauses = (term: string): Prisma.EventWhereInput[] => [
        { title: { contains: term, mode: "insensitive" } },
        { description: { contains: term, mode: "insensitive" } },
        { cityName: { contains: term, mode: "insensitive" } },
        { address: { contains: term, mode: "insensitive" } },
        { priceText: { contains: term, mode: "insensitive" } },
        { sourceUrl: { contains: term, mode: "insensitive" } },
        { organizer: { name: { contains: term, mode: "insensitive" } } },
        { organizer: { slug: { contains: term, mode: "insensitive" } } },
        { organizer: { websiteUrl: { contains: term, mode: "insensitive" } } },
        { city: { name: { contains: term, mode: "insensitive" } } },
        { city: { slug: { contains: term, mode: "insensitive" } } },
        { venue: { name: { contains: term, mode: "insensitive" } } },
        { venue: { address: { contains: term, mode: "insensitive" } } },
        { county: { name: { contains: term, mode: "insensitive" } } },
        { county: { slug: { contains: term, mode: "insensitive" } } },
        { region: { name: { contains: term, mode: "insensitive" } } },
        { region: { slug: { contains: term, mode: "insensitive" } } },
        { category: { name: { contains: term, mode: "insensitive" } } },
        { category: { slug: { contains: term, mode: "insensitive" } } },
        { categories: { some: { category: { name: { contains: term, mode: "insensitive" } } } } },
        { categories: { some: { category: { slug: { contains: term, mode: "insensitive" } } } } },
      ];
      where.OR = norm !== query.search.toLowerCase()
        ? [...textClauses(query.search), ...textClauses(norm)]
        : textClauses(query.search);
    }

    // Category filter: check both legacy categoryId relation and new EventCategory join.
    // During migration transition both paths must work.
    if (query.category) {
      this.addAnd(where, {
        OR: [
          { category: { slug: query.category } },
          { categories: { some: { category: { slug: query.category } } } }
        ]
      });
    }

    if (query.today === "true") {
      const start = new Date(now);
      const end = new Date(now);
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      this.addAnd(where, this.periodOverlapWhere(start, end));
    } else if (query.weekend === "true") {
      const { start, end } = currentWeekendRange(now);
      this.addAnd(where, this.periodOverlapWhere(start, end));
    } else if (query.month === "true") {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
      this.addAnd(where, this.periodOverlapWhere(start, end));
    } else if (query.dateFrom || query.dateTo) {
      where.startsAt = {
        gte: query.dateFrom ? new Date(query.dateFrom) : undefined,
        lte: query.dateTo ? new Date(query.dateTo) : undefined
      };
    }
    return where;
  }

  // Event overlaps with [periodStart, periodEnd] if it starts before period ends
  // AND (ends after period starts, or is a single-day event starting within the period).
  private periodOverlapWhere(periodStart: Date, periodEnd: Date): Prisma.EventWhereInput {
    return {
      startsAt: { lte: periodEnd },
      OR: [
        { endsAt: { gte: periodStart } },
        { endsAt: null, startsAt: { gte: periodStart } },
      ],
    };
  }

  private publicVisibilityWhere(now: Date): Prisma.EventWhereInput {
    return {
      OR: [
        { endsAt: { gte: now } },
        { endsAt: null, startsAt: { gte: now } },
      ],
    };
  }

  private addAnd(where: Prisma.EventWhereInput, clause: Prisma.EventWhereInput) {
    where.AND = [...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []), clause];
  }

  private normalizeSearch(term: string): string {
    return term
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/đ/g, "d")
      .replace(/ð/g, "d");
  }
}
