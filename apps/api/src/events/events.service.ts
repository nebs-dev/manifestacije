import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { EventStatus, EventSourceKind, OrganizerStatus } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { slugify, uniqueSlug } from "../common/slug";
import { EventUpsertDto } from "./event.dto";
import { DuplicatesService } from "../duplicates/duplicates.service";

@Injectable()
export class EventsService {
  constructor(private readonly prisma: PrismaService, private readonly duplicates: DuplicatesService) {}

  async createFromDto(dto: EventUpsertDto, opts: { organizerId?: number | null; status?: EventStatus; sourceType?: EventSourceKind }) {
    const title = dto.title?.trim() || "Novi događaj";
    const description = dto.description?.trim() || title;
    const city = (dto.cityId || dto.cityName) ? await this.resolveCity(dto) : null;
    const category = await this.resolveCategory(dto.categoryId ?? undefined);
    let venueId: number | undefined;
    if (dto.venueName && city) {
      const venueSlug = slugify(dto.venueName);
      const venue = await this.prisma.venue.upsert({
        where: { slug_cityId: { slug: venueSlug, cityId: city.id } },
        update: { address: dto.address, lat: dto.lat, lng: dto.lng },
        create: { name: dto.venueName, slug: venueSlug, cityId: city.id, address: dto.address, lat: dto.lat, lng: dto.lng }
      });
      venueId = venue.id;
    }
    const slug = await uniqueSlug(title, async (s) => !!(await this.prisma.event.findUnique({ where: { slug: s } })));
    const event = await this.prisma.event.create({
      data: {
        title,
        slug,
        description,
        status: opts.status || EventStatus.PENDING_REVIEW,
        organizerId: opts.organizerId || undefined,
        venueId,
        cityName: dto.cityName || city?.name,
        cityId: city?.id,
        countyId: city?.countyId,
        regionId: city?.county.regionId,
        categoryId: category.id,
        startsAt: dto.startsAt ? new Date(dto.startsAt) : new Date(),
        endsAt: dto.endsAt ? new Date(dto.endsAt) : undefined,
        isAllDay: dto.isAllDay || false,
        isFree: dto.isFree,
        priceText: dto.priceText,
        ticketUrl: dto.ticketUrl,
        sourceUrl: dto.sourceUrl,
        imageUrl: dto.imageUrl,
        address: dto.address,
        lat: dto.lat,
        lng: dto.lng,
        sourceType: opts.sourceType || EventSourceKind.MANUAL,
        publishedAt: opts.status === EventStatus.PUBLISHED ? new Date() : undefined
      }
    });

    // Build EventCategory rows: primary from categoryId, extras from categoryIds
    const allCategoryIds = dto.categoryIds?.length
      ? dto.categoryIds
      : [category.id];
    for (const [idx, catId] of allCategoryIds.entries()) {
      await this.prisma.eventCategory.upsert({
        where: { eventId_categoryId: { eventId: event.id, categoryId: catId } },
        update: { isPrimary: idx === 0 },
        create: { eventId: event.id, categoryId: catId, isPrimary: idx === 0, source: "MANUAL" },
      });
    }

    await this.duplicates.detectForEvent(event.id);
    return event;
  }

  async updateEvent(id: number, dto: Partial<EventUpsertDto> & { status?: EventStatus }) {
    const current = await this.prisma.event.findUnique({ where: { id } });
    if (!current) throw new NotFoundException("Event not found");
    const city = dto.cityId || dto.cityName ? await this.resolveCity(dto) : null;
    const data: Record<string, unknown> = {
      title: dto.title,
      description: dto.description,
      categoryId: dto.categoryId,
      startsAt: dto.startsAt ? new Date(dto.startsAt) : undefined,
      endsAt: dto.endsAt ? new Date(dto.endsAt) : undefined,
      isAllDay: dto.isAllDay,
      isFree: dto.isFree,
      priceText: dto.priceText,
      ticketUrl: dto.ticketUrl,
      sourceUrl: dto.sourceUrl,
      imageUrl: dto.imageUrl,
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
        const organizer = await this.prisma.organizer.findUnique({ where: { id: dto.organizerId } });
        if (!organizer) throw new BadRequestException("Unknown organizerId");
        data.organizerId = organizer.id;
      }
    }
    if (city) {
      data.cityName = dto.cityName || city.name;
      data.cityId = city.id;
      data.countyId = city.countyId;
      data.regionId = city.county.regionId;
    } else if ("cityName" in dto && dto.cityName) {
      data.cityName = dto.cityName;
    }
    if ("venueName" in dto) {
      if (dto.venueName) {
        const effectiveCityId = (city?.id ?? current.cityId)!;
        const venueCity = city ?? await this.prisma.city.findUnique({ where: { id: effectiveCityId } });
        if (venueCity) {
          const venueSlug = slugify(dto.venueName);
          const venue = await this.prisma.venue.upsert({
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
    const event = await this.prisma.event.update({ where: { id }, data });

    // If categoryIds supplied, replace EventCategory rows
    if (dto.categoryIds?.length) {
      await this.prisma.eventCategory.deleteMany({ where: { eventId: id } });
      for (const [idx, catId] of dto.categoryIds.entries()) {
        await this.prisma.eventCategory.upsert({
          where: { eventId_categoryId: { eventId: id, categoryId: catId } },
          update: { isPrimary: idx === 0 },
          create: { eventId: id, categoryId: catId, isPrimary: idx === 0, source: "MANUAL" },
        });
      }
    }

    await this.duplicates.detectForEvent(id);
    return event;
  }

  private async resolveCity(dto: Pick<EventUpsertDto, "cityId" | "cityName">) {
    if (dto.cityId) {
      const city = await this.prisma.city.findUnique({ where: { id: dto.cityId }, include: { county: true } });
      if (!city) throw new BadRequestException("Unknown cityId");
      return city;
    }
    const name = dto.cityName?.trim() || "Nepoznato";
    const existing = await this.prisma.city.findFirst({ where: { name: { equals: name, mode: "insensitive" } }, include: { county: true } });
    if (existing) return existing;
    const county = await this.ensureFallbackCounty();
    const slug = await uniqueSlug(name, async (s) => !!(await this.prisma.city.findUnique({ where: { slug: s } })));
    return this.prisma.city.create({ data: { name, slug, countyId: county.id }, include: { county: true } });
  }

  private async resolveCategory(categoryId?: number) {
    if (categoryId) {
      const category = await this.prisma.category.findUnique({ where: { id: categoryId } });
      if (!category) throw new BadRequestException("Unknown categoryId");
      return category;
    }
    return this.prisma.category.upsert({
      where: { slug: "ostalo" },
      update: {},
      create: { name: "Ostalo", slug: "ostalo", sortOrder: 999 },
    });
  }

  private async ensureFallbackCounty() {
    const region = await this.prisma.region.upsert({
      where: { slug: "hrvatska" },
      update: {},
      create: { name: "Hrvatska", slug: "hrvatska", sortOrder: 999 },
    });
    return this.prisma.county.upsert({
      where: { slug: "nepoznata-zupanija" },
      update: {},
      create: { name: "Nepoznata županija", slug: "nepoznata-zupanija", regionId: region.id },
    });
  }
}
