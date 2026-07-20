import { BadRequestException, ForbiddenException, Injectable } from "@nestjs/common";
import { EventStatus, EventSourceType, EmailContactSource } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { EventUpsertDto } from "../events/event.dto";
import { EventsService } from "../events/events.service";
import { AiEventParserService, ParsedEventCandidate, ParsedSourceResult } from "../ai-parser/ai-event-parser.service";
import { EmailService } from "../email/email.service";
import { formatHrDate } from "../email/format-date";
import { ResendContactsService } from "../contacts/resend-contacts.service";
import { OrganizerProfileDto, SubmitSourceDto } from "./organizer.dto";

@Injectable()
export class OrganizerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventsService,
    private readonly parser: AiEventParserService,
    private readonly email: EmailService,
    private readonly contacts: ResendContactsService
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

  async createEvent(organizerId: number, dto: EventUpsertDto, organizerEmail?: string, userId?: number) {
    const organizer = await this.prisma.organizer.findUniqueOrThrow({ where: { id: organizerId } });
    const status = organizer.status === "TRUSTED" ? EventStatus.PUBLISHED : EventStatus.PENDING_REVIEW;
    const event = await this.events.createFromDto(dto, { organizerId, status, sourceType: "ORGANIZER_FORM" });

    await this.notifyEventCreated(event, organizer.name, status, organizerEmail);

    // ResendContactsService guarantees this never throws; the try/catch here
    // is a second guard so event creation can never fail even if that
    // guarantee is ever broken.
    try {
      await this.contacts.syncEventSubmitter(organizerEmail, EmailContactSource.EVENT_SUBMISSION, organizer, userId);
    } catch {
      // intentionally swallowed — see comment above
    }

    return event;
  }

  /** Never throws — organizer/admin notification failures must never fail event creation. */
  private async notifyEventCreated(
    event: { id: number; title: string; slug: string; startsAt: Date; cityName: string | null },
    organizerName: string,
    status: typeof EventStatus.PUBLISHED | typeof EventStatus.PENDING_REVIEW,
    organizerEmail?: string
  ): Promise<void> {
    try {
      if (organizerEmail) {
        const emailData = {
          eventTitle: event.title,
          eventDateLabel: formatHrDate(event.startsAt),
          eventLocationLabel: event.cityName || undefined,
          webUrl: this.email.webUrl,
        };
        if (status === EventStatus.PUBLISHED) {
          await this.email.sendEventPublished(
            organizerEmail,
            { ...emailData, publicEventUrl: `${this.email.webUrl}/eventi/${event.slug}` },
            event.id
          );
        } else {
          await this.email.sendEventSubmitted(
            organizerEmail,
            { ...emailData, organizerEventUrl: `${this.email.webUrl}/organizer/events/${event.id}` },
            event.id
          );
        }
      }

      if (status === EventStatus.PENDING_REVIEW) {
        await this.email.sendAdminNewSubmission(
          {
            titleOrSource: event.title,
            organizerLabel: organizerName,
            sourceTypeLabel: "Organizator — ručni unos",
            adminReviewUrl: `${this.email.webUrl}/admin/events/${event.id}`,
            webUrl: this.email.webUrl,
          },
          event.id
        );
      }
    } catch {
      // EmailService.send* already catches provider errors; this guards against
      // an unexpected failure in the data prepared above so it can never bubble up.
    }
  }

  async deleteEvent(organizerId: number, id: number) {
    const event = await this.prisma.event.findFirst({ where: { id, organizerId } });
    if (!event) throw new BadRequestException("Event not found for organizer");
    if (event.status !== "PENDING_REVIEW" && event.status !== "DRAFT") {
      throw new ForbiddenException("Možete obrisati samo evente na pregledu ili nacrte.");
    }
    await this.prisma.eventSource.updateMany({ where: { eventId: id }, data: { eventId: null } });
    return this.prisma.event.delete({ where: { id } });
  }

  async updateEvent(organizerId: number, id: number, dto: EventUpsertDto) {
    const event = await this.prisma.event.findFirst({ where: { id, organizerId } });
    if (!event) throw new BadRequestException("Event not found for organizer");
    return this.events.updateEvent(id, { ...dto, status: EventStatus.PENDING_REVIEW });
  }

  async submitSource(organizerId: number, dto: SubmitSourceDto, organizerEmail?: string, userId?: number) {
    const sourceUrl = dto.sourceUrl?.trim() || undefined;
    let rawText = dto.rawText?.trim() || undefined;
    const hasScreenshot = Boolean(dto.screenshotBase64 && dto.screenshotMediaType);
    const isFacebook = this.isFacebookUrl(sourceUrl);

    if (isFacebook && !rawText && !hasScreenshot) {
      throw new BadRequestException("Facebook link se ne može pouzdano pročitati. Uploadajte screenshot/plakat ili zalijepite tekst opisa.");
    }

    if (!sourceUrl && !rawText && !hasScreenshot) {
      throw new BadRequestException("Dodajte link, tekst ili screenshot/plakat.");
    }

    // Fetch URL content unless it's Facebook (parser handles FB warning itself)
    let rawHtml: string | undefined;
    const fetchWarnings: string[] = [];
    if (sourceUrl && !isFacebook) {
      try {
        const response = await fetch(sourceUrl, {
          headers: { "User-Agent": "Manifestacije/1.0 event-ingestion-bot (+https://manifestacije.hr)" },
          signal: AbortSignal.timeout(12000),
        });
        if (response.ok) {
          rawHtml = await response.text();
        } else {
          fetchWarnings.push(`HTTP ${response.status} when fetching URL`);
        }
      } catch (err) {
        fetchWarnings.push(`Failed to fetch URL: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    // If main page is a listing (many event sub-links, no dates in text), crawl sub-pages
    let subPageWarning: string | undefined;
    if (rawHtml && sourceUrl && !isFacebook && !hasScreenshot) {
      const crawl = await this.parser.crawlListingSubPages(rawHtml, sourceUrl);
      if (crawl.subTexts.length > 0) {
        rawText = crawl.subTexts.join("\n\n---\n\n");
        rawHtml = undefined;
        if (crawl.totalFound > crawl.fetched) {
          subPageWarning = `Stranica sadrži ${crawl.totalFound} događaja; obrađeno prvih ${crawl.fetched}.`;
        }
      }
    }

    const useLlm = Boolean(dto.useLlm || hasScreenshot || isFacebook);
    const result = useLlm
      ? await this.parser.parseBatchWithLlm({
          rawText,
          rawHtml,
          sourceUrl,
          screenshotBase64: dto.screenshotBase64,
          screenshotMediaType: dto.screenshotMediaType,
          contextHint: dto.contextHint,
        })
      : await this.parser.parseBatch({ rawText, rawHtml, sourceUrl });

    if (fetchWarnings.length) {
      result.candidates.forEach((c) => c.warnings.push(...fetchWarnings));
    }
    if (subPageWarning) {
      result.candidates.forEach((c) => c.warnings.push(subPageWarning!));
    }

    const parsed = dto.sourceImageUrl ? { ...result, sourceImageUrl: dto.sourceImageUrl } : result;
    const { confidence, status } = this.sourceMetaFromResult(result, isFacebook);

    const source = await this.prisma.eventSource.create({
      data: {
        organizerId,
        type: sourceUrl ? EventSourceType.URL : EventSourceType.MANUAL,
        sourceUrl,
        rawText,
        rawHtml,
        parsedJson: parsed as object,
        confidence,
        status,
      }
    });

    const firstCandidate = result.candidates[0];
    const titleOrSource = firstCandidate?.title || sourceUrl || "Zaprimljeni sadržaj";

    await this.notifySourceSubmitted(source.id, organizerId, titleOrSource, firstCandidate, sourceUrl, organizerEmail);

    if (organizerEmail) {
      try {
        const organizer = await this.prisma.organizer.findUnique({ where: { id: organizerId } });
        await this.contacts.syncEventSubmitter(organizerEmail, EmailContactSource.SOURCE_SUBMISSION, organizer, userId);
      } catch {
        // ResendContactsService guarantees this never throws; this try/catch
        // is a second guard so source submission can never fail even if that
        // guarantee is ever broken.
      }
    }

    return source;
  }

  /** Never throws — organizer/admin notification failures must never fail source submission. */
  private async notifySourceSubmitted(
    sourceId: number,
    organizerId: number,
    titleOrSource: string,
    firstCandidate: ParsedEventCandidate | undefined,
    sourceUrl: string | undefined,
    organizerEmail?: string
  ): Promise<void> {
    try {
      if (organizerEmail) {
        await this.email.sendEventSubmitted(
          organizerEmail,
          {
            eventTitle: titleOrSource,
            eventDateLabel: firstCandidate?.startsAt ? formatHrDate(new Date(firstCandidate.startsAt)) : undefined,
            eventLocationLabel: firstCandidate?.city || undefined,
            organizerEventUrl: `${this.email.webUrl}/organizer/events`,
            webUrl: this.email.webUrl,
          }
        );
      }

      const organizer = await this.prisma.organizer.findUnique({ where: { id: organizerId } });
      await this.email.sendAdminNewSubmission(
        {
          titleOrSource,
          organizerLabel: organizer?.name,
          sourceTypeLabel: sourceUrl ? "Organizator — poveznica" : "Organizator — sadržaj",
          adminReviewUrl: `${this.email.webUrl}/admin/sources/${sourceId}`,
          warningsCount: firstCandidate?.warnings.length,
          webUrl: this.email.webUrl,
        },
        sourceId
      );
    } catch {
      // EmailService.send* already catches provider errors; this guards against
      // an unexpected failure in the data prepared above so it can never bubble up.
    }
  }

  listSources(organizerId: number) {
    return this.prisma.eventSource.findMany({
      where: { organizerId },
      select: {
        id: true,
        sourceUrl: true,
        rawText: true,
        status: true,
        confidence: true,
        createdAt: true,
        parsedJson: true,
      },
      orderBy: { createdAt: "desc" },
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
