"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../prisma/prisma.service");
const slug_1 = require("../common/slug");
const events_service_1 = require("../events/events.service");
const ai_event_parser_service_1 = require("../ai-parser/ai-event-parser.service");
const duplicates_service_1 = require("../duplicates/duplicates.service");
let AdminService = class AdminService {
    prisma;
    events;
    parser;
    duplicates;
    constructor(prisma, events, parser, duplicates) {
        this.prisma = prisma;
        this.events = events;
        this.parser = parser;
        this.duplicates = duplicates;
    }
    pendingEvents() {
        return this.prisma.event.findMany({ where: { status: client_1.EventStatus.PENDING_REVIEW }, include: this.eventInclude(), orderBy: { createdAt: "desc" } });
    }
    allEvents() {
        return this.prisma.event.findMany({ include: this.eventInclude(), orderBy: { createdAt: "desc" }, take: 200 });
    }
    event(id) {
        return this.prisma.event.findUnique({ where: { id }, include: { ...this.eventInclude(), sources: true, duplicatesA: true, duplicatesB: true } });
    }
    updateEvent(id, dto) {
        return this.events.updateEvent(id, dto);
    }
    setEventStatus(id, status) {
        return this.prisma.event.update({ where: { id }, data: { status, publishedAt: status === client_1.EventStatus.PUBLISHED ? new Date() : undefined } });
    }
    organizers() {
        return this.prisma.organizer.findMany({ orderBy: { createdAt: "desc" } });
    }
    async createOrganizer(dto) {
        const slug = await (0, slug_1.uniqueSlug)(dto.name, async (s) => !!(await this.prisma.organizer.findUnique({ where: { slug: s } })));
        return this.prisma.organizer.create({ data: { ...dto, slug, status: client_1.OrganizerStatus.UNCLAIMED } });
    }
    updateOrganizer(id, dto) {
        return this.prisma.organizer.update({ where: { id }, data: dto });
    }
    setOrganizerStatus(id, status) {
        return this.prisma.organizer.update({ where: { id }, data: { status } });
    }
    eventSources() {
        return this.prisma.eventSource.findMany({ include: { event: true, organizer: true }, orderBy: { createdAt: "desc" }, take: 200 });
    }
    async createManualEmail(dto) {
        const parsed = await this.parser.parse({ rawText: dto.rawText, sourceUrl: dto.sourceUrl });
        return this.prisma.eventSource.create({
            data: {
                type: client_1.EventSourceType.EMAIL,
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
    async parseUrl(dto) {
        const parsed = await this.parser.parse({ rawText: dto.rawText || dto.sourceUrl || "", sourceUrl: dto.sourceUrl });
        return this.prisma.eventSource.create({
            data: {
                type: client_1.EventSourceType.URL,
                sourceUrl: dto.sourceUrl,
                rawText: dto.rawText,
                parsedJson: parsed,
                confidence: parsed.confidence,
                status: parsed.missingFields.length ? "NEEDS_REVIEW" : "PARSED"
            }
        });
    }
    async reparseSource(id) {
        const source = await this.prisma.eventSource.findUnique({ where: { id } });
        if (!source)
            throw new common_1.NotFoundException("Source not found");
        const parsed = await this.parser.parse({ rawText: source.rawText || source.rawHtml || "", sourceUrl: source.sourceUrl || undefined });
        return this.prisma.eventSource.update({
            where: { id },
            data: { parsedJson: parsed, confidence: parsed.confidence, status: parsed.missingFields.length ? "NEEDS_REVIEW" : "PARSED" }
        });
    }
    async createEventFromSource(id) {
        const source = await this.prisma.eventSource.findUnique({ where: { id } });
        if (!source?.parsedJson)
            throw new common_1.BadRequestException("Source has no parsed JSON");
        const parsed = source.parsedJson;
        if (!parsed.title || !parsed.startsAt || !parsed.city || !parsed.category)
            throw new common_1.BadRequestException("Missing required parsed fields");
        const city = await this.prisma.city.findFirst({ where: { name: { equals: parsed.city, mode: "insensitive" } } });
        const category = await this.prisma.category.findFirst({ where: { name: { equals: parsed.category, mode: "insensitive" } } });
        if (!city || !category)
            throw new common_1.BadRequestException("Parsed city/category not found in taxonomy");
        const event = await this.events.createFromDto({
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
        }, { organizerId: source.organizerId, status: client_1.EventStatus.PENDING_REVIEW, sourceType: "EMAIL" });
        return this.prisma.eventSource.update({ where: { id }, data: { eventId: event.id, status: "LINKED" } });
    }
    duplicatesList() {
        return this.duplicates.list();
    }
    mergeDuplicate(id) {
        return this.duplicates.merge(id);
    }
    dismissDuplicate(id) {
        return this.duplicates.dismiss(id);
    }
    regions() {
        return this.prisma.region.findMany({ include: { counties: { include: { cities: true } } }, orderBy: { sortOrder: "asc" } });
    }
    categories() {
        return this.prisma.category.findMany({ orderBy: { sortOrder: "asc" } });
    }
    eventInclude() {
        return { organizer: true, venue: true, city: true, county: true, region: true, category: true };
    }
};
exports.AdminService = AdminService;
exports.AdminService = AdminService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        events_service_1.EventsService,
        ai_event_parser_service_1.AiEventParserService,
        duplicates_service_1.DuplicatesService])
], AdminService);
