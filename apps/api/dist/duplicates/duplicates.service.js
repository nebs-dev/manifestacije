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
exports.DuplicatesService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
let DuplicatesService = class DuplicatesService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async detectForEvent(eventId) {
        const event = await this.prisma.event.findUnique({ where: { id: eventId }, include: { venue: true } });
        if (!event)
            return [];
        const others = await this.prisma.event.findMany({ where: { id: { not: eventId }, cityId: event.cityId } });
        const created = [];
        for (const other of others) {
            const score = this.score(event, other);
            if (score >= 0.72) {
                const a = Math.min(event.id, other.id);
                const b = Math.max(event.id, other.id);
                created.push(await this.prisma.eventDuplicateCandidate.upsert({
                    where: { eventAId_eventBId: { eventAId: a, eventBId: b } },
                    update: { score, reason: "similar title/date/city/source" },
                    create: { eventAId: a, eventBId: b, score, reason: "similar title/date/city/source" }
                }));
            }
        }
        return created;
    }
    list() {
        return this.prisma.eventDuplicateCandidate.findMany({ include: { eventA: true, eventB: true }, orderBy: { createdAt: "desc" } });
    }
    merge(id) {
        return this.prisma.eventDuplicateCandidate.update({ where: { id }, data: { status: "MERGED" } });
    }
    dismiss(id) {
        return this.prisma.eventDuplicateCandidate.update({ where: { id }, data: { status: "DISMISSED" } });
    }
    score(a, b) {
        let score = this.titleSimilarity(a.title, b.title) * 0.55;
        const dayDiff = Math.abs(a.startsAt.getTime() - b.startsAt.getTime()) / (24 * 60 * 60 * 1000);
        if (dayDiff < 1)
            score += 0.25;
        if (a.organizerId && a.organizerId === b.organizerId)
            score += 0.1;
        if (a.sourceUrl && a.sourceUrl === b.sourceUrl)
            score += 0.25;
        return Math.min(score, 1);
    }
    titleSimilarity(a, b) {
        const aw = new Set(a.toLowerCase().split(/\W+/).filter(Boolean));
        const bw = new Set(b.toLowerCase().split(/\W+/).filter(Boolean));
        const overlap = [...aw].filter((w) => bw.has(w)).length;
        return overlap / Math.max(aw.size, bw.size, 1);
    }
};
exports.DuplicatesService = DuplicatesService;
exports.DuplicatesService = DuplicatesService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], DuplicatesService);
