import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { EventStatus, EventSourceKind, OrganizerStatus, Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { slugify, uniqueSlug } from "../common/slug";
import { findOrCreateCity } from "../common/city-resolver";
import { lookupVenueGeo } from "../common/croatia-geo";
import { zagrebLocalToUtc } from "../common/weekend";
import { requireSafeHttpUrl } from "../common/safe-url";
import { EventOccurrenceDto, EventUpsertDto } from "./event.dto";
import { DuplicatesService } from "../duplicates/duplicates.service";
import { hasPublicEventOutput, RevalidateService } from "../admin/revalidate.service";

type NormalizedOccurrence = {
  id?: number;
  startsAt: Date;
  endsAt: Date | null;
  isAllDay: boolean;
};

@Injectable()
export class EventsService {
  constructor(private readonly prisma: PrismaService, private readonly duplicates: DuplicatesService, private readonly revalidate: RevalidateService) {}

  async createFromDto(dto: EventUpsertDto, opts: { organizerId?: number | null; status?: EventStatus; sourceType?: EventSourceKind; createdByUserId?: number }, transaction?: Prisma.TransactionClient) {
    const db = transaction ?? this.prisma;
    const urls = this.safeUrlFields(dto);
    const title = dto.title?.trim() || "Novi događaj";
    const description = dto.description?.trim() || title;
    const city = await this.resolveCityForWrite(dto, undefined, db, Boolean(transaction));
    this.assertPublishableLocation(opts.status || EventStatus.PENDING_REVIEW, city);
    const category = await this.resolveCategory(dto.categoryId ?? undefined, db);
    let venueId: number | undefined;
    let point: { lat?: number; lng?: number; address?: string } = { lat: dto.lat, lng: dto.lng, address: dto.address };
    if (dto.venueName && city) {
      const venueSlug = slugify(dto.venueName);
      const existing = await db.venue.findUnique({ where: { slug_cityId: { slug: venueSlug, cityId: city.id } } });
      point = await this.resolvePoint(dto, city, existing);
      const venue = await db.venue.upsert({
        where: { slug_cityId: { slug: venueSlug, cityId: city.id } },
        update: { address: point.address, lat: point.lat, lng: point.lng },
        create: { name: dto.venueName, slug: venueSlug, cityId: city.id, address: point.address, lat: point.lat, lng: point.lng }
      });
      venueId = venue.id;
    }
    const slug = await uniqueSlug(title, async (s) => !!(await db.event.findUnique({ where: { slug: s } })));
    const occurrences = dto.occurrences ? this.normalizeOccurrences(dto.occurrences) : undefined;
    const schedule = occurrences ? this.summarizeOccurrences(occurrences) : null;
    const event = await db.event.create({
      data: {
        title,
        slug,
        description,
        status: opts.status || EventStatus.PENDING_REVIEW,
        organizerId: opts.organizerId || undefined,
        createdByUserId: opts.createdByUserId,
        venueId,
        cityName: city?.name ?? dto.cityName,
        cityId: city?.id,
        countyId: city?.countyId,
        regionId: city?.county.regionId,
        categoryId: category.id,
        startsAt: schedule?.startsAt ?? (dto.startsAt ? new Date(dto.startsAt) : new Date()),
        endsAt: schedule?.endsAt ?? (dto.endsAt ? new Date(dto.endsAt) : undefined),
        isAllDay: schedule?.isAllDay ?? dto.isAllDay ?? false,
        isFree: dto.isFree,
        isFeatured: dto.isFeatured ?? false,
        priceText: dto.priceText,
        ...urls,
        address: point.address,
        lat: point.lat,
        lng: point.lng,
        sourceType: opts.sourceType || EventSourceKind.MANUAL,
        publishedAt: opts.status === EventStatus.PUBLISHED ? new Date() : undefined,
        occurrences: occurrences ? {
          create: occurrences.map(({ startsAt, endsAt, isAllDay }) => ({ startsAt, endsAt, isAllDay })),
        } : undefined,
      },
      include: { occurrences: { orderBy: [{ startsAt: "asc" }, { id: "asc" }] } },
    });

    // Build EventCategory rows: primary from categoryId, extras from categoryIds
    const allCategoryIds = dto.categoryIds?.length
      ? dto.categoryIds
      : [category.id];
    for (const [idx, catId] of allCategoryIds.entries()) {
      await db.eventCategory.upsert({
        where: { eventId_categoryId: { eventId: event.id, categoryId: catId } },
        update: {},
        create: { eventId: event.id, categoryId: catId, source: "MANUAL" },
      });
    }

    if (transaction) return event;
    if (hasPublicEventOutput(event) || (venueId && await this.hasPublicVenueEvents(venueId))) await this.revalidate.revalidate("events");
    try { await this.duplicates.detectForEvent(event.id); } catch { /* advisory; creation already succeeded */ }
    return event;
  }

  async updateEvent(id: number, dto: Partial<EventUpsertDto> & { status?: EventStatus }, transaction?: Prisma.TransactionClient) {
    const db = transaction ?? this.prisma;
    const current = await db.event.findUnique({ where: { id }, include: { occurrences: true } });
    if (!current) throw new NotFoundException("Event not found");
    const urls = this.safeUrlFields(dto, current);
    const hasScheduleInput = "startsAt" in dto || "endsAt" in dto || "isAllDay" in dto;
    const currentOccurrences = current.occurrences ?? [];
    if (currentOccurrences.length > 0 && dto.occurrences === undefined && hasScheduleInput) {
      throw new BadRequestException("Događaj koristi raspored termina; pošaljite occurrences za promjenu rasporeda.");
    }
    const occurrences = dto.occurrences ? this.normalizeOccurrences(dto.occurrences) : undefined;
    if (occurrences) this.assertOccurrenceOwnership(currentOccurrences.map((item) => item.id), occurrences);
    const schedule = occurrences ? this.summarizeOccurrences(occurrences) : null;
    const city = await this.resolveCityForWrite(dto, current, db, Boolean(transaction));
    this.assertPublishableLocation(dto.status, city, current);

    let slug: string | undefined;
    if (dto.slug !== undefined) {
      const normalized = slugify(dto.slug);
      if (!normalized) throw new BadRequestException("Slug ne može biti prazan.");
      if (normalized !== current.slug) {
        const taken = await db.event.findUnique({ where: { slug: normalized } });
        if (taken && taken.id !== id) throw new BadRequestException("Taj slug je već zauzet.");
        slug = normalized;
      }
    }

    const data: Record<string, unknown> = {
      title: dto.title,
      slug,
      description: dto.description,
      categoryId: dto.categoryId,
      startsAt: schedule?.startsAt ?? (dto.startsAt ? new Date(dto.startsAt) : undefined),
      endsAt: schedule ? schedule.endsAt : dto.endsAt !== undefined ? (dto.endsAt ? new Date(dto.endsAt) : null) : undefined,
      isAllDay: schedule?.isAllDay ?? dto.isAllDay,
      isFree: dto.isFree,
      isFeatured: dto.isFeatured,
      priceText: dto.priceText,
      ...urls,
      address: dto.address,
      lat: dto.lat,
      lng: dto.lng,
      status: dto.status,
      publishedAt: dto.status === EventStatus.PUBLISHED ? new Date() : undefined,
    };
    if ("organizerId" in dto) {
      if (dto.organizerId === null) {
        data.organizerId = null;
      } else if (dto.organizerId !== undefined) {
        const organizer = await db.organizer.findUnique({ where: { id: dto.organizerId } });
        if (!organizer) throw new BadRequestException("Unknown organizerId");
        data.organizerId = organizer.id;
      }
    }
    if (city) {
      data.cityName = city.name;
      data.cityId = city.id;
      data.countyId = city.countyId;
      data.regionId = city.county.regionId;
    } else if ("cityName" in dto && dto.cityName) {
      data.cityName = dto.cityName;
    }
    if ("venueName" in dto) {
      if (dto.venueName) {
        const effectiveCityId = city?.id ?? current.cityId;
        const venueCity = city ?? (effectiveCityId ? await db.city.findUnique({ where: { id: effectiveCityId } }) : null);
        if (venueCity) {
          const venueSlug = slugify(dto.venueName);
          const venue = await db.venue.upsert({
            where: { slug_cityId: { slug: venueSlug, cityId: venueCity.id } },
            update: { address: dto.address, lat: dto.lat, lng: dto.lng },
            create: { name: dto.venueName, slug: venueSlug, cityId: venueCity.id, address: dto.address, lat: dto.lat, lng: dto.lng },
          });
          data.venueId = venue.id;
        }
      } else {
        data.venueId = null;
      }
    }
    Object.keys(data).forEach((key) => data[key] === undefined && delete data[key]);
    let event;
    if (occurrences) {
      const writeSchedule = async (tx: Prisma.TransactionClient) => {
        const retainedIds = occurrences.flatMap((item) => item.id ? [item.id] : []);
        await tx.eventOccurrence.deleteMany({
          where: { eventId: id, ...(retainedIds.length ? { id: { notIn: retainedIds } } : {}) },
        });
        for (const occurrence of occurrences) {
          const occurrenceData = {
            startsAt: occurrence.startsAt,
            endsAt: occurrence.endsAt,
            isAllDay: occurrence.isAllDay,
          };
          if (occurrence.id) {
            await tx.eventOccurrence.update({ where: { id: occurrence.id }, data: occurrenceData });
          } else {
            await tx.eventOccurrence.create({ data: { eventId: id, ...occurrenceData } });
          }
        }
        return tx.event.update({
          where: { id },
          data,
          include: { occurrences: { orderBy: [{ startsAt: "asc" }, { id: "asc" }] } },
        });
      };
      event = transaction ? await writeSchedule(transaction) : await this.prisma.$transaction(writeSchedule);
    } else {
      event = await db.event.update({ where: { id }, data });
    }

    // If categoryIds supplied, replace EventCategory rows
    if (dto.categoryIds?.length) {
      await db.eventCategory.deleteMany({ where: { eventId: id } });
      for (const [idx, catId] of dto.categoryIds.entries()) {
        await db.eventCategory.upsert({
          where: { eventId_categoryId: { eventId: id, categoryId: catId } },
          update: {},
          create: { eventId: id, categoryId: catId, source: "MANUAL" },
        });
      }
    }

    // The caller owns transaction commit and post-commit side effects.
    if (transaction) return event;

    const changed = Object.keys(data).length > 0 || Boolean(dto.categoryIds?.length) || Boolean(occurrences);
    if ((changed && (hasPublicEventOutput(current) || hasPublicEventOutput(event))) ||
        (typeof data.venueId === "number" && await this.hasPublicVenueEvents(data.venueId))) {
      await this.revalidate.revalidate("events");
    }
    await this.duplicates.detectForEvent(id);
    return event;
  }

  private async hasPublicVenueEvents(venueId: number): Promise<boolean> {
    return (await this.prisma.event.count({ where: { venueId, OR: [
      { status: EventStatus.PUBLISHED },
      { status: EventStatus.ARCHIVED, publishedAt: { not: null } },
    ] } })) > 0;
  }

  /** Used only after a caller-owned transaction has committed. */
  async afterTransactionalUpdate(id: number, checkSharedVenue = false) {
    if (checkSharedVenue) {
      const event = await this.prisma.event.findUnique({ where: { id }, select: { venueId: true } });
      if (event?.venueId && await this.hasPublicVenueEvents(event.venueId)) await this.revalidate.revalidate("events");
    }
    // Duplicate detection is advisory and must not turn a committed revision
    // into a failed request (or trigger an organizer retry of the decision).
    await this.duplicates.detectForEvent(id).catch(() => undefined);
  }

  /** Pure validation/normalization for a proposal. No event, venue, taxonomy,
   * duplicate or cache writes are permitted before review. */
  normalizeRevisionContent(dto: EventUpsertDto, current: {
    ticketUrl: string | null; sourceUrl: string | null; imageUrl: string | null;
    occurrences: { id: number }[];
  }): EventUpsertDto {
    const normalized = { ...dto };
    const urls = this.safeUrlFields(dto, current);
    for (const field of ["ticketUrl", "sourceUrl", "imageUrl"] as const) {
      if (urls[field] !== undefined) normalized[field] = urls[field];
    }
    if (!dto.title?.trim() || !dto.description?.trim()) throw new BadRequestException("Naziv i opis su obavezni.");
    if (typeof dto.isAllDay !== "boolean" || (dto.isFree !== null && typeof dto.isFree !== "boolean")) {
      throw new BadRequestException("Neispravni podaci o događaju.");
    }
    if (dto.occurrences?.length) {
      const rows = this.normalizeOccurrences(dto.occurrences);
      this.assertOccurrenceOwnership(current.occurrences.map(row => row.id), rows);
      const summary = this.summarizeOccurrences(rows);
      normalized.occurrences = rows.map(row => ({ ...row, startsAt: row.startsAt.toISOString(), endsAt: row.endsAt?.toISOString() ?? null }));
      normalized.startsAt = summary.startsAt.toISOString();
      normalized.endsAt = summary.endsAt?.toISOString() ?? null;
      normalized.isAllDay = summary.isAllDay;
    } else {
      const [row] = this.normalizeOccurrences([{ startsAt: dto.startsAt || "", endsAt: dto.endsAt, isAllDay: dto.isAllDay }]);
      normalized.startsAt = row.startsAt.toISOString();
      normalized.endsAt = row.endsAt?.toISOString() ?? null;
    }
    return normalized;
  }

  /** Read-only location preview, using the same address precedence as writes.
   * Unknown city names stay proposals; taxonomy is created only on approval. */
  async previewRevisionLocation(dto: EventUpsertDto, original: EventUpsertDto, db: Prisma.TransactionClient) {
    const addressCity = dto.address && dto.address !== original.address ? await this.findKnownCityInText(dto.address, db) : null;
    const nameChanged = dto.cityName !== original.cityName;
    const city = addressCity ?? (nameChanged && dto.cityName?.trim()
      ? await db.city.findFirst({ where: { OR: [{ name: { equals: dto.cityName.trim(), mode: "insensitive" } }, { slug: slugify(dto.cityName) }] } })
      : null);
    if (city) { dto.cityId = city.id; dto.cityName = city.name; }
  }

  private normalizeOccurrences(input: EventOccurrenceDto[]): NormalizedOccurrence[] {
    if (input.length === 0) throw new BadRequestException("Raspored mora sadržavati barem jedan termin.");
    return input
      .map((item) => {
        const rawStart = new Date(item.startsAt);
        const rawEnd = item.endsAt ? new Date(item.endsAt) : null;
        if (Number.isNaN(rawStart.getTime()) || (rawEnd && Number.isNaN(rawEnd.getTime()))) {
          throw new BadRequestException("Neispravan datum termina.");
        }
        if (item.isAllDay) {
          const start = this.zagrebDayBoundary(rawStart, "start");
          const end = this.zagrebDayBoundary(rawEnd ?? rawStart, "end");
          if (end < start) throw new BadRequestException("Završetak termina mora biti nakon početka.");
          return { id: item.id, startsAt: start, endsAt: end, isAllDay: true };
        }
        if (rawEnd && rawEnd <= rawStart) {
          throw new BadRequestException("Vrijeme završetka mora biti nakon početka.");
        }
        return { id: item.id, startsAt: rawStart, endsAt: rawEnd, isAllDay: false };
      })
      .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime() || (a.id ?? Number.MAX_SAFE_INTEGER) - (b.id ?? Number.MAX_SAFE_INTEGER));
  }

  private summarizeOccurrences(occurrences: NormalizedOccurrence[]) {
    const startsAt = occurrences[0].startsAt;
    const endpoint = occurrences.reduce((latest, item) => {
      const candidate = item.endsAt ?? item.startsAt;
      return candidate > latest ? candidate : latest;
    }, occurrences[0].endsAt ?? occurrences[0].startsAt);
    return {
      startsAt,
      endsAt: occurrences.length === 1 && occurrences[0].endsAt === null ? null : endpoint,
      isAllDay: occurrences.every((item) => item.isAllDay),
    };
  }

  private assertOccurrenceOwnership(existingIds: number[], occurrences: NormalizedOccurrence[]) {
    const existing = new Set(existingIds);
    const supplied = occurrences.flatMap((item) => item.id ? [item.id] : []);
    if (new Set(supplied).size !== supplied.length || supplied.some((id) => !existing.has(id))) {
      throw new BadRequestException("Termin ne pripada ovom događaju.");
    }
  }

  private zagrebDayBoundary(date: Date, boundary: "start" | "end") {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/Zagreb",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(date);
    const value = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? 0);
    return zagrebLocalToUtc(
      value("year"),
      value("month"),
      value("day"),
      boundary === "start" ? 0 : 23,
      boundary === "start" ? 0 : 59,
      boundary === "start" ? 0 : 59,
      boundary === "start" ? 0 : 999,
    );
  }

  /**
   * Fills in a precise point for events that arrive with a street address but
   * no coordinates — parsed candidates never carry any, so without this they
   * all land on the city centre.
   *
   * Explicit coordinates always win: if a human picked a spot in the location
   * autocomplete, that is the answer. Otherwise the venue is the cache — once
   * "Grejp, Osijek" has been resolved, every later event there reuses it and
   * costs no lookup, which is what keeps this within Nominatim's 1 req/s.
   */
  private async resolvePoint(
    dto: Pick<EventUpsertDto, "lat" | "lng" | "address" | "venueName">,
    city: { name: string; lat: number | null; lng: number | null },
    existingVenue?: { lat: number | null; lng: number | null; address?: string | null } | null,
  ): Promise<{ lat?: number; lng?: number; address?: string }> {
    if (dto.lat != null && dto.lng != null) return { lat: dto.lat, lng: dto.lng, address: dto.address };
    if (existingVenue?.lat != null && existingVenue.lng != null) {
      return { lat: existingVenue.lat, lng: existingVenue.lng, address: dto.address || existingVenue.address || undefined };
    }
    if (!dto.address && !dto.venueName) return { lat: dto.lat, lng: dto.lng, address: dto.address };

    const centre = city.lat != null && city.lng != null ? { lat: city.lat, lng: city.lng } : null;
    // Geocoding is an optional improvement, never a reason to fail a save.
    const found = await lookupVenueGeo(
      { address: dto.address, venueName: dto.venueName, cityName: city.name },
      centre,
    ).catch(() => null);

    if (!found) return { lat: dto.lat, lng: dto.lng, address: dto.address };
    // A venue given only by name still deserves a street address — the
    // geocoder had to resolve one to place the pin, so keep it rather than
    // leaving the admin to look it up by hand.
    return { lat: found.lat, lng: found.lng, address: dto.address || found.formattedAddress };
  }

  /** Every event write funnels through here, so URL safety holds even for
   *  callers that bypass the DTO pipe. Blank/null values keep their "clear
   *  this field" meaning. On update, a value identical to the stored one is
   *  left untouched: legacy rows that predate validation (e.g. ticketUrl
   *  "racesmanager") must not block saving unrelated changes. Such values are
   *  never rendered as links (the web sanitizes on output). */
  private safeUrlFields(
    dto: Partial<EventUpsertDto>,
    current?: { ticketUrl: string | null; sourceUrl: string | null; imageUrl: string | null },
  ) {
    const unchanged = (field: "ticketUrl" | "sourceUrl" | "imageUrl") => {
      const value = dto[field];
      const stored = current?.[field];
      return current !== undefined && (value === stored || (typeof value === "string" && typeof stored === "string" && value.trim() === stored.trim()));
    };
    return {
      ticketUrl: unchanged("ticketUrl") ? undefined : requireSafeHttpUrl(dto.ticketUrl, "Poveznica za ulaznice", { allowContactLinks: true }),
      sourceUrl: unchanged("sourceUrl") ? undefined : requireSafeHttpUrl(dto.sourceUrl, "Poveznica na događaj"),
      imageUrl: unchanged("imageUrl") ? undefined : requireSafeHttpUrl(dto.imageUrl, "Slika"),
    };
  }

  private async resolveCityForWrite(
    dto: Partial<EventUpsertDto>,
    current?: { cityId?: number | null; cityName?: string | null; regionId?: number | null; status?: EventStatus },
    db: Prisma.TransactionClient = this.prisma,
    transactional = false,
  ) {
    const hasPreciseLocationChange = "address" in dto || "lat" in dto || "lng" in dto || Boolean(dto.countyName || dto.regionSlug);
    const addressCity = dto.address && hasPreciseLocationChange
      ? await this.findKnownCityInText(dto.address, db)
      : null;
    const explicitCityName = dto.cityName?.trim();
    const preferCityName = Boolean(addressCity || explicitCityName);

    if (!preferCityName && dto.cityId) {
      return this.resolveCity({ cityId: dto.cityId }, db, transactional);
    }

    const cityName = addressCity?.name ?? explicitCityName ?? (
      !current?.cityId && dto.venueName ? current?.cityName ?? undefined : undefined
    );

    if (cityName) {
      return this.resolveCity({
        cityName,
        countyName: dto.countyName,
        regionSlug: dto.regionSlug,
      }, db, transactional);
    }

    if (!hasPreciseLocationChange && current?.cityId) {
      return null;
    }

    return null;
  }

  private async resolveCity(dto: Pick<EventUpsertDto, "cityId" | "cityName" | "countyName" | "regionSlug">, db: Prisma.TransactionClient = this.prisma, transactional = false) {
    if (dto.cityId) {
      const city = await db.city.findUnique({ where: { id: dto.cityId }, include: { county: true } });
      if (!city) throw new BadRequestException("Unknown cityId");
      return city;
    }
    const name = dto.cityName?.trim() || "Nepoznato";
    return findOrCreateCity(db, name, dto.countyName, dto.regionSlug, transactional ? undefined : async () => {
      await this.revalidate.revalidate("events");
      await this.revalidate.revalidate("taxonomy");
    });
  }

  private async resolveCategory(categoryId?: number, db: Prisma.TransactionClient = this.prisma) {
    if (categoryId) {
      const category = await db.category.findUnique({ where: { id: categoryId } });
      if (!category) throw new BadRequestException("Unknown categoryId");
      return category;
    }
    return db.category.upsert({
      where: { slug: "ostalo" },
      update: {},
      create: { name: "Ostalo", slug: "ostalo", sortOrder: 999 },
    });
  }

  private async findKnownCityInText(value: string, db: Prisma.TransactionClient = this.prisma) {
    const text = this.normalizeKey(value);
    if (!text) return null;
    const cities = await db.city.findMany({ include: { county: true } });
    return cities
      .sort((a, b) => b.name.length - a.name.length)
      .find((city) => text.split(",").map((part) => part.trim()).includes(this.normalizeKey(city.name)) || text.includes(` ${this.normalizeKey(city.name)}`) || text.endsWith(this.normalizeKey(city.name)))
      ?? null;
  }

  private normalizeKey(value: string) {
    return value
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/đ/g, "d")
      .replace(/\s+/g, " ");
  }

  private assertPublishableLocation(
    nextStatus?: EventStatus,
    city?: { id: number; county?: { regionId?: number | null } } | null,
    current?: { cityId?: number | null; regionId?: number | null; status?: EventStatus },
  ) {
    const willBePublished = nextStatus === EventStatus.PUBLISHED || (!nextStatus && current?.status === EventStatus.PUBLISHED);
    if (!willBePublished) return;
    if (!city && current?.cityId && current.regionId) return;
    if (!city?.county?.regionId) throw new BadRequestException("Lokacija nije mapirana na grad/regiju.");
  }
}
