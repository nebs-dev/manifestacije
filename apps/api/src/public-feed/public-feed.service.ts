import { Injectable } from "@nestjs/common";
import { Prisma, EventStatus } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { currentWeekendRange } from "../common/weekend";
import { zagrebLocalToUtc } from "../common/weekend";

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
  occurrences: { orderBy: [{ startsAt: "asc" }, { id: "asc" }] },
} satisfies Prisma.EventInclude;

const eventListSelect = {
  slug: true,
  title: true,
  description: true,
  startsAt: true,
  endsAt: true,
  isAllDay: true,
  isFree: true,
  isFeatured: true,
  priceText: true,
  ticketUrl: true,
  sourceUrl: true,
  imageUrl: true,
  extractionConfidence: true,
  cityName: true,
  address: true,
  lat: true,
  lng: true,
  organizer: { select: { name: true, slug: true, status: true, websiteUrl: true } },
  venue: { select: { name: true, address: true, lat: true, lng: true } },
  city: { select: { name: true, slug: true, lat: true, lng: true } },
  county: { select: { name: true, slug: true } },
  region: { select: { name: true, slug: true } },
  category: { select: { slug: true, name: true } },
  categories: {
    select: { category: { select: { slug: true, name: true, sortOrder: true } } },
    orderBy: [{ category: { sortOrder: "asc" } }],
  },
  occurrences: {
    select: { id: true, startsAt: true, endsAt: true, isAllDay: true },
    orderBy: [{ startsAt: "asc" }, { id: "asc" }],
  },
} satisfies Prisma.EventSelect;

// Map pins/cards do not render descriptions, images, ticket/source metadata,
// organizer data, or full venue/taxonomy records. Keeping this response small
// reduces database materialization, JSON serialization, transfer, and parsing
// for every map regeneration without changing which events or coordinates are
// returned.
const eventMapSelect = {
  slug: true,
  title: true,
  startsAt: true,
  endsAt: true,
  isAllDay: true,
  isFree: true,
  priceText: true,
  cityName: true,
  lat: true,
  lng: true,
  venue: { select: { name: true, lat: true, lng: true } },
  city: { select: { name: true, slug: true, lat: true, lng: true } },
  region: { select: { slug: true } },
  category: { select: { slug: true, name: true } },
  categories: {
    select: { category: { select: { slug: true, name: true, sortOrder: true } } },
    orderBy: [{ category: { sortOrder: "asc" } }],
  },
  occurrences: {
    select: { id: true, startsAt: true, endsAt: true, isAllDay: true },
    orderBy: [{ startsAt: "asc" }, { id: "asc" }],
  },
} satisfies Prisma.EventSelect;

type PublicEventRow = Prisma.EventGetPayload<{ select: typeof eventListSelect }>;

@Injectable()
export class PublicFeedService {
  constructor(private readonly prisma: PrismaService) {}

  async events(query: Record<string, string | undefined>) {
    const search = query.search?.trim();
    const where = await this.publicWhere(query, { includeSearch: false });
    const events = await this.prisma.event.findMany({ where, select: eventListSelect, orderBy: { startsAt: "asc" }, take: search ? 1000 : 500 });
    if (!search) return events;
    return this.rankSearchResults(events, search).slice(0, 500);
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
      select: eventMapSelect,
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

  private async publicWhere(query: Record<string, string | undefined>, options: { includeSearch?: boolean } = {}): Promise<Prisma.EventWhereInput> {
    const where: Prisma.EventWhereInput = { status: EventStatus.PUBLISHED };
    const now = new Date();
    this.addAnd(where, this.publicVisibilityWhere(now));

    if (query.region) where.region = { slug: query.region };
    if (query.county) where.county = { slug: query.county };
    if (query.city) where.city = { slug: query.city };
    if (query.free === "true") where.isFree = true;
    if (options.includeSearch !== false && query.search) {
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
      const { start, end } = this.zagrebDayRange(now);
      this.addAnd(where, this.periodOverlapWhere(start, end));
    } else if (query.weekend === "true") {
      const { start, end } = currentWeekendRange(now);
      this.addAnd(where, this.periodOverlapWhere(start, end));
    } else if (query.month === "true") {
      const parts = this.zagrebParts(now);
      const start = zagrebLocalToUtc(parts.year, parts.month, 1);
      const lastDay = new Date(Date.UTC(parts.year, parts.month, 0)).getUTCDate();
      const end = zagrebLocalToUtc(parts.year, parts.month, lastDay, 23, 59, 59, 999);
      this.addAnd(where, this.periodOverlapWhere(start, end));
    } else if (query.dateFrom || query.dateTo) {
      const start = query.dateFrom ? this.zagrebDateBoundary(query.dateFrom, "start") : new Date(0);
      const end = query.dateTo ? this.zagrebDateBoundary(query.dateTo, "end") : new Date("9999-12-31T23:59:59.999Z");
      this.addAnd(where, this.periodOverlapWhere(start, end));
    }
    return where;
  }

  // Event overlaps with [periodStart, periodEnd] if it starts before period ends
  // AND (ends after period starts, or is a single-day event starting within the period).
  private periodOverlapWhere(periodStart: Date, periodEnd: Date): Prisma.EventWhereInput {
    const overlap = {
      startsAt: { lte: periodEnd },
      OR: [
        { endsAt: { gte: periodStart } },
        { endsAt: null, startsAt: { gte: periodStart } },
      ],
    } satisfies Prisma.EventOccurrenceWhereInput;
    return {
      OR: [
        { occurrences: { some: overlap } },
        {
          AND: [
            { occurrences: { none: {} } },
            {
              startsAt: { lte: periodEnd },
              OR: [
                { endsAt: { gte: periodStart } },
                { endsAt: null, startsAt: { gte: periodStart } },
              ],
            },
          ],
        },
      ],
    };
  }

  private publicVisibilityWhere(now: Date): Prisma.EventWhereInput {
    return {
      OR: [
        {
          occurrences: {
            some: {
              OR: [
                { endsAt: { gte: now } },
                { endsAt: null, startsAt: { gte: now } },
              ],
            },
          },
        },
        {
          AND: [
            { occurrences: { none: {} } },
            {
              OR: [
                { endsAt: { gte: now } },
                { endsAt: null, startsAt: { gte: now } },
              ],
            },
          ],
        },
      ],
    };
  }

  private zagrebParts(date: Date) {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/Zagreb",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(date);
    const value = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? 0);
    return { year: value("year"), month: value("month"), day: value("day") };
  }

  private zagrebDayRange(date: Date) {
    const parts = this.zagrebParts(date);
    return {
      start: zagrebLocalToUtc(parts.year, parts.month, parts.day),
      end: zagrebLocalToUtc(parts.year, parts.month, parts.day, 23, 59, 59, 999),
    };
  }

  private zagrebDateBoundary(value: string, boundary: "start" | "end") {
    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return new Date(value);
    return zagrebLocalToUtc(
      Number(match[1]),
      Number(match[2]),
      Number(match[3]),
      boundary === "start" ? 0 : 23,
      boundary === "start" ? 0 : 59,
      boundary === "start" ? 0 : 59,
      boundary === "start" ? 0 : 999,
    );
  }

  private addAnd(where: Prisma.EventWhereInput, clause: Prisma.EventWhereInput) {
    where.AND = [...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []), clause];
  }

  private normalizeSearch(term: string): string {
    return term
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/đ/g, "d")
      .replace(/ð/g, "d")
      .replace(/[^a-z0-9]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  private rankSearchResults(events: PublicEventRow[], rawSearch: string): PublicEventRow[] {
    const query = this.normalizeSearch(rawSearch);
    const queryTokens = [...new Set(query.split(" ").filter((token) => token.length >= 2))];
    if (queryTokens.length === 0) return events;

    return events
      .map((event) => ({ event, score: this.searchScore(event, query, queryTokens) }))
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score || a.event.startsAt.getTime() - b.event.startsAt.getTime())
      .map((item) => item.event);
  }

  private searchScore(event: PublicEventRow, query: string, queryTokens: string[]) {
    const weightedFields: Array<[unknown, number]> = [
      [event.title, 8],
      [event.organizer?.name, 6],
      [event.city?.name, 6],
      [event.cityName, 6],
      [event.venue?.name, 5],
      [event.category?.name, 5],
      [event.categories.map((item) => item.category.name).join(" "), 5],
      [event.region?.name, 4],
      [event.county?.name, 4],
      [event.address, 3],
      [event.venue?.address, 3],
      [event.description, 2],
      [event.priceText, 1],
      [event.sourceUrl, 1],
      [event.organizer?.websiteUrl, 1],
      [event.city?.slug, 2],
      [event.region?.slug, 2],
      [event.county?.slug, 2],
      [event.category?.slug, 2],
      [event.categories.map((item) => item.category.slug).join(" "), 2],
    ];
    const searchableParts = weightedFields
      .map(([value]) => Array.isArray(value) ? value.join(" ") : String(value ?? ""))
      .filter(Boolean);
    const corpus = this.normalizeSearch(searchableParts.join(" "));
    if (!corpus) return 0;
    const corpusTokens = [...new Set(corpus.split(" ").filter((token) => token.length >= 2))];

    let score = 0;
    for (const token of queryTokens) {
      const tokenScore = this.bestTokenScore(token, corpus, corpusTokens);
      if (tokenScore === 0) return 0;
      score += tokenScore;
    }
    if (corpus.includes(query)) score += 80;

    for (const [value, weight] of weightedFields) {
      const normalizedValue = this.normalizeSearch(String(value ?? ""));
      if (!normalizedValue) continue;
      if (normalizedValue.includes(query)) score += weight * 20;
      else if (queryTokens.some((token) => normalizedValue.includes(token))) score += weight * 5;
    }

    return score;
  }

  private bestTokenScore(queryToken: string, corpus: string, corpusTokens: string[]) {
    if (corpus.includes(queryToken)) return 40 + Math.min(queryToken.length, 12);

    const maxDistance = queryToken.length <= 4 ? 1 : Math.max(1, Math.floor(queryToken.length * 0.25));
    let best = 0;
    for (const token of corpusTokens) {
      if (Math.abs(token.length - queryToken.length) > maxDistance) continue;
      const distance = this.levenshtein(queryToken, token, maxDistance);
      if (distance <= maxDistance) best = Math.max(best, 24 - distance * 6);
    }
    return best;
  }

  private levenshtein(a: string, b: string, maxDistance: number) {
    if (a === b) return 0;
    if (Math.abs(a.length - b.length) > maxDistance) return maxDistance + 1;

    let previous = Array.from({ length: b.length + 1 }, (_, index) => index);
    for (let i = 1; i <= a.length; i += 1) {
      const current = [i];
      let rowMin = current[0];
      for (let j = 1; j <= b.length; j += 1) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        current[j] = Math.min(
          current[j - 1] + 1,
          previous[j] + 1,
          previous[j - 1] + cost,
        );
        rowMin = Math.min(rowMin, current[j]);
      }
      if (rowMin > maxDistance) return maxDistance + 1;
      previous = current;
    }
    return previous[b.length];
  }
}
