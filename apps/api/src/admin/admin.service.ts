import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { EventStatus, EventSourceType, OrganizerStatus } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { slugify, uniqueSlug } from "../common/slug";
import { EventsService } from "../events/events.service";
import { AiEventParserService, ParsedEventCandidate, ParsedSourceResult } from "../ai-parser/ai-event-parser.service";
import { DuplicatesService } from "../duplicates/duplicates.service";
import { AdminEventDto, ManualEmailDto, OrganizerAdminDto, ParseUrlDto } from "./admin.dto";

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

  eventSources() {
    return this.prisma.eventSource.findMany({ include: { event: true, organizer: true }, orderBy: { createdAt: "desc" }, take: 200 });
  }

  getSource(id: number) {
    return this.prisma.eventSource.findUnique({ where: { id }, include: { event: true, organizer: true } });
  }

  async createManualEmail(dto: ManualEmailDto) {
    const result = await this.parser.parseBatch({ rawText: dto.rawText, sourceUrl: dto.sourceUrl });
    const { confidence, status } = this.sourceMetaFromResult(result);
    return this.prisma.eventSource.create({
      data: {
        type: EventSourceType.EMAIL,
        sourceUrl: dto.sourceUrl,
        rawText: dto.rawText,
        rawEmailSubject: dto.rawEmailSubject,
        rawEmailFrom: dto.rawEmailFrom,
        parsedJson: result as object,
        confidence,
        status,
      },
    });
  }

  async parseUrl(dto: ParseUrlDto) {
    let rawHtml = "";
    const fetchWarnings: string[] = [];

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

    const result = await this.parser.parseBatch({ rawHtml: rawHtml || undefined, sourceUrl: dto.sourceUrl });

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

  async createEventFromSource(id: number, candidateIndex = 0) {
    const source = await this.prisma.eventSource.findUnique({ where: { id } });
    if (!source?.parsedJson) throw new BadRequestException("Source has no parsed JSON");

    const parsedJson = source.parsedJson as Record<string, unknown>;
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
      candidate = c;
    } else {
      // Legacy single-event format
      candidate = parsedJson as unknown as ParsedEventCandidate;
    }

    const missing = [!candidate.title && "title", !candidate.startsAt && "startsAt", !candidate.city && "city", !candidate.category && "category"].filter(Boolean);
    if (missing.length) throw new BadRequestException(`Candidate is missing required fields: ${missing.join(", ")}`);

    const city = await this.prisma.city.findFirst({ where: { name: { equals: candidate.city, mode: "insensitive" } } });
    if (!city) throw new BadRequestException(`City '${candidate.city}' not found in taxonomy – add it first or correct the parsed city`);

    const category = await this.prisma.category.findFirst({ where: { name: { equals: candidate.category, mode: "insensitive" } } });
    if (!category) throw new BadRequestException(`Category '${candidate.category}' not found in taxonomy`);

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
      },
      { organizerId: source.organizerId, status: EventStatus.PENDING_REVIEW, sourceType: "URL_SUBMISSION" }
    );

    if (isBatchFormat) {
      const result = parsedJson as ParsedSourceResult;
      const updatedCandidates = result.candidates.map((c, i) =>
        i === candidateIndex ? { ...c, _status: "created" as const, _eventId: event.id } : c
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

  categories() {
    return this.prisma.category.findMany({ orderBy: { sortOrder: "asc" } });
  }

  private sourceMetaFromResult(result: ParsedSourceResult): { confidence: number; status: "PARSED" | "NEEDS_REVIEW" } {
    const avgConfidence = result.candidates.length
      ? result.candidates.reduce((s, c) => s + c.confidence, 0) / result.candidates.length
      : 0;
    const needsReview = result.candidates.some((c) => c.missingFields.length > 0);
    return { confidence: avgConfidence, status: needsReview ? "NEEDS_REVIEW" : "PARSED" };
  }

  private eventInclude() {
    return { organizer: true, venue: true, city: true, county: true, region: true, category: true } as const;
  }
}
