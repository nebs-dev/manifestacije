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
exports.OrganizerService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../prisma/prisma.service");
const events_service_1 = require("../events/events.service");
const ai_event_parser_service_1 = require("../ai-parser/ai-event-parser.service");
let OrganizerService = class OrganizerService {
    prisma;
    events;
    parser;
    constructor(prisma, events, parser) {
        this.prisma = prisma;
        this.events = events;
        this.parser = parser;
    }
    profile(organizerId) {
        return this.prisma.organizer.findUnique({ where: { id: organizerId } });
    }
    updateProfile(organizerId, dto) {
        return this.prisma.organizer.update({ where: { id: organizerId }, data: dto });
    }
    listEvents(organizerId) {
        return this.prisma.event.findMany({ where: { organizerId }, include: { city: true, category: true }, orderBy: { startsAt: "asc" } });
    }
    async createEvent(organizerId, dto) {
        const organizer = await this.prisma.organizer.findUniqueOrThrow({ where: { id: organizerId } });
        return this.events.createFromDto(dto, {
            organizerId,
            status: organizer.status === "TRUSTED" ? client_1.EventStatus.PUBLISHED : client_1.EventStatus.PENDING_REVIEW,
            sourceType: "ORGANIZER_FORM"
        });
    }
    async updateEvent(organizerId, id, dto) {
        const event = await this.prisma.event.findFirst({ where: { id, organizerId } });
        if (!event)
            throw new common_1.BadRequestException("Event not found for organizer");
        return this.events.updateEvent(id, { ...dto, status: client_1.EventStatus.PENDING_REVIEW });
    }
    async submitSource(organizerId, dto) {
        const parsed = await this.parser.parse({ rawText: dto.rawText, sourceUrl: dto.sourceUrl });
        return this.prisma.eventSource.create({
            data: {
                organizerId,
                type: dto.sourceUrl ? client_1.EventSourceType.URL : client_1.EventSourceType.MANUAL,
                sourceUrl: dto.sourceUrl,
                rawText: dto.rawText,
                parsedJson: parsed,
                confidence: parsed.confidence,
                status: parsed.missingFields.length ? "NEEDS_REVIEW" : "PARSED"
            }
        });
    }
};
exports.OrganizerService = OrganizerService;
exports.OrganizerService = OrganizerService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        events_service_1.EventsService,
        ai_event_parser_service_1.AiEventParserService])
], OrganizerService);
