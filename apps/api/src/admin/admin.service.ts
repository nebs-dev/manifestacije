import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { EventStatus, EventSourceType, OrganizerStatus } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { slugify, uniqueSlug } from "../common/slug";
import { EventsService } from "../events/events.service";
import { AiEventParserService, ParsedEventCandidate, ParsedSourceResult } from "../ai-parser/ai-event-parser.service";
import { DuplicatesService } from "../duplicates/duplicates.service";
import { AdminEventDto, CandidateOverrideDto, ManualEmailDto, OrganizerAdminDto, ParseUrlDto, UpdateEventSourceDto } from "./admin.dto";

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventsService,
    private readonly parser: AiEventParserService,
    private readonly duplicates: DuplicatesService
  ) {}

  async pendingCounts(since?: string) {
    const sinceDate = since ? new Date(since) : undefined;
    const [sources, events] = await Promise.all([
      this.prisma.eventSource.count({
        where: {
          status: { in: ["NEW", "PARSED", "NEEDS_REVIEW"] },
          ...(sinceDate ? { createdAt: { gte: sinceDate } } : {}),
        },
      }),
      this.prisma.event.count({
        where: {
          status: EventStatus.PENDING_REVIEW,
          ...(sinceDate ? { createdAt: { gte: sinceDate } } : {}),
        },
      }),
    ]);
    return { sources, events };
  }

  async bulkAssignCategory(eventIds: number[], categoryId: number, action: "add" | "remove") {
    if (action === "remove") {
      await this.prisma.eventCategory.deleteMany({
        where: { eventId: { in: eventIds }, categoryId },
      });
    } else {
      for (const eventId of eventIds) {
        await this.prisma.eventCategory.upsert({
          where: { eventId_categoryId: { eventId, categoryId } },
          update: {},
          create: { eventId, categoryId, source: "MANUAL" },
        });
      }
    }
  }

  pendingEvents() {
    return this.prisma.event.findMany({ where: { status: EventStatus.PENDING_REVIEW }, include: this.eventInclude(), orderBy: { createdAt: "desc" } });
  }

  allEvents() {
    return this.prisma.event.findMany({ include: this.eventInclude(), orderBy: { createdAt: "desc" }, take: 200 });
  }

  event(id: number) {
    return this.prisma.event.findUnique({ where: { id }, include: { ...this.eventInclude(), sources: true, duplicatesA: true, duplicatesB: true } });
  }

  updateEvent(id: number, dto: AdminEventDto) {
    return this.events.updateEvent(id, dto);
  }

  createEvent(dto: AdminEventDto) {
    return this.events.createFromDto(dto, { organizerId: dto.organizerId, status: dto.status ?? EventStatus.DRAFT });
  }

  setEventStatus(id: number, status: EventStatus) {
    return this.prisma.event.update({ where: { id }, data: { status, publishedAt: status === EventStatus.PUBLISHED ? new Date() : undefined } });
  }

  async duplicateEvent(id: number) {
    const current = await this.prisma.event.findUnique({
      where: { id },
      include: { categories: true },
    });
    if (!current) throw new NotFoundException("Event not found");

    const title = `${current.title} (kopija)`;
    const slug = await uniqueSlug(title, async (s) => !!(await this.prisma.event.findUnique({ where: { slug: s } })));
    const duplicated = await this.prisma.event.create({
      data: {
        title,
        slug,
        description: current.description,
        status: EventStatus.DRAFT,
        organizerId: current.organizerId,
        venueId: current.venueId,
        cityId: current.cityId,
        countyId: current.countyId,
        regionId: current.regionId,
        categoryId: current.categoryId,
        startsAt: current.startsAt,
        endsAt: current.endsAt,
        isAllDay: current.isAllDay,
        isFree: current.isFree,
        priceText: current.priceText,
        ticketUrl: current.ticketUrl,
        sourceUrl: current.sourceUrl,
        imageUrl: current.imageUrl,
        address: current.address,
        lat: current.lat,
        lng: current.lng,
        sourceType: current.sourceType,
        extractionConfidence: current.extractionConfidence,
      },
    });

    for (const category of current.categories) {
      await this.prisma.eventCategory.create({
        data: {
          eventId: duplicated.id,
          categoryId: category.categoryId,
          source: category.source,
          confidence: category.confidence,
        },
      });
    }

    return duplicated;
  }

  organizers() {
    return this.prisma.organizer.findMany({ orderBy: { createdAt: "desc" } });
  }

  async createOrganizer(dto: OrganizerAdminDto) {
    const slug = await uniqueSlug(dto.name, async (s) => !!(await this.prisma.organizer.findUnique({ where: { slug: s } })));
    return this.prisma.organizer.create({ data: { ...dto, slug, status: OrganizerStatus.UNCLAIMED } });
  }

  updateOrganizer(id: number, dto: OrganizerAdminDto) {
    return this.prisma.organizer.update({ where: { id }, data: dto });
  }

  setOrganizerStatus(id: number, status: OrganizerStatus) {
    return this.prisma.organizer.update({ where: { id }, data: { status } });
  }

  async deleteOrganizer(id: number) {
    const count = await this.prisma.event.count({ where: { organizerId: id } });
    if (count > 0) throw new ConflictException(`Organizator ima ${count} događaja — nije moguće obrisati.`);
    return this.prisma.organizer.delete({ where: { id } });
  }

  deleteEvent(id: number) {
    return this.prisma.$transaction(async (tx) => {
      await tx.eventSource.updateMany({ where: { eventId: id }, data: { eventId: null } });
      await tx.eventDuplicateCandidate.deleteMany({
        where: { OR: [{ eventAId: id }, { eventBId: id }] },
      });
      return tx.event.delete({ where: { id } });
    });
  }

  deleteEventSource(id: number) {
    return this.prisma.eventSource.delete({ where: { id } });
  }

  eventSources() {
    return this.prisma.eventSource.findMany({ include: { event: true, organizer: true }, orderBy: { createdAt: "desc" }, take: 200 });
  }

  getSource(id: number) {
    return this.prisma.eventSource.findUnique({ where: { id }, include: { event: true, organizer: true } });
  }

  updateEventSource(id: number, dto: UpdateEventSourceDto) {
    return this.prisma.eventSource.update({
      where: { id },
      data: { sourceUrl: dto.sourceUrl?.trim() || null },
    });
  }

  async createManualEmail(dto: ManualEmailDto) {
    const result = dto.useLlm
      ? await this.parser.parseBatchWithLlm({ rawText: dto.rawText, sourceUrl: dto.sourceUrl, screenshotBase64: dto.screenshotBase64, screenshotMediaType: dto.screenshotMediaType, contextHint: dto.contextHint })
      : await this.parser.parseBatch({ rawText: dto.rawText, sourceUrl: dto.sourceUrl });
    const { confidence, status } = this.sourceMetaFromResult(result);
    return this.prisma.eventSource.create({
      data: {
        type: EventSourceType.EMAIL,
        sourceUrl: dto.sourceUrl,
        rawText: dto.rawText,
        rawEmailSubject: dto.rawEmailSubject || dto.contextHint || undefined,
        parsedJson: result as object,
        confidence,
        status,
      },
    });
  }

  async parseUrl(dto: ParseUrlDto) {
    let rawHtml = "";
    const fetchWarnings: string[] = [];

    // Facebook: skip fetch, LLM will return a helpful warning
    const skipFetch = dto.useLlm && this.isFacebookUrl(dto.sourceUrl);

    if (!skipFetch) {
      try {
        const response = await fetch(dto.sourceUrl, {
          headers: { "User-Agent": "Manifestacije/1.0 event-ingestion-bot (+https://manifestacije.hr)" },
          signal: AbortSignal.timeout(12000),
        });
        if (response.ok) {
          rawHtml = await response.text();
        } else {
          fetchWarnings.push(`HTTP ${response.status} when fetching URL`);
        }
      } catch (err) {
        fetchWarnings.push(`Failed to fetch URL: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    // If listing page (many event sub-links, no dates), crawl sub-pages
    let subPageRawText: string | undefined;
    let subPageWarning: string | undefined;
    if (rawHtml && !skipFetch) {
      const crawl = await this.parser.crawlListingSubPages(rawHtml, dto.sourceUrl);
      if (crawl.subTexts.length > 0) {
        subPageRawText = crawl.subTexts.join("\n\n---\n\n");
        if (crawl.totalFound > crawl.fetched) {
          subPageWarning = `Stranica sadrži ${crawl.totalFound} događaja; obrađeno prvih ${crawl.fetched}.`;
        }
      }
    }

    const effectiveHtml = subPageRawText ? undefined : rawHtml || undefined;
    const result = dto.useLlm
      ? await this.parser.parseBatchWithLlm({ rawText: subPageRawText, rawHtml: effectiveHtml, sourceUrl: dto.sourceUrl })
      : await this.parser.parseBatch({ rawText: subPageRawText, rawHtml: effectiveHtml, sourceUrl: dto.sourceUrl });

    if (fetchWarnings.length) {
      result.candidates.forEach((c) => c.warnings.push(...fetchWarnings));
    }
    if (subPageWarning) {
      result.candidates.forEach((c) => c.warnings.push(subPageWarning!));
    }

    const { confidence, status } = this.sourceMetaFromResult(result);

    return this.prisma.eventSource.create({
      data: {
        type: EventSourceType.URL,
        sourceUrl: dto.sourceUrl,
        rawHtml: rawHtml || undefined,
        parsedJson: result as object,
        confidence,
        status,
      },
    });
  }

  async reparseSource(id: number) {
    const source = await this.prisma.eventSource.findUnique({ where: { id } });
    if (!source) throw new NotFoundException("Source not found");

    let rawText = source.rawText || undefined;
    let rawHtml = source.rawHtml || undefined;
    const sourceUrl = source.sourceUrl || undefined;

    // Re-fetch URL if we have one (stored rawHtml may be stale or listing-only)
    if (sourceUrl && !this.isFacebookUrl(sourceUrl)) {
      try {
        const res = await fetch(sourceUrl, {
          headers: { "User-Agent": "Manifestacije/1.0 event-ingestion-bot (+https://manifestacije.hr)" },
          signal: AbortSignal.timeout(12000),
        });
        if (res.ok) rawHtml = await res.text();
      } catch { /* use stored rawHtml */ }
    }

    // Sub-page crawl if listing
    if (rawHtml && sourceUrl) {
      const crawl = await this.parser.crawlListingSubPages(rawHtml, sourceUrl);
      if (crawl.subTexts.length > 0) {
        rawText = crawl.subTexts.join("\n\n---\n\n");
        rawHtml = undefined;
      }
    }

    const result = await this.parser.parseBatchWithLlm({ rawHtml, rawText, sourceUrl });
    const { confidence, status } = this.sourceMetaFromResult(result);
    return this.prisma.eventSource.update({
      where: { id },
      data: { parsedJson: result as object, confidence, status },
    });
  }

  async createEventFromSource(id: number, candidateIndex = 0, candidateOverride?: CandidateOverrideDto, publish = false) {
    const source = await this.prisma.eventSource.findUnique({ where: { id } });
    if (!source?.parsedJson) throw new BadRequestException("Source has no parsed JSON");

    const parsedJson = source.parsedJson as Record<string, unknown>;
    let originalCandidate: ParsedEventCandidate;
    let candidate: ParsedEventCandidate;
    let isBatchFormat = false;

    if (Array.isArray((parsedJson as ParsedSourceResult).candidates)) {
      isBatchFormat = true;
      const result = parsedJson as ParsedSourceResult;
      const candidates = result.candidates as (ParsedEventCandidate & { _status?: string; _eventId?: number })[];
      if (candidateIndex < 0 || candidateIndex >= candidates.length) {
        throw new BadRequestException(`Invalid candidateIndex ${candidateIndex} (source has ${candidates.length} candidates)`);
      }
      const c = candidates[candidateIndex];
      if (c._status === "created") throw new BadRequestException("Candidate already has a created event");
      if (c._status === "ignored") throw new BadRequestException("Candidate is marked as ignored");
      originalCandidate = c;
    } else {
      // Legacy single-event format
      originalCandidate = parsedJson as unknown as ParsedEventCandidate;
    }

    candidate = { ...originalCandidate, ...this.cleanCandidateOverride(candidateOverride) };

    const city = candidate.city ? await this.findOrCreateCity(candidate.city, candidate.county, candidate.region) : null;
    const categoryIds = candidateOverride?.categoryIds?.length ? candidateOverride.categoryIds : undefined;
    const category = categoryIds?.[0]
      ? await this.prisma.category.findUnique({ where: { id: categoryIds[0] } })
      : await this.findOrCreateCategory(candidate.category);
    if (categoryIds?.[0] && !category) throw new BadRequestException(`Category '${categoryIds[0]}' not found in taxonomy`);

    const organizerId = source.organizerId ?? await this.findOrCreateOrganizerId(candidate.organizerName);

    const event = await this.events.createFromDto(
      {
        title: candidate.title,
        description: candidate.description || candidate.title,
        cityId: city?.id,
        cityName: candidate.city || undefined,
        categoryId: category?.id,
        categoryIds,
        startsAt: candidate.startsAt || undefined,
        endsAt: candidate.endsAt || undefined,
        isFree: candidate.isFree ?? undefined,
        priceText: candidate.priceText || undefined,
        ticketUrl: candidate.ticketUrl || undefined,
        sourceUrl: candidate.sourceUrl || source.sourceUrl || undefined,
        venueName: candidate.venueName || undefined,
        address: candidate.address || undefined,
        lat: candidate.lat ?? undefined,
        lng: candidate.lng ?? undefined,
        imageUrl: candidate.imageUrl || undefined,
      },
      { organizerId, status: publish ? EventStatus.PUBLISHED : EventStatus.PENDING_REVIEW, sourceType: "URL_SUBMISSION" }
    );

    if (isBatchFormat) {
      const result = parsedJson as ParsedSourceResult;
      const primaryCategory = categoryIds?.length ? category?.slug ?? candidate.category : candidate.category;
      const updatedCandidates = result.candidates.map((c, i) =>
        i === candidateIndex
          ? {
              ...c,
              ...this.cleanCandidateOverride(candidateOverride),
              category: primaryCategory,
              missingFields: c.missingFields,
              warnings: c.warnings,
              _status: "created" as const,
              _eventId: event.id,
            }
          : c
      );
      const allDone = updatedCandidates.every((c) => c._status === "created" || c._status === "ignored");
      await this.prisma.eventSource.update({
        where: { id },
        data: { parsedJson: { ...result, candidates: updatedCandidates } as object, status: allDone ? "LINKED" : "PARSED" },
      });
    } else {
      await this.prisma.eventSource.update({ where: { id }, data: { eventId: event.id, status: "LINKED" } });
    }

    return { event, candidateIndex };
  }

  async ignoreCandidate(id: number, candidateIndex: number) {
    const source = await this.prisma.eventSource.findUnique({ where: { id } });
    if (!source?.parsedJson) throw new BadRequestException("Source has no parsed JSON");

    const parsedJson = source.parsedJson as Record<string, unknown>;
    const result = parsedJson as ParsedSourceResult;
    if (!Array.isArray(result.candidates)) throw new BadRequestException("Source is not in batch format");

    if (candidateIndex < 0 || candidateIndex >= result.candidates.length) {
      throw new BadRequestException(`Invalid candidateIndex ${candidateIndex}`);
    }

    const updatedCandidates = result.candidates.map((c, i) =>
      i === candidateIndex ? { ...c, _status: "ignored" as const } : c
    );
    const allDone = updatedCandidates.every((c) => c._status === "created" || c._status === "ignored");

    return this.prisma.eventSource.update({
      where: { id },
      data: { parsedJson: { ...result, candidates: updatedCandidates } as object, status: allDone ? "LINKED" : "PARSED" },
    });
  }

  duplicatesList() {
    return this.duplicates.list();
  }

  mergeDuplicate(id: number) {
    return this.duplicates.merge(id);
  }

  dismissDuplicate(id: number) {
    return this.duplicates.dismiss(id);
  }

  regions() {
    return this.prisma.region.findMany({ include: { counties: { include: { cities: true } } }, orderBy: { sortOrder: "asc" } });
  }

  createRegion(dto: import("./admin.dto").RegionDto) {
    return this.prisma.region.create({ data: { name: dto.name, slug: dto.slug, sortOrder: dto.sortOrder ?? 0 } });
  }

  async deleteRegion(id: number) {
    const count = await this.prisma.county.count({ where: { regionId: id } });
    if (count > 0) throw new ConflictException(`Regija ima ${count} županija — prvo obrišite sadržaj.`);
    return this.prisma.region.delete({ where: { id } });
  }

  createCounty(dto: import("./admin.dto").CountyDto) {
    return this.prisma.county.create({ data: { name: dto.name, slug: dto.slug, regionId: dto.regionId } });
  }

  async deleteCounty(id: number) {
    const count = await this.prisma.city.count({ where: { countyId: id } });
    if (count > 0) throw new ConflictException(`Županija ima ${count} gradova — prvo obrišite gradove.`);
    return this.prisma.county.delete({ where: { id } });
  }

  createCity(dto: import("./admin.dto").CityDto) {
    return this.prisma.city.create({ data: { name: dto.name, slug: dto.slug, countyId: dto.countyId, lat: dto.lat, lng: dto.lng } });
  }

  updateCity(id: number, dto: import("./admin.dto").CityDto) {
    return this.prisma.city.update({ where: { id }, data: { name: dto.name, slug: dto.slug, lat: dto.lat, lng: dto.lng } });
  }

  async deleteCity(id: number) {
    const count = await this.prisma.event.count({ where: { cityId: id } });
    if (count > 0) throw new ConflictException(`Grad ima ${count} događaja — nije moguće obrisati.`);
    return this.prisma.city.delete({ where: { id } });
  }

  categories() {
    return this.prisma.category.findMany({ orderBy: { sortOrder: "asc" } });
  }

  createCategory(dto: import("./admin.dto").CategoryDto) {
    return this.prisma.category.create({ data: { name: dto.name, slug: dto.slug, sortOrder: dto.sortOrder ?? 0 } });
  }

  updateCategory(id: number, dto: import("./admin.dto").CategoryDto) {
    return this.prisma.category.update({ where: { id }, data: { name: dto.name, slug: dto.slug, sortOrder: dto.sortOrder } });
  }

  async deleteCategory(id: number) {
    const count = await this.prisma.eventCategory.count({ where: { categoryId: id } });
    if (count > 0) throw new ConflictException(`Kategorija se koristi na ${count} događaja — nije moguće obrisati.`);
    return this.prisma.category.delete({ where: { id } });
  }

  async searchVenues(q: string) {
    const venues = await this.prisma.venue.findMany({
      where: {
        OR: [
          { name: { contains: q } },
          { address: { contains: q } },
        ],
        lat: { not: null },
        lng: { not: null },
      },
      include: { city: true },
      take: 5,
      orderBy: { name: "asc" },
    });
    return venues.map((v) => ({
      label: [v.name, v.address, v.city.name].filter(Boolean).join(", "),
      lat: v.lat!,
      lng: v.lng!,
    }));
  }

  private sourceMetaFromResult(result: ParsedSourceResult): { confidence: number; status: "PARSED" | "NEEDS_REVIEW" } {
    const avgConfidence = result.candidates.length
      ? result.candidates.reduce((s, c) => s + c.confidence, 0) / result.candidates.length
      : 0;
    const needsReview = result.candidates.some((c) => c.missingFields.length > 0);
    return { confidence: avgConfidence, status: needsReview ? "NEEDS_REVIEW" : "PARSED" };
  }

  private eventInclude() {
    return { organizer: true, venue: true, city: true, county: true, region: true, category: true, categories: { include: { category: true } } } as const;
  }

  private isFacebookUrl(url: string): boolean {
    try {
      const hostname = new URL(url).hostname.toLowerCase().replace(/^www\./, "");
      return hostname === "fb.me" || hostname === "facebook.com" || hostname.endsWith(".facebook.com");
    }
    catch { return false; }
  }

  private cleanCandidateOverride(candidate?: CandidateOverrideDto): Partial<ParsedEventCandidate> {
    if (!candidate) return {};
    return Object.fromEntries(
      Object.entries(candidate).map(([key, value]) => [
        key,
        typeof value === "string" ? value.trim() : value,
      ]).filter(([key, value]) => key !== "categoryIds" && value !== undefined)
    ) as Partial<ParsedEventCandidate>;
  }

  private async findOrCreateOrganizerId(name?: string): Promise<number | undefined> {
    const cleaned = name?.trim();
    if (!cleaned) return undefined;
    const existing = await this.prisma.organizer.findFirst({ where: { name: { equals: cleaned, mode: "insensitive" } } });
    if (existing) return existing.id;
    const slug = await uniqueSlug(cleaned, async (s) => !!(await this.prisma.organizer.findUnique({ where: { slug: s } })));
    const organizer = await this.prisma.organizer.create({ data: { name: cleaned, slug, status: OrganizerStatus.UNCLAIMED } });
    return organizer.id;
  }

  private async findOrCreateCity(name: string, countyName?: string, regionName?: string) {
    const cleaned = name.trim();
    const existing = await this.prisma.city.findFirst({ where: { name: { equals: cleaned, mode: "insensitive" } } });
    if (existing) return existing;

    const regionClean = regionName?.trim() || "Hrvatska";
    const regionSlug = slugify(regionClean) || "hrvatska";
    const region = await this.prisma.region.upsert({
      where: { slug: regionSlug },
      update: {},
      create: { name: regionClean, slug: regionSlug, sortOrder: 999 },
    });

    const countyClean = countyName?.trim() || "Nepoznata županija";
    const countySlug = slugify(countyClean) || "nepoznata-zupanija";
    const county = await this.prisma.county.upsert({
      where: { slug: countySlug },
      update: {},
      create: { name: countyClean, slug: countySlug, regionId: region.id },
    });

    const citySlug = await uniqueSlug(cleaned, async (s) => !!(await this.prisma.city.findUnique({ where: { slug: s } })));
    return this.prisma.city.create({ data: { name: cleaned, slug: citySlug, countyId: county.id } });
  }

  private async findOrCreateCategory(category?: string | null) {
    const cleaned = category?.trim();
    if (cleaned) {
      const existing = await this.prisma.category.findFirst({
        where: {
          OR: [
            { slug: { equals: cleaned, mode: "insensitive" } },
            { name: { equals: cleaned, mode: "insensitive" } },
          ],
        },
      });
      if (existing) return existing;
    }
    return this.prisma.category.upsert({
      where: { slug: "ostalo" },
      update: {},
      create: { name: "Ostalo", slug: "ostalo", sortOrder: 999 },
    });
  }
}
