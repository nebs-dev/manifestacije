import { BadRequestException, Injectable } from "@nestjs/common";
import { EventStatus, EventSourceType } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { EventUpsertDto } from "../events/event.dto";
import { EventsService } from "../events/events.service";
import { AiEventParserService, ParsedSourceResult } from "../ai-parser/ai-event-parser.service";
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
    return this.prisma.event.findMany({
      where: { organizerId },
      include: { city: true, category: true, venue: true, categories: { include: { category: true } } },
      orderBy: { startsAt: "asc" },
    });
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
    const sourceUrl = dto.sourceUrl?.trim() || undefined;
    const rawText = dto.rawText?.trim() || undefined;
    const hasScreenshot = Boolean(dto.screenshotBase64 && dto.screenshotMediaType);
    const isFacebook = this.isFacebookUrl(sourceUrl);

    if (isFacebook && !rawText && !hasScreenshot) {
      throw new BadRequestException("Facebook link se ne može pouzdano pročitati. Uploadajte screenshot/plakat ili zalijepite tekst opisa.");
    }

    if (!sourceUrl && !rawText && !hasScreenshot) {
      throw new BadRequestException("Dodajte link, tekst ili screenshot/plakat.");
    }

    const useLlm = Boolean(dto.useLlm || hasScreenshot || isFacebook);
    const result = useLlm
      ? await this.parser.parseBatchWithLlm({
          rawText,
          sourceUrl,
          screenshotBase64: dto.screenshotBase64,
          screenshotMediaType: dto.screenshotMediaType,
          contextHint: dto.contextHint,
        })
      : await this.parser.parseBatch({ rawText, sourceUrl });

    const parsed = dto.sourceImageUrl ? { ...result, sourceImageUrl: dto.sourceImageUrl } : result;
    const { confidence, status } = this.sourceMetaFromResult(result, isFacebook);

    return this.prisma.eventSource.create({
      data: {
        organizerId,
        type: sourceUrl ? EventSourceType.URL : EventSourceType.MANUAL,
        sourceUrl,
        rawText,
        parsedJson: parsed as object,
        confidence,
        status,
      }
    });
  }

  private sourceMetaFromResult(result: ParsedSourceResult, forceReview = false): { confidence: number; status: "PARSED" | "NEEDS_REVIEW" } {
    const confidence = result.candidates.length
      ? result.candidates.reduce((sum, candidate) => sum + candidate.confidence, 0) / result.candidates.length
      : 0;
    const needsReview = forceReview || result.candidates.some((candidate) => candidate.missingFields.length > 0);
    return { confidence, status: needsReview ? "NEEDS_REVIEW" : "PARSED" };
  }

  private isFacebookUrl(url?: string): boolean {
    if (!url) return false;
    try {
      const hostname = new URL(url).hostname.toLowerCase().replace(/^www\./, "");
      return hostname === "fb.me" || hostname === "facebook.com" || hostname.endsWith(".facebook.com");
    } catch {
      return false;
    }
  }
}
