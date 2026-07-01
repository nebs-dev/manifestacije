import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { EventStatus, EventSourceType, OrganizerStatus } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { slugify, uniqueSlug } from "../common/slug";
import { EventsService } from "../events/events.service";
import { AiEventParserService, ParsedEventCandidate, ParsedSourceResult } from "../ai-parser/ai-event-parser.service";
import { DuplicatesService } from "../duplicates/duplicates.service";
import { AdminEventDto, CandidateOverrideDto, ManualEmailDto, OrganizerAdminDto, ParseUrlDto } from "./admin.dto";

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventsService,
    private readonly parser: AiEventParserService,
    private readonly duplicates: DuplicatesService
  ) {}

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

  deleteOrganizer(id: number) {
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

    const result = dto.useLlm
      ? await this.parser.parseBatchWithLlm({ rawHtml: rawHtml || undefined, sourceUrl: dto.sourceUrl })
      : await this.parser.parseBatch({ rawHtml: rawHtml || undefined, sourceUrl: dto.sourceUrl });

    if (fetchWarnings.length) {
      result.candidates.forEach((c) => c.warnings.push(...fetchWarnings));
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
    const result = await this.parser.parseBatch({
      rawHtml: source.rawHtml || undefined,
      rawText: source.rawText || undefined,
      sourceUrl: source.sourceUrl || undefined,
    });
    const { confidence, status } = this.sourceMetaFromResult(result);
    return this.prisma.eventSource.update({
      where: { id },
      data: { parsedJson: result as object, confidence, status },
    });
  }

  async createEventFromSource(id: number, candidateIndex = 0, candidateOverride?: CandidateOverrideDto) {
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

    const missing = [!candidate.title && "title", !candidate.startsAt && "startsAt", !candidate.city && "city", !candidate.category && "category"].filter(Boolean);
    if (missing.length) throw new BadRequestException(`Candidate is missing required fields: ${missing.join(", ")}`);

    const city = await this.prisma.city.findFirst({ where: { name: { equals: candidate.city, mode: "insensitive" } } });
    if (!city) throw new BadRequestException(`City '${candidate.city}' not found in taxonomy – add it first or correct the parsed city`);

    const category = await this.prisma.category.findFirst({
      where: {
        OR: [
          { slug: { equals: candidate.category, mode: "insensitive" } },
          { name: { equals: candidate.category, mode: "insensitive" } },
        ],
      },
    });
    if (!category) throw new BadRequestException(`Category '${candidate.category}' not found in taxonomy`);

    const organizerId = source.organizerId ?? await this.findOrCreateOrganizerId(candidate.organizerName);

    const event = await this.events.createFromDto(
      {
        title: candidate.title,
        description: candidate.description || candidate.title,
        cityId: city.id,
        categoryId: category.id,
        startsAt: candidate.startsAt,
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
        imageAlt: candidate.imageAlt || undefined,
        imageCredit: candidate.imageCredit || undefined,
        imageSourceUrl: candidate.imageSourceUrl || undefined,
      },
      { organizerId, status: EventStatus.PENDING_REVIEW, sourceType: "URL_SUBMISSION" }
    );

    if (isBatchFormat) {
      const result = parsedJson as ParsedSourceResult;
      const updatedCandidates = result.candidates.map((c, i) =>
        i === candidateIndex
          ? {
              ...c,
              ...this.cleanCandidateOverride(candidateOverride),
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

  deleteRegion(id: number) {
    return this.prisma.region.delete({ where: { id } });
  }

  createCounty(dto: import("./admin.dto").CountyDto) {
    return this.prisma.county.create({ data: { name: dto.name, slug: dto.slug, regionId: dto.regionId } });
  }

  deleteCounty(id: number) {
    return this.prisma.county.delete({ where: { id } });
  }

  createCity(dto: import("./admin.dto").CityDto) {
    return this.prisma.city.create({ data: { name: dto.name, slug: dto.slug, countyId: dto.countyId, lat: dto.lat, lng: dto.lng } });
  }

  updateCity(id: number, dto: import("./admin.dto").CityDto) {
    return this.prisma.city.update({ where: { id }, data: { name: dto.name, slug: dto.slug, lat: dto.lat, lng: dto.lng } });
  }

  deleteCity(id: number) {
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

  deleteCategory(id: number) {
    return this.prisma.category.delete({ where: { id } });
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
    try { return new URL(url).hostname.replace("www.", "").startsWith("facebook.com"); }
    catch { return false; }
  }

  private cleanCandidateOverride(candidate?: CandidateOverrideDto): Partial<ParsedEventCandidate> {
    if (!candidate) return {};
    return Object.fromEntries(
      Object.entries(candidate).map(([key, value]) => [
        key,
        typeof value === "string" ? value.trim() : value,
      ]).filter(([, value]) => value !== undefined)
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
}
