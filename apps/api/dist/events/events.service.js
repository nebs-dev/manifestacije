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
exports.EventsService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../prisma/prisma.service");
const slug_1 = require("../common/slug");
const duplicates_service_1 = require("../duplicates/duplicates.service");
let EventsService = class EventsService {
    prisma;
    duplicates;
    constructor(prisma, duplicates) {
        this.prisma = prisma;
        this.duplicates = duplicates;
    }
    async createFromDto(dto, opts) {
        const city = await this.prisma.city.findUnique({ where: { id: dto.cityId }, include: { county: true } });
        if (!city)
            throw new common_1.BadRequestException("Unknown cityId");
        const category = await this.prisma.category.findUnique({ where: { id: dto.categoryId } });
        if (!category)
            throw new common_1.BadRequestException("Unknown categoryId");
        let venueId;
        if (dto.venueName) {
            const venueSlug = (0, slug_1.slugify)(dto.venueName);
            const venue = await this.prisma.venue.upsert({
                where: { slug_cityId: { slug: venueSlug, cityId: city.id } },
                update: { address: dto.address },
                create: { name: dto.venueName, slug: venueSlug, cityId: city.id, address: dto.address }
            });
            venueId = venue.id;
        }
        const slug = await (0, slug_1.uniqueSlug)(dto.title, async (s) => !!(await this.prisma.event.findUnique({ where: { slug: s } })));
        const event = await this.prisma.event.create({
            data: {
                title: dto.title,
                slug,
                description: dto.description,
                shortDescription: dto.shortDescription,
                status: opts.status || client_1.EventStatus.PENDING_REVIEW,
                organizerId: opts.organizerId || undefined,
                venueId,
                cityId: city.id,
                countyId: city.countyId,
                regionId: city.county.regionId,
                categoryId: category.id,
                startsAt: new Date(dto.startsAt),
                endsAt: dto.endsAt ? new Date(dto.endsAt) : undefined,
                isAllDay: dto.isAllDay || false,
                isFree: dto.isFree,
                priceText: dto.priceText,
                ticketUrl: dto.ticketUrl,
                sourceUrl: dto.sourceUrl,
                sourceType: opts.sourceType || client_1.EventSourceKind.MANUAL,
                publishedAt: opts.status === client_1.EventStatus.PUBLISHED ? new Date() : undefined
            }
        });
        await this.duplicates.detectForEvent(event.id);
        return event;
    }
    async updateEvent(id, dto) {
        const current = await this.prisma.event.findUnique({ where: { id } });
        if (!current)
            throw new common_1.NotFoundException("Event not found");
        const city = dto.cityId ? await this.prisma.city.findUnique({ where: { id: dto.cityId }, include: { county: true } }) : null;
        const data = {
            title: dto.title,
            description: dto.description,
            shortDescription: dto.shortDescription,
            categoryId: dto.categoryId,
            startsAt: dto.startsAt ? new Date(dto.startsAt) : undefined,
            endsAt: dto.endsAt ? new Date(dto.endsAt) : undefined,
            isAllDay: dto.isAllDay,
            isFree: dto.isFree,
            priceText: dto.priceText,
            ticketUrl: dto.ticketUrl,
            sourceUrl: dto.sourceUrl,
            status: dto.status
        };
        if (city) {
            data.cityId = city.id;
            data.countyId = city.countyId;
            data.regionId = city.county.regionId;
        }
        Object.keys(data).forEach((key) => data[key] === undefined && delete data[key]);
        const event = await this.prisma.event.update({ where: { id }, data });
        await this.duplicates.detectForEvent(id);
        return event;
    }
};
exports.EventsService = EventsService;
exports.EventsService = EventsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService, duplicates_service_1.DuplicatesService])
], EventsService);
