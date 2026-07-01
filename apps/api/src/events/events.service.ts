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
    const city = await this.prisma.city.findUnique({ where: { id: dto.cityId }, include: { county: true } });
    if (!city) throw new BadRequestException("Unknown cityId");
    const category = await this.prisma.category.findUnique({ where: { id: dto.categoryId } });
    if (!category) throw new BadRequestException("Unknown categoryId");
    let venueId: number | undefined;
    if (dto.venueName) {
      const venueSlug = slugify(dto.venueName);
      const venue = await this.prisma.venue.upsert({
        where: { slug_cityId: { slug: venueSlug, cityId: city.id } },
        update: { address: dto.address },
        create: { name: dto.venueName, slug: venueSlug, cityId: city.id, address: dto.address }
      });
      venueId = venue.id;
    }
    const slug = await uniqueSlug(dto.title, async (s) => !!(await this.prisma.event.findUnique({ where: { slug: s } })));
    const event = await this.prisma.event.create({
      data: {
        title: dto.title,
        slug,
        description: dto.description,
        shortDescription: dto.shortDescription,
        status: opts.status || EventStatus.PENDING_REVIEW,
        organizerId: opts.organizerId || undefined,
        venueId,
        cityId: city.id,
        countyId: city.countyId,
        regionId: city.county.regionId,
        categoryId: category.id,
        startsAt: new Date(dto.startsAt),
        endsAt: dto.endsAt ? new Date(dto.endsAt) : undefined,
        isAllDay: dto.isAllDay || false,
        isFree: dto.isFree,
        priceText: dto.priceText,
        ticketUrl: dto.ticketUrl,
        sourceUrl: dto.sourceUrl,
        imageUrl: dto.imageUrl,
        imageAlt: dto.imageAlt,
        imageCredit: dto.imageCredit,
        imageSourceUrl: dto.imageSourceUrl,
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
    const city = dto.cityId ? await this.prisma.city.findUnique({ where: { id: dto.cityId }, include: { county: true } }) : null;
    const data: Record<string, unknown> = {
      title: dto.title,
      description: dto.description,
      shortDescription: dto.shortDescription,
      categoryId: dto.categoryId,
      startsAt: dto.startsAt ? new Date(dto.startsAt) : undefined,
      endsAt: dto.endsAt ? new Date(dto.endsAt) : undefined,
      isAllDay: dto.isAllDay,
      isFree: dto.isFree,
      priceText: dto.priceText,
      ticketUrl: dto.ticketUrl,
      sourceUrl: dto.sourceUrl,
      imageUrl: dto.imageUrl,
      imageAlt: dto.imageAlt,
      imageCredit: dto.imageCredit,
      imageSourceUrl: dto.imageSourceUrl,
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
      data.cityId = city.id;
      data.countyId = city.countyId;
      data.regionId = city.county.regionId;
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
}
