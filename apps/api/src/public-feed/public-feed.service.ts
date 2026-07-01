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
  categories: { include: { category: true } },
} satisfies Prisma.EventInclude;

@Injectable()
export class PublicFeedService {
  constructor(private readonly prisma: PrismaService) {}

  async events(query: Record<string, string | undefined>) {
    const where = await this.publicWhere(query);
    return this.prisma.event.findMany({ where, include: eventInclude, orderBy: { startsAt: "asc" }, take: 100 });
  }

  async event(slug: string) {
    return this.prisma.event.findFirst({ where: { slug, status: EventStatus.PUBLISHED }, include: eventInclude });
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
      where: { status: EventStatus.PUBLISHED },
      include: eventInclude,
      orderBy: { startsAt: "asc" },
      take: 200
    });
  }

  async sitemapData() {
    const [events, regions, cities, categories] = await Promise.all([
      this.prisma.event.findMany({ where: { status: EventStatus.PUBLISHED }, select: { slug: true, updatedAt: true } }),
      this.prisma.region.findMany({ select: { slug: true } }),
      this.prisma.city.findMany({ select: { slug: true } }),
      this.prisma.category.findMany({ select: { slug: true } })
    ]);
    return { events, regions, cities, categories };
  }

  private async publicWhere(query: Record<string, string | undefined>): Promise<Prisma.EventWhereInput> {
    const where: Prisma.EventWhereInput = { status: EventStatus.PUBLISHED };
    if (query.region) where.region = { slug: query.region };
    if (query.county) where.county = { slug: query.county };
    if (query.city) where.city = { slug: query.city };
    if (query.free === "true") where.isFree = true;
    if (query.search) {
      where.OR = [
        { title: { contains: query.search, mode: "insensitive" } },
        { description: { contains: query.search, mode: "insensitive" } }
      ];
    }

    // Category filter: check both legacy categoryId relation and new EventCategory join.
    // During migration transition both paths must work.
    if (query.category) {
      where.AND = [
        {
          OR: [
            { category: { slug: query.category } },
            { categories: { some: { category: { slug: query.category } } } }
          ]
        }
      ];
    }

    const now = new Date();
    if (query.today === "true") {
      const end = new Date(now);
      end.setHours(23, 59, 59, 999);
      now.setHours(0, 0, 0, 0);
      where.startsAt = { gte: now, lte: end };
    } else if (query.weekend === "true") {
      const start = new Date(now);
      const day = start.getDay();
      const daysUntilSaturday = (6 - day + 7) % 7;
      start.setDate(start.getDate() + daysUntilSaturday);
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setDate(start.getDate() + 1);
      end.setHours(23, 59, 59, 999);
      where.startsAt = { gte: start, lte: end };
    } else if (query.dateFrom || query.dateTo) {
      where.startsAt = {
        gte: query.dateFrom ? new Date(query.dateFrom) : undefined,
        lte: query.dateTo ? new Date(query.dateTo) : undefined
      };
    }
    return where;
  }
}
