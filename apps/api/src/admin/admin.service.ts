import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { EventStatus, EventSourceType, OrganizerStatus } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { slugify, uniqueSlug } from "../common/slug";
import { EventsService } from "../events/events.service";
import { AiEventParserService, ParsedEvent } from "../ai-parser/ai-event-parser.service";
import { DuplicatesService } from "../duplicates/duplicates.service";
import { AdminEventDto, ManualEmailDto, OrganizerAdminDto } from "./admin.dto";

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

  async createManualEmail(dto: ManualEmailDto) {
    const parsed = await this.parser.parse({ rawText: dto.rawText, sourceUrl: dto.sourceUrl });
    return this.prisma.eventSource.create({
      data: {
        type: EventSourceType.EMAIL,
        sourceUrl: dto.sourceUrl,
        rawText: dto.rawText,
        rawEmailSubject: dto.rawEmailSubject,
        rawEmailFrom: dto.rawEmailFrom,
        parsedJson: parsed,
        confidence: parsed.confidence,
        status: parsed.missingFields.length ? "NEEDS_REVIEW" : "PARSED"
      }
    });
  }

  async parseUrl(dto: ManualEmailDto) {
    const parsed = await this.parser.parse({ rawText: dto.rawText || dto.sourceUrl || "", sourceUrl: dto.sourceUrl });
    return this.prisma.eventSource.create({
      data: {
        type: EventSourceType.URL,
        sourceUrl: dto.sourceUrl,
        rawText: dto.rawText,
        parsedJson: parsed,
        confidence: parsed.confidence,
        status: parsed.missingFields.length ? "NEEDS_REVIEW" : "PARSED"
      }
    });
  }

  async reparseSource(id: number) {
    const source = await this.prisma.eventSource.findUnique({ where: { id } });
    if (!source) throw new NotFoundException("Source not found");
    const parsed = await this.parser.parse({ rawText: source.rawText || source.rawHtml || "", sourceUrl: source.sourceUrl || undefined });
    return this.prisma.eventSource.update({
      where: { id },
      data: { parsedJson: parsed, confidence: parsed.confidence, status: parsed.missingFields.length ? "NEEDS_REVIEW" : "PARSED" }
    });
  }

  async createEventFromSource(id: number) {
    const source = await this.prisma.eventSource.findUnique({ where: { id } });
    if (!source?.parsedJson) throw new BadRequestException("Source has no parsed JSON");
    const parsed = source.parsedJson as ParsedEvent;
    if (!parsed.title || !parsed.startsAt || !parsed.city || !parsed.category) throw new BadRequestException("Missing required parsed fields");
    const city = await this.prisma.city.findFirst({ where: { name: { equals: parsed.city, mode: "insensitive" } } });
    const category = await this.prisma.category.findFirst({ where: { name: { equals: parsed.category, mode: "insensitive" } } });
    if (!city || !category) throw new BadRequestException("Parsed city/category not found in taxonomy");
    const event = await this.events.createFromDto(
      {
        title: parsed.title,
        description: parsed.description,
        cityId: city.id,
        categoryId: category.id,
        startsAt: parsed.startsAt,
        endsAt: parsed.endsAt || undefined,
        isFree: parsed.isFree ?? undefined,
        priceText: parsed.priceText || undefined,
        ticketUrl: parsed.ticketUrl || undefined,
        sourceUrl: parsed.sourceUrl || source.sourceUrl || undefined,
        venueName: parsed.venueName || undefined,
        address: parsed.address || undefined
      },
      { organizerId: source.organizerId, status: EventStatus.PENDING_REVIEW, sourceType: "EMAIL" }
    );
    return this.prisma.eventSource.update({ where: { id }, data: { eventId: event.id, status: "LINKED" } });
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

  private eventInclude() {
    return { organizer: true, venue: true, city: true, county: true, region: true, category: true } as const;
  }
}
