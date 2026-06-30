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
        sourceType: opts.sourceType || EventSourceKind.MANUAL,
        publishedAt: opts.status === EventStatus.PUBLISHED ? new Date() : undefined
      }
    });
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
      status: dto.status
    };
    if (city) {
      data.cityId = city.id;
      data.countyId = city.countyId;
      data.regionId = city.county.regionId;
    }
    Object.keys(data).forEach((key) => data[key] === undefined && delete data[key]);
    const event = await this.prisma.event.update({ where: { id }, data });
    await this.duplicates.detectForEvent(id);
    return event;
  }
}
