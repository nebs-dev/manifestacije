import { DuplicateInput, duplicateSlots, matchDuplicate, publicDuplicate, titleSimilarity } from "./duplicate-matching";
import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class DuplicatesService {
  constructor(private readonly prisma: PrismaService) {}

  async candidates(input: DuplicateInput, excludeId?: number) {
    if (input.cityId && !input.cityName) {
      const city = await this.prisma.city.findUnique({ where: { id: input.cityId }, select: { name: true } });
      input = { ...input, cityName: city?.name };
    }
    const slots = duplicateSlots(input);
    if (!input.title?.trim() || !slots.length) return [];
    const from = new Date(Math.min(...slots.map(row => row.start.getTime())) - 86400000);
    const to = new Date(Math.max(...slots.map(row => row.end.getTime())) + 86400000);
    const events = await this.prisma.event.findMany({ where: {
      ...(excludeId ? { id: { not: excludeId } } : {}),
      AND: [
        { status: { not: "REJECTED" } },
        { OR: [{ status: { not: "ARCHIVED" } }, { publishedAt: { not: null } }] },
        { OR: [
          { startsAt: { gte: from, lte: to } }, { startsAt: { lte: to }, endsAt: { gte: from } },
          { occurrences: { some: { OR: [{ startsAt: { gte: from, lte: to } }, { startsAt: { lte: to }, endsAt: { gte: from } }] } } },
        ] },
      ],
    }, include: { venue: true, city: true, occurrences: true } });
    return events.flatMap(event => { const match = matchDuplicate(input, event); return match ? [{ event, ...match }] : []; })
      .sort((a, b) => b.score - a.score || a.event.id - b.event.id);
  }

  /** Read-only. Private matches produce only a boolean, never IDs, scores,
   * reasons, dates, location or counts in an organizer response. */
  async check(input: DuplicateInput, organizerId?: number) {
    const found = await this.candidates(input);
    const visible = found.filter(row => organizerId === undefined || publicDuplicate(row.event) || row.event.organizerId === organizerId);
    return { matches: visible.slice(0, 5).map(({ event, score, reasons, startsAt, endsAt, isAllDay }) => ({
      id: event.id, title: event.title, startsAt, endsAt, isAllDay,
      cityName: event.city?.name || event.cityName || null, venueName: event.venue?.name || null,
      address: event.venue?.address || event.address || null, score, reasons,
      href: organizerId === undefined ? `/admin/events/${event.id}` : event.organizerId === organizerId ? `/organizer/events/${event.id}` : `/eventi/${encodeURIComponent(event.slug)}`,
    })), hiddenMatch: visible.length < found.length };
  }

  async detectForEvent(eventId: number) {
    const event = await this.prisma.event.findUnique({ where: { id: eventId }, include: { venue: true, city: true, occurrences: true } });
    if (!event || event.status === "REJECTED") return [];
    const matches = await this.candidates({ ...event, cityName: event.city?.name || event.cityName, venueName: event.venue?.name }, eventId);
    return Promise.all(matches.map(({ event: other, score, reasons }) => {
      const eventAId = Math.min(event.id, other.id), eventBId = Math.max(event.id, other.id), reason = reasons.join(" · ");
      return this.prisma.eventDuplicateCandidate.upsert({ where: { eventAId_eventBId: { eventAId, eventBId } },
        update: { score, reason }, create: { eventAId, eventBId, score, reason } });
    }));
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

  titleSimilarity(a: string, b: string) { return titleSimilarity(a, b); }
}
