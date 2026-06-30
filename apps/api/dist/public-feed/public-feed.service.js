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
exports.PublicFeedService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../prisma/prisma.service");
const eventInclude = {
    organizer: true,
    venue: true,
    city: true,
    county: true,
    region: true,
    category: true,
    categories: { include: { category: true } },
};
let PublicFeedService = class PublicFeedService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async events(query) {
        const where = await this.publicWhere(query);
        return this.prisma.event.findMany({ where, include: eventInclude, orderBy: { startsAt: "asc" }, take: 100 });
    }
    async event(slug) {
        return this.prisma.event.findFirst({ where: { slug, status: client_1.EventStatus.PUBLISHED }, include: eventInclude });
    }
    regions() {
        return this.prisma.region.findMany({ orderBy: { sortOrder: "asc" } });
    }
    categories() {
        return this.prisma.category.findMany({ orderBy: { sortOrder: "asc" } });
    }
    async byRegion(slug) {
        return this.events({ region: slug });
    }
    async byCity(slug) {
        return this.events({ city: slug });
    }
    async byCategory(slug) {
        return this.events({ category: slug });
    }
    async mapEvents() {
        return this.prisma.event.findMany({
            where: { status: client_1.EventStatus.PUBLISHED },
            include: eventInclude,
            orderBy: { startsAt: "asc" },
            take: 200
        });
    }
    async sitemapData() {
        const [events, regions, cities, categories] = await Promise.all([
            this.prisma.event.findMany({ where: { status: client_1.EventStatus.PUBLISHED }, select: { slug: true, updatedAt: true } }),
            this.prisma.region.findMany({ select: { slug: true } }),
            this.prisma.city.findMany({ select: { slug: true } }),
            this.prisma.category.findMany({ select: { slug: true } })
        ]);
        return { events, regions, cities, categories };
    }
    async publicWhere(query) {
        const where = { status: client_1.EventStatus.PUBLISHED };
        if (query.region)
            where.region = { slug: query.region };
        if (query.county)
            where.county = { slug: query.county };
        if (query.city)
            where.city = { slug: query.city };
        if (query.free === "true")
            where.isFree = true;
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
        }
        else if (query.weekend === "true") {
            const start = new Date(now);
            const day = start.getDay();
            const daysUntilSaturday = (6 - day + 7) % 7;
            start.setDate(start.getDate() + daysUntilSaturday);
            start.setHours(0, 0, 0, 0);
            const end = new Date(start);
            end.setDate(start.getDate() + 1);
            end.setHours(23, 59, 59, 999);
            where.startsAt = { gte: start, lte: end };
        }
        else if (query.dateFrom || query.dateTo) {
            where.startsAt = {
                gte: query.dateFrom ? new Date(query.dateFrom) : undefined,
                lte: query.dateTo ? new Date(query.dateTo) : undefined
            };
        }
        return where;
    }
};
exports.PublicFeedService = PublicFeedService;
exports.PublicFeedService = PublicFeedService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], PublicFeedService);
