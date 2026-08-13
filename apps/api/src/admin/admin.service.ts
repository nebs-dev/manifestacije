import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { EventStatus, EventSourceType, OrganizerStatus, Prisma } from "@prisma/client";
import * as bcrypt from "bcryptjs";
import { PrismaService } from "../prisma/prisma.service";
import { slugify, uniqueSlug } from "../common/slug";
import { findOrCreateCity } from "../common/city-resolver";
import { EventsService } from "../events/events.service";
import { AiEventParserService, ParsedEventCandidate, ParsedSourceResult } from "../ai-parser/ai-event-parser.service";
import { DuplicatesService } from "../duplicates/duplicates.service";
import { dropPastCandidates, flagAlreadyImported } from "../ai-parser/candidate-filters";
import { EmailService } from "../email/email.service";
import { formatHrDate } from "../email/format-date";
import { AdminEventDto, CandidateOverrideDto, ManualEmailDto, OrganizerAdminDto, ParseUrlDto, SplitWeeklySeriesDto, UpdateEventSourceDto } from "./admin.dto";
import { RevalidateService } from "./revalidate.service";
import { zagrebLocalToUtc } from "../common/weekend";
import { UploadsService } from "./uploads.service";

export type AdminEventListParams = {
  sortBy?: string;
  sortDir?: string;
  search?: string;
  status?: string;
  organizerId?: string;
  startsFrom?: string;
  startsTo?: string;
  createdFrom?: string;
  createdTo?: string;
  page?: string;
  pageSize?: string;
  fieldFilters?: string;
};

type AdminEventFieldFilter = {
  field: string;
  op?: string;
  value?: string;
};

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventsService,
    private readonly parser: AiEventParserService,
    private readonly duplicates: DuplicatesService,
    private readonly revalidate: RevalidateService,
    private readonly email: EmailService,
    private readonly uploads: UploadsService,
  ) {}

  async pendingCounts(params?: { sourcesSince?: string; eventsSince?: string }) {
    const eventsSinceDate = params?.eventsSince ? new Date(params.eventsSince) : undefined;
    const [sources, events, organizers] = await Promise.all([
      this.prisma.eventSource.count({
        where: {
          status: { in: ["NEW", "PARSED", "NEEDS_REVIEW"] },
          adminViewedAt: null,
        },
      }),
      this.prisma.event.count({
        where: {
          status: EventStatus.PENDING_REVIEW,
          sourceType: "ORGANIZER_FORM",
          ...(eventsSinceDate ? { createdAt: { gte: eventsSinceDate } } : {}),
        },
      }),
      this.prisma.organizer.count({
        where: {
          adminViewedAt: null,
          users: { some: {} },
        },
      }),
    ]);
    return { sources, events, organizers };
  }

  async bulkAssignCategory(eventIds: number[], categoryId: number, action: "add" | "remove") {
    if (action === "remove") {
      await this.prisma.eventCategory.deleteMany({
        where: { eventId: { in: eventIds }, categoryId },
      });
    } else {
      for (const eventId of eventIds) {
        await this.prisma.eventCategory.upsert({
          where: { eventId_categoryId: { eventId, categoryId } },
          update: {},
          create: { eventId, categoryId, source: "MANUAL" },
        });
      }
    }
  }

  async bulkSetStatus(eventIds: number[], status: EventStatus) {
    const changedIds = (status === EventStatus.PUBLISHED || status === EventStatus.REJECTED)
      ? (await this.prisma.event.findMany({ where: { id: { in: eventIds }, status: { not: status } }, select: { id: true } })).map((e) => e.id)
      : [];

    const result = await this.prisma.event.updateMany({
      where: { id: { in: eventIds } },
      data: { status, publishedAt: status === EventStatus.PUBLISHED ? new Date() : undefined },
    });
    void this.revalidate.revalidate("events");

    for (const eventId of changedIds) {
      await this.notifyOrganizerOfStatusChange(eventId, status as typeof EventStatus.PUBLISHED | typeof EventStatus.REJECTED);
    }

    return result;
  }

  async bulkShiftDates(eventIds: number[], days: number) {
    const events = await this.prisma.event.findMany({
      where: { id: { in: eventIds } },
      select: { id: true, startsAt: true, endsAt: true },
    });
    const shiftMs = days * 24 * 60 * 60 * 1000;
    await this.prisma.$transaction(
      events.map((e) =>
        this.prisma.event.update({
          where: { id: e.id },
          data: {
            startsAt: new Date(e.startsAt.getTime() + shiftMs),
            endsAt: e.endsAt ? new Date(e.endsAt.getTime() + shiftMs) : undefined,
          },
        })
      )
    );
    void this.revalidate.revalidate("events");
    return { count: events.length };
  }

  async pendingEvents(params?: AdminEventListParams) {
    const where = { ...this.eventListWhere(params), status: EventStatus.PENDING_REVIEW };
    return this.paginatedEvents(where, params);
  }

  allEvents(params?: AdminEventListParams) {
    return this.paginatedEvents(this.eventListWhere(params), params);
  }

  event(id: number) {
    return this.prisma.event.findUnique({ where: { id }, include: { ...this.eventInclude(), sources: true, duplicatesA: true, duplicatesB: true } });
  }

  async updateEvent(id: number, dto: AdminEventDto) {
    const result = await this.events.updateEvent(id, dto);
    void this.revalidate.revalidate("events");
    return result;
  }

  async createEvent(dto: AdminEventDto) {
    if (dto.repeatWeeklyUntil) return this.createWeeklySeries(dto);

    const result = await this.events.createFromDto(dto, { organizerId: dto.organizerId, status: dto.status ?? EventStatus.DRAFT });
    if (dto.status === EventStatus.PUBLISHED) {
      void this.revalidate.revalidate("events");
      if (result.organizerId) await this.notifyOrganizerOfStatusChange(result.id, EventStatus.PUBLISHED);
    }
    return result;
  }

  /**
   * "Every Friday until 28.8." was previously entered as one event spanning
   * the whole range with isAllDay set, because there was nowhere else to put
   * a repeat rule. That single event then satisfied "occurs on Saturday" for
   * every Saturday inside the range too — a real data bug on the weekend
   * page, traced back to this being the only way to express a weekly repeat.
   *
   * Rather than add a recurrence rule that every date-range query in the
   * codebase (weekend grouping, calendar, "this weekend") would need to
   * learn to expand, each occurrence becomes its own real, single-day Event
   * row — the shape every existing query already assumes.
   */
  private async createWeeklySeries(dto: AdminEventDto) {
    if (!dto.startsAt) throw new BadRequestException("startsAt je obavezan za ponavljajući događaj");
    const start = new Date(dto.startsAt);
    const until = new Date(dto.repeatWeeklyUntil!);
    if (Number.isNaN(start.getTime())) throw new BadRequestException("Neispravan datum početka");
    if (Number.isNaN(until.getTime())) throw new BadRequestException("Neispravan datum ponavljanja");
    if (until < start) throw new BadRequestException("Datum ponavljanja mora biti nakon početka");

    const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
    const MAX_OCCURRENCES = 52; // one year of weekly repeats — a generous ceiling against a mistyped end date
    const durationMs = dto.endsAt ? new Date(dto.endsAt).getTime() - start.getTime() : null;

    const occurrences: { startsAt: string; endsAt?: string }[] = [];
    for (let occurrenceStart = start.getTime(); occurrenceStart <= until.getTime(); occurrenceStart += WEEK_MS) {
      if (occurrences.length >= MAX_OCCURRENCES) break;
      occurrences.push({
        startsAt: new Date(occurrenceStart).toISOString(),
        endsAt: durationMs != null ? new Date(occurrenceStart + durationMs).toISOString() : undefined,
      });
    }
    if (occurrences.length === 0) throw new BadRequestException("Nijedan termin ne pada u zadani raspon");

    const { repeatWeeklyUntil: _repeatWeeklyUntil, ...base } = dto;
    void _repeatWeeklyUntil;
    const created: Awaited<ReturnType<EventsService["createFromDto"]>>[] = [];
    for (const occurrence of occurrences) {
      created.push(await this.events.createFromDto(
        { ...base, startsAt: occurrence.startsAt, endsAt: occurrence.endsAt },
        { organizerId: dto.organizerId, status: dto.status ?? EventStatus.DRAFT },
      ));
    }

    if (dto.status === EventStatus.PUBLISHED) {
      void this.revalidate.revalidate("events");
      for (const event of created) {
        if (event.organizerId) await this.notifyOrganizerOfStatusChange(event.id, EventStatus.PUBLISHED);
      }
    }

    // The frontend expects one event back to redirect to; the first
    // occurrence is the natural one to land on, with the rest linked from it.
    return { ...created[0], _seriesCount: created.length, _seriesEventIds: created.map((e) => e.id) };
  }

  /**
   * Converts an existing event — typically one wrongly modeled as a single
   * all-day range spanning several weeks, because there was previously no
   * other way to express "every Friday" — into a real weekly series.
   *
   * The event's own weekday and calendar data (title, description, venue,
   * price, image, organizer, category…) are read straight off the row, so
   * the admin only supplies what genuinely can't be inferred: a real
   * time-of-day (an all-day event has none) and how far the repeat runs.
   *
   * The first occurrence updates the existing row in place rather than being
   * recreated, so its id and slug — and anything already linking to or
   * indexing that URL — keep working.
   */
  async splitIntoWeeklySeries(id: number, dto: SplitWeeklySeriesDto) {
    const event = await this.prisma.event.findUnique({ where: { id }, include: this.eventInclude() });
    if (!event) throw new NotFoundException("Event not found");

    const [startHour, startMinute] = this.parseHm(dto.startTime, "startTime");
    const endHm = dto.endTime ? this.parseHm(dto.endTime, "endTime") : null;

    const firstDay = this.parseIsoDate(dto.firstDate);
    const firstStart = zagrebLocalToUtc(firstDay.year, firstDay.month, firstDay.day, startHour, startMinute);
    const firstEnd = endHm ? zagrebLocalToUtc(firstDay.year, firstDay.month, firstDay.day, endHm[0], endHm[1]) : null;
    if (firstEnd && firstEnd <= firstStart) throw new BadRequestException("Vrijeme završetka mora biti nakon početka");

    const until = new Date(`${dto.repeatWeeklyUntil}T23:59:59`);
    if (Number.isNaN(until.getTime())) throw new BadRequestException("Neispravan datum ponavljanja");
    if (until < firstStart) throw new BadRequestException("Datum ponavljanja mora biti nakon prvog termina");

    const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
    const MAX_OCCURRENCES = 52; // one year of weekly repeats — a generous ceiling against a mistyped end date
    const durationMs = firstEnd ? firstEnd.getTime() - firstStart.getTime() : null;

    const occurrenceStarts: number[] = [];
    for (let t = firstStart.getTime(); t <= until.getTime() && occurrenceStarts.length < MAX_OCCURRENCES; t += WEEK_MS) {
      occurrenceStarts.push(t);
    }
    if (occurrenceStarts.length === 0) throw new BadRequestException("Nijedan termin ne pada u zadani raspon");

    const updatedFirst = await this.prisma.event.update({
      where: { id },
      data: {
        startsAt: new Date(occurrenceStarts[0]),
        endsAt: durationMs != null ? new Date(occurrenceStarts[0] + durationMs) : null,
        isAllDay: false,
      },
    });

    const createdIds = [updatedFirst.id];
    for (const t of occurrenceStarts.slice(1)) {
      const clone = await this.events.createFromDto(
        {
          title: event.title,
          description: event.description,
          cityId: event.cityId ?? undefined,
          cityName: event.cityName ?? undefined,
          categoryId: event.categoryId,
          categoryIds: event.categories.map((c) => c.categoryId),
          startsAt: new Date(t).toISOString(),
          endsAt: durationMs != null ? new Date(t + durationMs).toISOString() : undefined,
          isAllDay: false,
          isFree: event.isFree ?? undefined,
          priceText: event.priceText ?? undefined,
          ticketUrl: event.ticketUrl ?? undefined,
          sourceUrl: event.sourceUrl ?? undefined,
          venueName: event.venue?.name,
          address: event.venue?.address ?? event.address ?? undefined,
          lat: event.venue?.lat ?? event.lat ?? undefined,
          lng: event.venue?.lng ?? event.lng ?? undefined,
          imageUrl: event.imageUrl ?? undefined,
        },
        { organizerId: event.organizerId, status: event.status, sourceType: event.sourceType },
      );
      createdIds.push(clone.id);
    }

    if (event.status === EventStatus.PUBLISHED) void this.revalidate.revalidate("events");

    return { ...updatedFirst, _seriesCount: createdIds.length, _seriesEventIds: createdIds };
  }

  private parseHm(value: string, field: string): [number, number] {
    const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
    if (!match) throw new BadRequestException(`${field} mora biti u obliku SS:MM`);
    const hour = Number(match[1]);
    const minute = Number(match[2]);
    if (hour > 23 || minute > 59) throw new BadRequestException(`${field} nije valjano vrijeme`);
    return [hour, minute];
  }

  private parseIsoDate(value: string): { year: number; month: number; day: number } {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
    if (!match) throw new BadRequestException("Datum mora biti u obliku GGGG-MM-DD");
    return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
  }

  async setEventStatus(id: number, status: EventStatus) {
    const current = await this.prisma.event.findUnique({ where: { id }, select: { status: true } });
    const statusChanged = current?.status !== status;

    const result = await this.prisma.event.update({ where: { id }, data: { status, publishedAt: status === EventStatus.PUBLISHED ? new Date() : undefined } });
    void this.revalidate.revalidate("events");

    // Only notify on an actual transition — repeated approve/publish clicks on an
    // already-published event (or repeated reject) must not send duplicate emails.
    // Awaited (not voided) because notifyOrganizerOfStatusChange never throws — it
    // catches its own errors internally — so awaiting it can't fail this operation,
    // and doing so keeps status-change notifications deterministic for tests.
    if (statusChanged && (status === EventStatus.PUBLISHED || status === EventStatus.REJECTED)) {
      await this.notifyOrganizerOfStatusChange(result.id, status);
    }

    return result;
  }

  /** Never throws — a failure here (missing organizer, missing email, DB error,
   *  or delivery error) must never break the caller's status-change operation. */
  private async notifyOrganizerOfStatusChange(eventId: number, status: typeof EventStatus.PUBLISHED | typeof EventStatus.REJECTED): Promise<void> {
    try {
      const event = await this.prisma.event.findUnique({ where: { id: eventId }, include: { organizer: true } });
      const organizerEmail = event?.organizer?.email;
      if (!event || !organizerEmail) return;

      const shared = {
        eventTitle: event.title,
        eventDateLabel: formatHrDate(event.startsAt),
        eventLocationLabel: event.cityName || undefined,
        webUrl: this.email.webUrl,
      };

      if (status === EventStatus.PUBLISHED) {
        await this.email.sendEventPublished(organizerEmail, { ...shared, publicEventUrl: `${this.email.webUrl}/eventi/${event.slug}` }, event.id);
      } else {
        // Schema has no rejection-reason field today — template falls back to neutral wording.
        await this.email.sendEventRejected(organizerEmail, { eventTitle: event.title, webUrl: this.email.webUrl }, event.id);
      }
    } catch {
      // EmailService.send* already catches provider errors; this guards against
      // an unexpected failure in the prisma lookup above so it can never bubble up.
    }
  }

  async duplicateEvent(id: number) {
    const current = await this.prisma.event.findUnique({
      where: { id },
      include: { categories: true },
    });
    if (!current) throw new NotFoundException("Event not found");

    const title = `${current.title} (kopija)`;
    const slug = await uniqueSlug(title, async (s) => !!(await this.prisma.event.findUnique({ where: { slug: s } })));
    const duplicated = await this.prisma.event.create({
      data: {
        title,
        slug,
        description: current.description,
        status: EventStatus.DRAFT,
        organizerId: current.organizerId,
        venueId: current.venueId,
        cityId: current.cityId,
        countyId: current.countyId,
        regionId: current.regionId,
        categoryId: current.categoryId,
        startsAt: current.startsAt,
        endsAt: current.endsAt,
        isAllDay: current.isAllDay,
        isFree: current.isFree,
        isFeatured: false,
        priceText: current.priceText,
        ticketUrl: current.ticketUrl,
        sourceUrl: current.sourceUrl,
        imageUrl: current.imageUrl,
        address: current.address,
        lat: current.lat,
        lng: current.lng,
        sourceType: current.sourceType,
        extractionConfidence: current.extractionConfidence,
      },
    });

    for (const category of current.categories) {
      await this.prisma.eventCategory.create({
        data: {
          eventId: duplicated.id,
          categoryId: category.categoryId,
          source: category.source,
          confidence: category.confidence,
        },
      });
    }

    return duplicated;
  }

  async organizers() {
    const organizers = await this.prisma.organizer.findMany({
      include: { _count: { select: { users: true } } },
      orderBy: { createdAt: "desc" },
    });
    const unreadIds = organizers.filter((organizer) => !organizer.adminViewedAt && organizer._count.users > 0).map((organizer) => organizer.id);
    if (unreadIds.length) {
      await this.prisma.organizer.updateMany({ where: { id: { in: unreadIds } }, data: { adminViewedAt: new Date() } });
    }
    // hasUser is the real "claimed" signal — OrganizerStatus (VERIFIED/TRUSTED)
    // is an independent trust badge admins can set without the organizer
    // ever having actually registered.
    return organizers.map(({ _count, ...organizer }) => ({ ...organizer, hasUser: _count.users > 0 }));
  }

  async createOrganizer(dto: OrganizerAdminDto) {
    const slug = await uniqueSlug(dto.name, async (s) => !!(await this.prisma.organizer.findUnique({ where: { slug: s } })));
    return this.prisma.organizer.create({ data: { ...dto, slug, status: OrganizerStatus.UNCLAIMED, adminViewedAt: new Date() } });
  }

  updateOrganizer(id: number, dto: OrganizerAdminDto) {
    return this.prisma.organizer.update({ where: { id }, data: dto });
  }

  setOrganizerStatus(id: number, status: OrganizerStatus) {
    return this.prisma.organizer.update({ where: { id }, data: { status } });
  }

  async resetOrganizerPassword(organizerId: number, password: string) {
    const user = await this.prisma.user.findFirst({ where: { organizerId } });
    if (!user) throw new NotFoundException("Korisnik za ovog organizatora nije pronađen");
    const passwordHash = await bcrypt.hash(password, 10);
    await this.prisma.user.update({ where: { id: user.id }, data: { passwordHash } });
    return { ok: true };
  }

  async deleteOrganizer(id: number) {
    const count = await this.prisma.event.count({ where: { organizerId: id } });
    if (count > 0) throw new ConflictException(`Organizator ima ${count} događaja — nije moguće obrisati.`);
    // User.organizerId is ON DELETE SET NULL, not CASCADE — without this,
    // deleting the Organizer leaves the linked User's account behind
    // (orphaned, organizerId=null), permanently blocking that email from
    // registering again with "Email already registered".
    return this.prisma.$transaction([
      this.prisma.user.deleteMany({ where: { organizerId: id } }),
      this.prisma.organizer.delete({ where: { id } }),
    ]).then(([, organizer]) => organizer);
  }

  users() {
    return this.prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        organizerId: true,
        organizer: { select: { id: true, name: true, slug: true, status: true } },
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async deleteUser(id: number, currentUserId: number) {
    if (id === currentUserId) throw new BadRequestException("Ne možete obrisati vlastiti račun.");
    return this.prisma.user.delete({ where: { id } });
  }

  async deleteEvent(id: number) {
    const result = await this.prisma.$transaction(async (tx) => {
      await tx.eventSource.updateMany({ where: { eventId: id }, data: { eventId: null } });
      await tx.eventDuplicateCandidate.deleteMany({
        where: { OR: [{ eventAId: id }, { eventBId: id }] },
      });
      return tx.event.delete({ where: { id } });
    });
    void this.revalidate.revalidate("events");
    return result;
  }

  deleteEventSource(id: number) {
    return this.prisma.eventSource.delete({ where: { id } });
  }

  /** Paginated because the list only grows: every parsed URL, screenshot and
   *  monitored-source check adds a row, and the flat take: 200 it replaces
   *  both truncated silently and shipped 200 rows to the browser at once. */
  async eventSources(params?: { page?: string; pageSize?: string }) {
    const page = this.parsePositiveInt(params?.page, 1, 1, 10_000);
    const pageSize = this.parsePositiveInt(params?.pageSize, 25, 10, 100);
    const [items, total] = await this.prisma.$transaction([
      this.prisma.eventSource.findMany({
        include: { event: true, organizer: true },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.eventSource.count(),
    ]);
    return { items, total, page, pageSize, pageCount: Math.max(1, Math.ceil(total / pageSize)) };
  }

  async getSource(id: number) {
    const source = await this.prisma.eventSource.findUnique({ where: { id } });
    if (!source) return null;
    if (!source.adminViewedAt) {
      return this.prisma.eventSource.update({
        where: { id },
        data: { adminViewedAt: new Date() },
        include: { event: true, organizer: true },
      });
    }
    return this.prisma.eventSource.findUnique({ where: { id }, include: { event: true, organizer: true } });
  }

  updateEventSource(id: number, dto: UpdateEventSourceDto) {
    return this.prisma.eventSource.update({
      where: { id },
      data: { sourceUrl: dto.sourceUrl?.trim() || null },
    });
  }

  async createManualEmail(dto: ManualEmailDto) {
    const result = dto.useLlm
      ? await this.parser.parseBatchWithLlm({ rawText: dto.rawText, sourceUrl: dto.sourceUrl, screenshotBase64: dto.screenshotBase64, screenshotMediaType: dto.screenshotMediaType, contextHint: dto.contextHint })
      : await this.parser.parseBatch({ rawText: dto.rawText, sourceUrl: dto.sourceUrl });
    const { confidence, status } = this.sourceMetaFromResult(result);
    return this.prisma.eventSource.create({
      data: {
        type: EventSourceType.EMAIL,
        sourceUrl: dto.sourceUrl,
        rawText: dto.rawText,
        rawEmailSubject: dto.rawEmailSubject || dto.contextHint || undefined,
        adminViewedAt: new Date(),
        parsedJson: result as object,
        confidence,
        status,
      },
    });
  }

  async parseUrl(dto: ParseUrlDto) {
    let rawHtml = "";
    const fetchWarnings: string[] = [];

    // Facebook: skip fetch, LLM will return a helpful warning
    const skipFetch = dto.useLlm && this.isFacebookUrl(dto.sourceUrl);

    if (!skipFetch) {
      try {
        const response = await fetch(dto.sourceUrl, {
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

    // If listing page (many event sub-links, no dates), crawl sub-pages
    let subPageRawText: string | undefined;
    let subPageWarning: string | undefined;
    if (rawHtml && !skipFetch) {
      const crawl = await this.parser.crawlListingSubPages(rawHtml, dto.sourceUrl);
      if (crawl.subTexts.length > 0) {
        subPageRawText = crawl.subTexts.join("\n\n---\n\n");
        if (crawl.totalFound > crawl.fetched) {
          subPageWarning = `Stranica sadrži ${crawl.totalFound} događaja; obrađeno prvih ${crawl.fetched}.`;
        }
      }
    }

    const effectiveHtml = subPageRawText ? undefined : rawHtml || undefined;
    let result = (effectiveHtml && this.parser.extractJsonLdEvents(effectiveHtml, dto.sourceUrl))
      || (dto.useLlm
        ? await this.parser.parseBatchWithLlm({ rawText: subPageRawText, rawHtml: effectiveHtml, sourceUrl: dto.sourceUrl })
        : await this.parser.parseBatch({ rawText: subPageRawText, rawHtml: effectiveHtml, sourceUrl: dto.sourceUrl }));
    result = dropPastCandidates(result);
    result = await flagAlreadyImported(this.prisma, this.duplicates, result);

    if (fetchWarnings.length) {
      result.candidates.forEach((c) => c.warnings.push(...fetchWarnings));
    }
    if (subPageWarning) {
      result.candidates.forEach((c) => c.warnings.push(subPageWarning!));
    }

    const { confidence, status } = this.sourceMetaFromResult(result);

    return this.prisma.eventSource.create({
      data: {
        type: EventSourceType.URL,
        sourceUrl: dto.sourceUrl,
        rawHtml: rawHtml || undefined,
        adminViewedAt: new Date(),
        parsedJson: result as object,
        confidence,
        status,
      },
    });
  }

  async reparseSource(id: number) {
    const source = await this.prisma.eventSource.findUnique({ where: { id } });
    if (!source) throw new NotFoundException("Source not found");

    let rawText = source.rawText || undefined;
    let rawHtml = source.rawHtml || undefined;
    const sourceUrl = source.sourceUrl || undefined;

    // Re-fetch URL if we have one (stored rawHtml may be stale or listing-only)
    if (sourceUrl && !this.isFacebookUrl(sourceUrl)) {
      try {
        const res = await fetch(sourceUrl, {
          headers: { "User-Agent": "Manifestacije/1.0 event-ingestion-bot (+https://manifestacije.hr)" },
          signal: AbortSignal.timeout(12000),
        });
        if (res.ok) rawHtml = await res.text();
      } catch { /* use stored rawHtml */ }
    }

    // Sub-page crawl if listing
    if (rawHtml && sourceUrl) {
      const crawl = await this.parser.crawlListingSubPages(rawHtml, sourceUrl);
      if (crawl.subTexts.length > 0) {
        rawText = crawl.subTexts.join("\n\n---\n\n");
        rawHtml = undefined;
      }
    }

    let result = (rawHtml && this.parser.extractJsonLdEvents(rawHtml, sourceUrl ?? ""))
      || await this.parser.parseBatchWithLlm({ rawHtml, rawText, sourceUrl });
    result = dropPastCandidates(result);
    result = await flagAlreadyImported(this.prisma, this.duplicates, result);
    const { confidence, status } = this.sourceMetaFromResult(result);
    return this.prisma.eventSource.update({
      where: { id },
      data: { parsedJson: result as object, confidence, status },
    });
  }

  async createEventFromSource(id: number, candidateIndex = 0, candidateOverride?: CandidateOverrideDto, publish = false) {
    const source = await this.prisma.eventSource.findUnique({ where: { id } });
    if (!source?.parsedJson) throw new BadRequestException("Source has no parsed JSON");

    const parsedJson = source.parsedJson as Record<string, unknown>;
    let originalCandidate: ParsedEventCandidate;
    let candidate: ParsedEventCandidate;
    let isBatchFormat = false;

    if (Array.isArray((parsedJson as ParsedSourceResult).candidates)) {
      isBatchFormat = true;
      const result = parsedJson as ParsedSourceResult;
      const candidates = result.candidates as (ParsedEventCandidate & { _status?: string; _eventId?: number })[];
      if (candidateIndex < 0 || candidateIndex >= candidates.length) {
        throw new BadRequestException(`Invalid candidateIndex ${candidateIndex} (source has ${candidates.length} candidates)`);
      }
      const c = candidates[candidateIndex];
      if (c._status === "created") throw new BadRequestException("Candidate already has a created event");
      if (c._status === "ignored") throw new BadRequestException("Candidate is marked as ignored");
      originalCandidate = c;
    } else {
      // Legacy single-event format
      originalCandidate = parsedJson as unknown as ParsedEventCandidate;
    }

    candidate = { ...originalCandidate, ...this.cleanCandidateOverride(candidateOverride) };

    const city = candidate.city ? await this.findOrCreateCity(candidate.city, candidate.county, candidate.region) : null;
    const categoryIds = candidateOverride?.categoryIds?.length ? candidateOverride.categoryIds : undefined;
    const category = categoryIds?.[0]
      ? await this.prisma.category.findUnique({ where: { id: categoryIds[0] } })
      : await this.findOrCreateCategory(candidate.category);
    if (categoryIds?.[0] && !category) throw new BadRequestException(`Category '${categoryIds[0]}' not found in taxonomy`);

    const organizerId = source.organizerId ?? await this.findOrCreateOrganizerId(candidate.organizerName);
    const imageUrl = await this.rehostCandidateImage(candidate.imageUrl);

    const event = await this.events.createFromDto(
      {
        title: candidate.title,
        description: candidate.description || candidate.title,
        cityId: city?.id,
        cityName: candidate.city || undefined,
        countyName: candidate.countyName || candidate.county || undefined,
        regionSlug: candidate.regionSlug || undefined,
        categoryId: category?.id,
        categoryIds,
        startsAt: candidate.startsAt || undefined,
        endsAt: candidate.endsAt || undefined,
        isAllDay: candidate.isAllDay ?? undefined,
        isFree: candidate.isFree ?? undefined,
        priceText: candidate.priceText || undefined,
        ticketUrl: candidate.ticketUrl || undefined,
        // null means the admin explicitly cleared the source URL override —
        // must not fall back to the source's own URL in that case.
        sourceUrl: (candidate.sourceUrl as string | null | undefined) === null
          ? undefined
          : candidate.sourceUrl || source.sourceUrl || undefined,
        venueName: candidate.venueName || undefined,
        address: candidate.address || undefined,
        lat: candidate.lat ?? undefined,
        lng: candidate.lng ?? undefined,
        imageUrl: imageUrl || undefined,
      },
      { organizerId, status: publish ? EventStatus.PUBLISHED : EventStatus.PENDING_REVIEW, sourceType: "URL_SUBMISSION" }
    );

    if (isBatchFormat) {
      const result = parsedJson as ParsedSourceResult;
      const primaryCategory = categoryIds?.length ? category?.slug ?? candidate.category : candidate.category;
      const updatedCandidates = result.candidates.map((c, i) =>
        i === candidateIndex
          ? {
              ...c,
              ...this.cleanCandidateOverride(candidateOverride),
              category: primaryCategory,
              missingFields: c.missingFields,
              warnings: c.warnings,
              _status: "created" as const,
              _eventId: event.id,
            }
          : c
      );
      const allDone = updatedCandidates.every((c) => c._status === "created" || c._status === "ignored");
      await this.prisma.eventSource.update({
        where: { id },
        data: { parsedJson: { ...result, candidates: updatedCandidates } as object, status: allDone ? "LINKED" : "PARSED" },
      });
    } else {
      await this.prisma.eventSource.update({ where: { id }, data: { eventId: event.id, status: "LINKED" } });
    }

    if (publish) {
      void this.revalidate.revalidate("events");
      if (event.organizerId) await this.notifyOrganizerOfStatusChange(event.id, EventStatus.PUBLISHED);
    }
    return { event, candidateIndex };
  }

  async ignoreCandidate(id: number, candidateIndex: number) {
    const source = await this.prisma.eventSource.findUnique({ where: { id } });
    if (!source?.parsedJson) throw new BadRequestException("Source has no parsed JSON");

    const parsedJson = source.parsedJson as Record<string, unknown>;
    const result = parsedJson as ParsedSourceResult;
    if (!Array.isArray(result.candidates)) throw new BadRequestException("Source is not in batch format");

    if (candidateIndex < 0 || candidateIndex >= result.candidates.length) {
      throw new BadRequestException(`Invalid candidateIndex ${candidateIndex}`);
    }

    const updatedCandidates = result.candidates.map((c, i) =>
      i === candidateIndex ? { ...c, _status: "ignored" as const } : c
    );
    const allDone = updatedCandidates.every((c) => c._status === "created" || c._status === "ignored");

    return this.prisma.eventSource.update({
      where: { id },
      data: { parsedJson: { ...result, candidates: updatedCandidates } as object, status: allDone ? "LINKED" : "PARSED" },
    });
  }

  duplicatesList() {
    return this.duplicates.list();
  }

  mergeDuplicate(id: number) {
    return this.duplicates.merge(id);
  }

  dismissDuplicate(id: number) {
    return this.duplicates.dismiss(id);
  }

  regions() {
    return this.prisma.region.findMany({ include: { counties: { include: { cities: true } } }, orderBy: { sortOrder: "asc" } });
  }

  createRegion(dto: import("./admin.dto").RegionDto) {
    return this.prisma.region.create({ data: { name: dto.name, slug: dto.slug, sortOrder: dto.sortOrder ?? 0 } });
  }

  async deleteRegion(id: number) {
    const count = await this.prisma.county.count({ where: { regionId: id } });
    if (count > 0) throw new ConflictException(`Regija ima ${count} županija — prvo obrišite sadržaj.`);
    return this.prisma.region.delete({ where: { id } });
  }

  createCounty(dto: import("./admin.dto").CountyDto) {
    return this.prisma.county.create({ data: { name: dto.name, slug: dto.slug, regionId: dto.regionId } });
  }

  async deleteCounty(id: number) {
    const count = await this.prisma.city.count({ where: { countyId: id } });
    if (count > 0) throw new ConflictException(`Županija ima ${count} gradova — prvo obrišite gradove.`);
    return this.prisma.county.delete({ where: { id } });
  }

  async createCity(dto: import("./admin.dto").CityDto) {
    await this.assertNoDuplicateCity(dto);
    return this.prisma.city.create({ data: { name: dto.name, slug: dto.slug, countyId: dto.countyId, lat: dto.lat, lng: dto.lng } });
  }

  async updateCity(id: number, dto: import("./admin.dto").CityDto) {
    await this.assertNoDuplicateCity(dto, id);
    return this.prisma.city.update({ where: { id }, data: { name: dto.name, slug: dto.slug, lat: dto.lat, lng: dto.lng } });
  }

  private async assertNoDuplicateCity(dto: import("./admin.dto").CityDto, currentId?: number) {
    const canonicalSlug = slugify(dto.name);
    const duplicate = await this.prisma.city.findFirst({
      where: {
        OR: [
          { slug: dto.slug },
          ...(canonicalSlug ? [{ slug: canonicalSlug }] : []),
          { name: { equals: dto.name, mode: "insensitive" } },
        ],
        ...(currentId ? { NOT: { id: currentId } } : {}),
      },
    });
    if (duplicate) throw new ConflictException(`Grad već postoji: ${duplicate.name} (${duplicate.slug}).`);
  }

  async deleteCity(id: number) {
    const [eventCount, venueEventCount] = await Promise.all([
      this.prisma.event.count({ where: { cityId: id } }),
      this.prisma.event.count({ where: { venue: { cityId: id } } }),
    ]);
    if (eventCount > 0) throw new ConflictException(`Grad ima ${eventCount} događaja — nije moguće obrisati.`);
    if (venueEventCount > 0) throw new ConflictException(`Grad ima ${venueEventCount} događaja preko lokacija — nije moguće obrisati.`);
    return this.prisma.$transaction(async (tx) => {
      await tx.venue.deleteMany({ where: { cityId: id } });
      return tx.city.delete({ where: { id } });
    });
  }

  categories() {
    return this.prisma.category.findMany({ orderBy: { sortOrder: "asc" } });
  }

  createCategory(dto: import("./admin.dto").CategoryDto) {
    return this.prisma.category.create({ data: { name: dto.name, slug: dto.slug, sortOrder: dto.sortOrder ?? 0 } });
  }

  updateCategory(id: number, dto: import("./admin.dto").CategoryDto) {
    return this.prisma.category.update({ where: { id }, data: { name: dto.name, slug: dto.slug, sortOrder: dto.sortOrder } });
  }

  async deleteCategory(id: number) {
    const count = await this.prisma.eventCategory.count({ where: { categoryId: id } });
    if (count > 0) throw new ConflictException(`Kategorija se koristi na ${count} događaja — nije moguće obrisati.`);
    return this.prisma.category.delete({ where: { id } });
  }

  partners() {
    return this.prisma.partner.findMany({ orderBy: { sortOrder: "asc" } });
  }

  async createPartner(dto: import("./admin.dto").PartnerDto) {
    const p = await this.prisma.partner.create({
      data: { name: dto.name, logoUrl: dto.logoUrl, websiteUrl: dto.websiteUrl, sortOrder: dto.sortOrder ?? 0, isActive: dto.isActive ?? true },
    });
    void this.revalidate.revalidate("partners");
    return p;
  }

  async updatePartner(id: number, dto: import("./admin.dto").PartnerDto) {
    const p = await this.prisma.partner.update({
      where: { id },
      data: { name: dto.name, logoUrl: dto.logoUrl, websiteUrl: dto.websiteUrl, sortOrder: dto.sortOrder, isActive: dto.isActive },
    });
    void this.revalidate.revalidate("partners");
    return p;
  }

  async deletePartner(id: number) {
    await this.prisma.partner.delete({ where: { id } });
    void this.revalidate.revalidate("partners");
  }

  async searchVenues(q: string) {
    const venues = await this.prisma.venue.findMany({
      where: {
        OR: [
          { name: { contains: q } },
          { address: { contains: q } },
        ],
        lat: { not: null },
        lng: { not: null },
      },
      include: { city: true },
      take: 5,
      orderBy: { name: "asc" },
    });
    return venues.map((v) => ({
      label: [v.name, v.address, v.city.name].filter(Boolean).join(", "),
      lat: v.lat!,
      lng: v.lng!,
      cityName: v.city.name,
    }));
  }

  private sourceMetaFromResult(result: ParsedSourceResult): { confidence: number; status: "PARSED" | "NEEDS_REVIEW" } {
    const avgConfidence = result.candidates.length
      ? result.candidates.reduce((s, c) => s + c.confidence, 0) / result.candidates.length
      : 0;
    const needsReview = result.candidates.some((c) => c.missingFields.length > 0);
    return { confidence: avgConfidence, status: needsReview ? "NEEDS_REVIEW" : "PARSED" };
  }

  private eventInclude() {
    return { organizer: true, venue: true, city: true, county: true, region: true, category: true, categories: { include: { category: true } } } as const;
  }

  private async paginatedEvents(where: Prisma.EventWhereInput, params?: AdminEventListParams) {
    const page = this.parsePositiveInt(params?.page, 1, 1, 10_000);
    const pageSize = this.parsePositiveInt(params?.pageSize, 25, 10, 100);
    const [items, total] = await this.prisma.$transaction([
      this.prisma.event.findMany({
        where,
        include: this.eventInclude(),
        orderBy: this.eventOrderBy(params),
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.event.count({ where }),
    ]);
    return { items, total, page, pageSize, pageCount: Math.max(1, Math.ceil(total / pageSize)) };
  }

  private parsePositiveInt(value: string | undefined, fallback: number, min: number, max: number) {
    const parsed = Number(value);
    if (!Number.isInteger(parsed)) return fallback;
    return Math.max(min, Math.min(max, parsed));
  }

  private eventListWhere(params?: AdminEventListParams): Prisma.EventWhereInput {
    const where: Prisma.EventWhereInput = {};
    const and: Prisma.EventWhereInput[] = [];

    if (params?.status && Object.values(EventStatus).includes(params.status as EventStatus)) {
      where.status = params.status as EventStatus;
    }

    const organizerId = params?.organizerId ? Number(params.organizerId) : NaN;
    if (Number.isFinite(organizerId) && organizerId > 0) {
      where.organizerId = organizerId;
    }

    const search = params?.search?.trim();
    if (search) {
      and.push({
        OR: [
          { title: { contains: search, mode: "insensitive" } },
          { cityName: { contains: search, mode: "insensitive" } },
          { city: { name: { contains: search, mode: "insensitive" } } },
          { organizer: { name: { contains: search, mode: "insensitive" } } },
          { category: { name: { contains: search, mode: "insensitive" } } },
          { categories: { some: { category: { name: { contains: search, mode: "insensitive" } } } } },
        ],
      });
    }

    const startsAt = this.dateRangeWhere(params?.startsFrom, params?.startsTo);
    if (startsAt) where.startsAt = startsAt;

    const createdAt = this.dateRangeWhere(params?.createdFrom, params?.createdTo);
    if (createdAt) where.createdAt = createdAt;

    const fieldFilters = this.parseFieldFilters(params?.fieldFilters);
    for (const filter of fieldFilters) {
      const condition = this.eventFieldFilterWhere(filter);
      if (condition) and.push(condition);
    }

    if (and.length) where.AND = and;
    return where;
  }

  private parseFieldFilters(value: string | undefined): AdminEventFieldFilter[] {
    if (!value) return [];
    try {
      const parsed = JSON.parse(value) as unknown;
      if (!Array.isArray(parsed)) return [];
      return parsed
        .map((item) => item && typeof item === "object" ? item as Record<string, unknown> : null)
        .filter((item): item is Record<string, unknown> => Boolean(item))
        .map((item) => ({
          field: String(item.field ?? ""),
          op: typeof item.op === "string" ? item.op : undefined,
          value: typeof item.value === "string" ? item.value : undefined,
        }))
        .filter((item) => item.field);
    } catch {
      return [];
    }
  }

  private eventFieldFilterWhere(filter: AdminEventFieldFilter): Prisma.EventWhereInput | undefined {
    const field = filter.field;
    const op = filter.op ?? "contains";
    const rawValue = filter.value?.trim() ?? "";

    if (op === "empty" || op === "notEmpty") {
      return this.emptyFieldWhere(field, op === "notEmpty");
    }

    if (!rawValue) return undefined;

    const text = (path: keyof Prisma.EventWhereInput): Prisma.EventWhereInput => ({
      [path]: op === "equals"
        ? { equals: rawValue, mode: "insensitive" }
        : { contains: rawValue, mode: "insensitive" },
    } as Prisma.EventWhereInput);
    const nullableText = (path: keyof Prisma.EventWhereInput): Prisma.EventWhereInput => text(path);
    const relationText = (relation: "organizer" | "venue" | "city" | "county" | "region" | "category"): Prisma.EventWhereInput => ({
      [relation]: { name: op === "equals" ? { equals: rawValue, mode: "insensitive" } : { contains: rawValue, mode: "insensitive" } },
    } as Prisma.EventWhereInput);
    const date = (path: keyof Prisma.EventWhereInput): Prisma.EventWhereInput | undefined => {
      const parsed = this.parseAdminDate(rawValue, op === "lte" || op === "before" ? "end" : "start");
      if (!parsed) return undefined;
      if (op === "before" || op === "lte") return { [path]: { lte: parsed } } as Prisma.EventWhereInput;
      if (op === "after" || op === "gte") return { [path]: { gte: parsed } } as Prisma.EventWhereInput;
      return { [path]: this.dateRangeWhere(rawValue, rawValue) } as Prisma.EventWhereInput;
    };
    const number = (path: keyof Prisma.EventWhereInput): Prisma.EventWhereInput | undefined => {
      const parsed = Number(rawValue);
      if (!Number.isFinite(parsed)) return undefined;
      if (op === "gte") return { [path]: { gte: parsed } } as Prisma.EventWhereInput;
      if (op === "lte") return { [path]: { lte: parsed } } as Prisma.EventWhereInput;
      return { [path]: parsed } as Prisma.EventWhereInput;
    };
    const bool = (path: keyof Prisma.EventWhereInput): Prisma.EventWhereInput | undefined => {
      const normalized = rawValue.toLowerCase();
      const parsed = normalized === "true" || normalized === "1" || normalized === "da"
        ? true
        : normalized === "false" || normalized === "0" || normalized === "ne"
          ? false
          : undefined;
      return typeof parsed === "boolean" ? { [path]: parsed } as Prisma.EventWhereInput : undefined;
    };

    switch (field) {
      case "id": return number("id");
      case "title": return text("title");
      case "slug": return text("slug");
      case "description": return text("description");
      case "status": {
        const normalizedStatus = rawValue.toUpperCase();
        return Object.values(EventStatus).includes(normalizedStatus as EventStatus) ? { status: normalizedStatus as EventStatus } : undefined;
      }
      case "organizerId": return number("organizerId");
      case "organizer": return relationText("organizer");
      case "venueId": return number("venueId");
      case "venue": return relationText("venue");
      case "cityName": return nullableText("cityName");
      case "cityId": return number("cityId");
      case "city": return relationText("city");
      case "countyId": return number("countyId");
      case "county": return relationText("county");
      case "regionId": return number("regionId");
      case "region": return relationText("region");
      case "categoryId": return number("categoryId");
      case "category":
      case "categories": return {
        OR: [
          relationText("category"),
          { categories: { some: { category: { name: op === "equals" ? { equals: rawValue, mode: "insensitive" } : { contains: rawValue, mode: "insensitive" } } } } },
        ],
      };
      case "startsAt": return date("startsAt");
      case "endsAt": return date("endsAt");
      case "allDay":
      case "isAllDay": return bool("isAllDay");
      case "isFree": return bool("isFree");
      case "priceText": return nullableText("priceText");
      case "ticketUrl": return nullableText("ticketUrl");
      case "sourceUrl": return nullableText("sourceUrl");
      case "imageUrl": return nullableText("imageUrl");
      case "address": return nullableText("address");
      case "lat": return number("lat");
      case "lng": return number("lng");
      case "sourceType": return { sourceType: rawValue.toUpperCase() as Prisma.EnumEventSourceKindFilter["equals"] };
      case "confidence":
      case "extractionConfidence": return number("extractionConfidence");
      case "isFeatured": return bool("isFeatured");
      case "publishedAt": return date("publishedAt");
      case "createdAt": return date("createdAt");
      case "updatedAt": return date("updatedAt");
      default: return undefined;
    }
  }

  private emptyFieldWhere(field: string, notEmpty: boolean): Prisma.EventWhereInput | undefined {
    const isNull = notEmpty ? { not: null } : null;
    const nullableScalar = (path: keyof Prisma.EventWhereInput): Prisma.EventWhereInput => ({ [path]: isNull } as Prisma.EventWhereInput);
    const nullableText = (path: keyof Prisma.EventWhereInput): Prisma.EventWhereInput => notEmpty
      ? { [path]: { not: null } } as Prisma.EventWhereInput
      : { OR: [{ [path]: null } as Prisma.EventWhereInput, { [path]: "" } as Prisma.EventWhereInput] };
    switch (field) {
      case "organizerId": return nullableScalar("organizerId");
      case "organizer": return { organizerId: isNull };
      case "venueId": return nullableScalar("venueId");
      case "venue": return { venueId: isNull };
      case "cityName": return nullableText("cityName");
      case "cityId": return nullableScalar("cityId");
      case "city": return { cityId: isNull };
      case "countyId": return nullableScalar("countyId");
      case "county": return { countyId: isNull };
      case "regionId": return nullableScalar("regionId");
      case "region": return { regionId: isNull };
      case "endsAt": return nullableScalar("endsAt");
      case "priceText": return nullableText("priceText");
      case "ticketUrl": return nullableText("ticketUrl");
      case "sourceUrl": return nullableText("sourceUrl");
      case "imageUrl": return nullableText("imageUrl");
      case "address": return nullableText("address");
      case "lat": return nullableScalar("lat");
      case "lng": return nullableScalar("lng");
      case "extractionConfidence": return nullableScalar("extractionConfidence");
      case "publishedAt": return nullableScalar("publishedAt");
      default: return undefined;
    }
  }

  private dateRangeWhere(from?: string, to?: string): Prisma.DateTimeFilter | undefined {
    const gte = this.parseAdminDate(from, "start");
    const lte = this.parseAdminDate(to, "end");
    if (!gte && !lte) return undefined;
    return { ...(gte ? { gte } : {}), ...(lte ? { lte } : {}) };
  }

  private parseAdminDate(value: string | undefined, edge: "start" | "end"): Date | undefined {
    if (!value) return undefined;
    const dateOnly = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    const date = dateOnly
      ? new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]), edge === "start" ? 0 : 23, edge === "start" ? 0 : 59, edge === "start" ? 0 : 59, edge === "start" ? 0 : 999)
      : new Date(value);
    return Number.isNaN(date.getTime()) ? undefined : date;
  }

  private eventOrderBy(params?: AdminEventListParams): Prisma.EventOrderByWithRelationInput[] {
    if (!params?.sortBy) {
      return [{ createdAt: "desc" }, { id: "desc" }];
    }
    const direction = params.sortDir === "desc" ? "desc" : "asc";
    if (params.sortBy === "createdAt") {
      return [{ createdAt: direction }, { id: direction }];
    }
    if (params.sortBy === "startsAt") {
      return [{ startsAt: direction }, { id: "asc" }];
    }
    return [{ createdAt: "desc" }, { id: "desc" }];
  }

  private isFacebookUrl(url: string): boolean {
    try {
      const hostname = new URL(url).hostname.toLowerCase().replace(/^www\./, "");
      return hostname === "fb.me" || hostname === "facebook.com" || hostname.endsWith(".facebook.com");
    }
    catch { return false; }
  }

  private cleanCandidateOverride(candidate?: CandidateOverrideDto): Partial<ParsedEventCandidate> {
    if (!candidate) return {};
    return Object.fromEntries(
      Object.entries(candidate).map(([key, value]) => [
        key,
        typeof value === "string" ? value.trim() : value,
      ]).filter(([key, value]) => key !== "categoryIds" && value !== undefined)
    ) as Partial<ParsedEventCandidate>;
  }

  /** Copies a scraped image onto our own CDN at approval time, so the event
   *  keeps its poster even after the source rotates or deletes the file.
   *  Anything already hosted by us is left alone, and a failed copy silently
   *  keeps the original URL rather than losing the image entirely. */
  private async rehostCandidateImage(imageUrl?: string): Promise<string | undefined> {
    const url = imageUrl?.trim();
    if (!url || url.includes("res.cloudinary.com")) return url || undefined;
    const uploaded = await this.uploads.uploadEventImageFromUrl(url);
    return uploaded?.imageUrl ?? url;
  }

  private async findOrCreateOrganizerId(name?: string): Promise<number | undefined> {
    const cleaned = name?.trim();
    if (!cleaned) return undefined;

    const names = this.splitOrganizerNames(cleaned);
    const isCreditLine = names.length > 1;
    const primary = names[0];

    const existing = await this.findOrganizerByName(primary);
    if (existing) return existing;

    // A credit line ("A, B & C") names several parties, not one organiser.
    // Minting a row from the whole string is how entries like "Incognito
    // Agency, Entrio i Centar za kulturu Đakovo" ended up in the table
    // alongside a separate "Incognito Agency". If the lead name isn't
    // already known, leave it empty for the admin to resolve.
    if (isCreditLine) return undefined;

    const slug = await uniqueSlug(primary, async (s) => !!(await this.prisma.organizer.findUnique({ where: { slug: s } })));
    const organizer = await this.prisma.organizer.create({ data: { name: primary, slug, status: OrganizerStatus.UNCLAIMED } });
    return organizer.id;
  }

  /** Matches on a normalised form so casing, diacritics, punctuation and a
   *  trailing legal suffix don't fork one organiser into several rows
   *  ("Centar za kulturu Đakovo" vs "Centar za kulturu Dakovo"). The table is
   *  small enough to compare in memory, and Postgres can't apply this
   *  normalisation in a query without an expression index. */
  private async findOrganizerByName(name: string): Promise<number | undefined> {
    const target = this.normalizeOrganizerName(name);
    if (!target) return undefined;
    const all = await this.prisma.organizer.findMany({ select: { id: true, name: true } });
    return all.find((o) => this.normalizeOrganizerName(o.name) === target)?.id;
  }

  private normalizeOrganizerName(value: string): string {
    return value
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/đ/g, "d")
      .replace(/\s*\b(j\.?\s*d\.?\s*o\.?\s*o\.?|d\.?\s*o\.?\s*o\.?|d\.?\s*d\.?)\s*$/, "")
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  }

  /** Splits a credit line into the parties it names. Only strong separators
   *  count: Croatian organiser names routinely contain " i " ("Sport i
   *  rekreacija Slavonija"), so splitting on it would break real names.
   *  Parenthesised asides are dropped first — they list people, not
   *  co-organisers ("Kazalište Grupa (Žijah Sokolović, Dražen Šivak)"). */
  private splitOrganizerNames(value: string): string[] {
    const withoutAsides = value.replace(/\([^)]*\)/g, " ").trim();
    const parts = withoutAsides
      .split(/\s*[,&/+]\s*/)
      .map((part) => part.trim())
      .filter((part) => part.length > 1);
    return parts.length > 1 ? parts : [withoutAsides || value.trim()];
  }

  private findOrCreateCity(name: string, countyName?: string, regionName?: string) {
    return findOrCreateCity(this.prisma, name, countyName, regionName);
  }

  private async findOrCreateCategory(category?: string | null) {
    const cleaned = category?.trim();
    if (cleaned) {
      const existing = await this.prisma.category.findFirst({
        where: {
          OR: [
            { slug: { equals: cleaned, mode: "insensitive" } },
            { name: { equals: cleaned, mode: "insensitive" } },
          ],
        },
      });
      if (existing) return existing;
    }
    return this.prisma.category.upsert({
      where: { slug: "ostalo" },
      update: {},
      create: { name: "Ostalo", slug: "ostalo", sortOrder: 999 },
    });
  }
}
