import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class DuplicatesService {
  constructor(private readonly prisma: PrismaService) {}

  async detectForEvent(eventId: number) {
    const event = await this.prisma.event.findUnique({ where: { id: eventId }, include: { venue: true } });
    if (!event) return [];
    const others = await this.prisma.event.findMany({ where: { id: { not: eventId }, cityId: event.cityId } });
    const created = [];
    for (const other of others) {
      const score = this.score(event, other);
      if (score >= 0.72) {
        const a = Math.min(event.id, other.id);
        const b = Math.max(event.id, other.id);
        created.push(
          await this.prisma.eventDuplicateCandidate.upsert({
            where: { eventAId_eventBId: { eventAId: a, eventBId: b } },
            update: { score, reason: "similar title/date/city/source" },
            create: { eventAId: a, eventBId: b, score, reason: "similar title/date/city/source" }
          })
        );
      }
    }
    return created;
  }

  list() {
    return this.prisma.eventDuplicateCandidate.findMany({ include: { eventA: true, eventB: true }, orderBy: { createdAt: "desc" } });
  }

  merge(id: number) {
    return this.prisma.eventDuplicateCandidate.update({ where: { id }, data: { status: "MERGED" } });
  }

  dismiss(id: number) {
    return this.prisma.eventDuplicateCandidate.update({ where: { id }, data: { status: "DISMISSED" } });
  }

  private score(a: { title: string; startsAt: Date; organizerId: number | null; sourceUrl: string | null }, b: typeof a) {
    let score = this.titleSimilarity(a.title, b.title) * 0.55;
    const dayDiff = Math.abs(a.startsAt.getTime() - b.startsAt.getTime()) / (24 * 60 * 60 * 1000);
    if (dayDiff < 1) score += 0.25;
    if (a.organizerId && a.organizerId === b.organizerId) score += 0.1;
    if (a.sourceUrl && a.sourceUrl === b.sourceUrl) score += 0.25;
    return Math.min(score, 1);
  }

  private titleSimilarity(a: string, b: string) {
    const aw = new Set(a.toLowerCase().split(/\W+/).filter(Boolean));
    const bw = new Set(b.toLowerCase().split(/\W+/).filter(Boolean));
    const overlap = [...aw].filter((w) => bw.has(w)).length;
    return overlap / Math.max(aw.size, bw.size, 1);
  }
}
