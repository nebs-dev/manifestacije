import { Injectable } from "@nestjs/common";
import { Prisma, EventStatus } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

const eventInclude = {
  organizer: true,
  venue: true,
  city: true,
  county: true,
  region: true,
  category: true,
  categories: {
    include: { category: true },
    orderBy: [{ isPrimary: "desc" }, { category: { sortOrder: "asc" } }],
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

  regions() {
    return this.prisma.region.findMany({ orderBy: { sortOrder: "asc" } });
  }

  cities() {
    return this.prisma.city.findMany({ include: { county: { include: { region: true } } }, orderBy: { name: "asc" } });
  }

  categories() {
    return this.prisma.category.findMany({ orderBy: { sortOrder: "asc" } });
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
    const [events, regions, cities, categories] = await Promise.all([
      this.prisma.event.findMany({
        where: { status: EventStatus.PUBLISHED, AND: [this.publicVisibilityWhere(new Date())] },
        select: { slug: true, updatedAt: true },
      }),
      this.prisma.region.findMany({ select: { slug: true } }),
      this.prisma.city.findMany({ select: { slug: true } }),
      this.prisma.category.findMany({ select: { slug: true } })
    ]);
    return { events, regions, cities, categories };
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
        { city: { name: { contains: term, mode: "insensitive" } } },
        { city: { slug: { contains: term, mode: "insensitive" } } },
        { venue: { name: { contains: term, mode: "insensitive" } } },
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
      const start = new Date(now);
      const day = start.getDay();
      const daysUntilSaturday = (6 - day + 7) % 7;
      start.setDate(start.getDate() + daysUntilSaturday);
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setDate(start.getDate() + 1);
      end.setHours(23, 59, 59, 999);
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
