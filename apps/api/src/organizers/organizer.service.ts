import { BadRequestException, Injectable } from "@nestjs/common";
import { EventStatus, EventSourceType } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { EventUpsertDto } from "../events/event.dto";
import { EventsService } from "../events/events.service";
import { AiEventParserService } from "../ai-parser/ai-event-parser.service";
import { OrganizerProfileDto, SubmitSourceDto } from "./organizer.dto";

@Injectable()
export class OrganizerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventsService,
    private readonly parser: AiEventParserService
  ) {}

  profile(organizerId: number) {
    return this.prisma.organizer.findUnique({ where: { id: organizerId } });
  }

  updateProfile(organizerId: number, dto: OrganizerProfileDto) {
    return this.prisma.organizer.update({ where: { id: organizerId }, data: dto });
  }

  listEvents(organizerId: number) {
    return this.prisma.event.findMany({ where: { organizerId }, include: { city: true, category: true }, orderBy: { startsAt: "asc" } });
  }

  async createEvent(organizerId: number, dto: EventUpsertDto) {
    const organizer = await this.prisma.organizer.findUniqueOrThrow({ where: { id: organizerId } });
    return this.events.createFromDto(dto, {
      organizerId,
      status: organizer.status === "TRUSTED" ? EventStatus.PUBLISHED : EventStatus.PENDING_REVIEW,
      sourceType: "ORGANIZER_FORM"
    });
  }

  async updateEvent(organizerId: number, id: number, dto: EventUpsertDto) {
    const event = await this.prisma.event.findFirst({ where: { id, organizerId } });
    if (!event) throw new BadRequestException("Event not found for organizer");
    return this.events.updateEvent(id, { ...dto, status: EventStatus.PENDING_REVIEW });
  }

  async submitSource(organizerId: number, dto: SubmitSourceDto) {
    const parsed = await this.parser.parse({ rawText: dto.rawText, sourceUrl: dto.sourceUrl });
    return this.prisma.eventSource.create({
      data: {
        organizerId,
        type: dto.sourceUrl ? EventSourceType.URL : EventSourceType.MANUAL,
        sourceUrl: dto.sourceUrl,
        rawText: dto.rawText,
        parsedJson: parsed,
        confidence: parsed.confidence,
        status: parsed.missingFields.length ? "NEEDS_REVIEW" : "PARSED"
      }
    });
  }
}
