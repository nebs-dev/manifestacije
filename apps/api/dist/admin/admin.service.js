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
    deleteOrganizer(id) {
        return this.prisma.organizer.delete({ where: { id } });
    }
    deleteEvent(id) {
        return this.prisma.$transaction(async (tx) => {
            await tx.eventSource.updateMany({ where: { eventId: id }, data: { eventId: null } });
            await tx.eventDuplicateCandidate.deleteMany({
                where: { OR: [{ eventAId: id }, { eventBId: id }] },
            });
            return tx.event.delete({ where: { id } });
        });
    }
    deleteEventSource(id) {
        return this.prisma.eventSource.delete({ where: { id } });
    }
    eventSources() {
        return this.prisma.eventSource.findMany({ include: { event: true, organizer: true }, orderBy: { createdAt: "desc" }, take: 200 });
    }
    getSource(id) {
        return this.prisma.eventSource.findUnique({ where: { id }, include: { event: true, organizer: true } });
    }
    async createManualEmail(dto) {
        const result = await this.parser.parseBatch({ rawText: dto.rawText, sourceUrl: dto.sourceUrl });
        const { confidence, status } = this.sourceMetaFromResult(result);
        return this.prisma.eventSource.create({
            data: {
                type: client_1.EventSourceType.EMAIL,
                sourceUrl: dto.sourceUrl,
                rawText: dto.rawText,
                rawEmailSubject: dto.rawEmailSubject,
                rawEmailFrom: dto.rawEmailFrom,
                parsedJson: result,
                confidence,
                status,
            },
        });
    }
    async parseUrl(dto) {
        let rawHtml = "";
        const fetchWarnings = [];
        try {
            const response = await fetch(dto.sourceUrl, {
                headers: { "User-Agent": "Manifestacije/1.0 event-ingestion-bot (+https://manifestacije.hr)" },
                signal: AbortSignal.timeout(12000),
            });
            if (response.ok) {
                rawHtml = await response.text();
            }
            else {
                fetchWarnings.push(`HTTP ${response.status} when fetching URL`);
            }
        }
        catch (err) {
            fetchWarnings.push(`Failed to fetch URL: ${err instanceof Error ? err.message : String(err)}`);
        }
        const result = await this.parser.parseBatch({ rawHtml: rawHtml || undefined, sourceUrl: dto.sourceUrl });
        if (fetchWarnings.length) {
            result.candidates.forEach((c) => c.warnings.push(...fetchWarnings));
        }
        const { confidence, status } = this.sourceMetaFromResult(result);
        return this.prisma.eventSource.create({
            data: {
                type: client_1.EventSourceType.URL,
                sourceUrl: dto.sourceUrl,
                rawHtml: rawHtml || undefined,
                parsedJson: result,
                confidence,
                status,
            },
        });
    }
    async reparseSource(id) {
        const source = await this.prisma.eventSource.findUnique({ where: { id } });
        if (!source)
            throw new common_1.NotFoundException("Source not found");
        const result = await this.parser.parseBatch({
            rawHtml: source.rawHtml || undefined,
            rawText: source.rawText || undefined,
            sourceUrl: source.sourceUrl || undefined,
        });
        const { confidence, status } = this.sourceMetaFromResult(result);
        return this.prisma.eventSource.update({
            where: { id },
            data: { parsedJson: result, confidence, status },
        });
    }
    async createEventFromSource(id, candidateIndex = 0, candidateOverride) {
        const source = await this.prisma.eventSource.findUnique({ where: { id } });
        if (!source?.parsedJson)
            throw new common_1.BadRequestException("Source has no parsed JSON");
        const parsedJson = source.parsedJson;
        let originalCandidate;
        let candidate;
        let isBatchFormat = false;
        if (Array.isArray(parsedJson.candidates)) {
            isBatchFormat = true;
            const result = parsedJson;
            const candidates = result.candidates;
            if (candidateIndex < 0 || candidateIndex >= candidates.length) {
                throw new common_1.BadRequestException(`Invalid candidateIndex ${candidateIndex} (source has ${candidates.length} candidates)`);
            }
            const c = candidates[candidateIndex];
            if (c._status === "created")
                throw new common_1.BadRequestException("Candidate already has a created event");
            if (c._status === "ignored")
                throw new common_1.BadRequestException("Candidate is marked as ignored");
            originalCandidate = c;
        }
        else {
            // Legacy single-event format
            originalCandidate = parsedJson;
        }
        candidate = { ...originalCandidate, ...this.cleanCandidateOverride(candidateOverride) };
        const missing = [!candidate.title && "title", !candidate.startsAt && "startsAt", !candidate.city && "city", !candidate.category && "category"].filter(Boolean);
        if (missing.length)
            throw new common_1.BadRequestException(`Candidate is missing required fields: ${missing.join(", ")}`);
        const city = await this.prisma.city.findFirst({ where: { name: { equals: candidate.city, mode: "insensitive" } } });
        if (!city)
            throw new common_1.BadRequestException(`City '${candidate.city}' not found in taxonomy – add it first or correct the parsed city`);
        const category = await this.prisma.category.findFirst({
            where: {
                OR: [
                    { slug: { equals: candidate.category, mode: "insensitive" } },
                    { name: { equals: candidate.category, mode: "insensitive" } },
                ],
            },
        });
        if (!category)
            throw new common_1.BadRequestException(`Category '${candidate.category}' not found in taxonomy`);
        const organizerId = source.organizerId ?? await this.findOrCreateOrganizerId(candidate.organizerName);
        const event = await this.events.createFromDto({
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
        }, { organizerId, status: client_1.EventStatus.PENDING_REVIEW, sourceType: "URL_SUBMISSION" });
        if (isBatchFormat) {
            const result = parsedJson;
            const updatedCandidates = result.candidates.map((c, i) => i === candidateIndex
                ? {
                    ...c,
                    ...this.cleanCandidateOverride(candidateOverride),
                    missingFields: c.missingFields,
                    warnings: c.warnings,
                    _status: "created",
                    _eventId: event.id,
                }
                : c);
            const allDone = updatedCandidates.every((c) => c._status === "created" || c._status === "ignored");
            await this.prisma.eventSource.update({
                where: { id },
                data: { parsedJson: { ...result, candidates: updatedCandidates }, status: allDone ? "LINKED" : "PARSED" },
            });
        }
        else {
            await this.prisma.eventSource.update({ where: { id }, data: { eventId: event.id, status: "LINKED" } });
        }
        return { event, candidateIndex };
    }
    async ignoreCandidate(id, candidateIndex) {
        const source = await this.prisma.eventSource.findUnique({ where: { id } });
        if (!source?.parsedJson)
            throw new common_1.BadRequestException("Source has no parsed JSON");
        const parsedJson = source.parsedJson;
        const result = parsedJson;
        if (!Array.isArray(result.candidates))
            throw new common_1.BadRequestException("Source is not in batch format");
        if (candidateIndex < 0 || candidateIndex >= result.candidates.length) {
            throw new common_1.BadRequestException(`Invalid candidateIndex ${candidateIndex}`);
        }
        const updatedCandidates = result.candidates.map((c, i) => i === candidateIndex ? { ...c, _status: "ignored" } : c);
        const allDone = updatedCandidates.every((c) => c._status === "created" || c._status === "ignored");
        return this.prisma.eventSource.update({
            where: { id },
            data: { parsedJson: { ...result, candidates: updatedCandidates }, status: allDone ? "LINKED" : "PARSED" },
        });
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
    sourceMetaFromResult(result) {
        const avgConfidence = result.candidates.length
            ? result.candidates.reduce((s, c) => s + c.confidence, 0) / result.candidates.length
            : 0;
        const needsReview = result.candidates.some((c) => c.missingFields.length > 0);
        return { confidence: avgConfidence, status: needsReview ? "NEEDS_REVIEW" : "PARSED" };
    }
    eventInclude() {
        return { organizer: true, venue: true, city: true, county: true, region: true, category: true, categories: { include: { category: true } } };
    }
    cleanCandidateOverride(candidate) {
        if (!candidate)
            return {};
        return Object.fromEntries(Object.entries(candidate).map(([key, value]) => [
            key,
            typeof value === "string" ? value.trim() : value,
        ]).filter(([, value]) => value !== undefined));
    }
    async findOrCreateOrganizerId(name) {
        const cleaned = name?.trim();
        if (!cleaned)
            return undefined;
        const existing = await this.prisma.organizer.findFirst({ where: { name: { equals: cleaned, mode: "insensitive" } } });
        if (existing)
            return existing.id;
        const slug = await (0, slug_1.uniqueSlug)(cleaned, async (s) => !!(await this.prisma.organizer.findUnique({ where: { slug: s } })));
        const organizer = await this.prisma.organizer.create({ data: { name: cleaned, slug, status: client_1.OrganizerStatus.UNCLAIMED } });
        return organizer.id;
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
