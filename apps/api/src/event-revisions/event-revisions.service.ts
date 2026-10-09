import { BadRequestException, ConflictException, ForbiddenException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { EventStatus, Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { EventsService } from "../events/events.service";
import { EventContentDto } from "../events/event.dto";
import { OrganizerEventDto, pickOrganizerEventInput } from "../organizers/organizer.dto";
import { RevalidateService } from "../admin/revalidate.service";
import { EmailService } from "../email/email.service";
import { contentChanges, eventContent, eventFingerprint, revisionEventInclude, stableJson } from "./revision-content";

const revisionInclude = { organizer: { select: { id: true, name: true } }, submittedBy: { select: { id: true, name: true, email: true } }, event: { select: { id: true, title: true, slug: true } } } satisfies Prisma.EventRevisionInclude;

@Injectable()
export class EventRevisionsService {
  private readonly logger = new Logger(EventRevisionsService.name);
  constructor(private readonly prisma: PrismaService, private readonly events: EventsService,
    private readonly revalidate: RevalidateService, private readonly email: EmailService) {}

  private async transaction<T>(work: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    try {
      return await this.prisma.$transaction(work, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 30000 });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && ["P2034", "P2002"].includes(error.code)) {
        throw new ConflictException("Podaci su u međuvremenu promijenjeni. Osvježite stranicu i ponovno pregledajte izmjene.");
      }
      throw error;
    }
  }

  async saveOrganizerEdit(eventId: number, organizerId: number, userId: number | undefined, input: OrganizerEventDto) {
    const result = await this.transaction(async tx => {
      // One lock order for submit, replacement and decisions. SQL uniqueness
      // is a second guard against multiple pending proposals.
      await tx.$queryRaw`SELECT "id" FROM "Event" WHERE "id" = ${eventId} FOR UPDATE`;
      const event = await tx.event.findUnique({ where: { id: eventId }, include: revisionEventInclude });
      if (!event || event.organizerId !== organizerId) throw new ForbiddenException("Događaj ne pripada vašem organizatoru.");
      if (event.status !== EventStatus.PUBLISHED && !event.publishedAt) {
        // Decide under the same event lock: an admin publishing concurrently
        // cannot turn a draft save into an accidental unpublish operation.
        const saved = await this.events.updateEvent(eventId, { ...pickOrganizerEventInput(input), status: EventStatus.PENDING_REVIEW }, tx);
        return { event: saved, revision: null, notify: false };
      }
      if (!userId) throw new ForbiddenException("Prijavite se kako biste poslali izmjene.");
      const user = await tx.user.findFirst({ where: { id: userId, organizerId, role: "ORGANIZER" }, select: { id: true } });
      if (!user) throw new ForbiddenException("Račun nije povezan s ovim organizatorom.");
      const original = eventContent(event);
      const fingerprint = eventFingerprint(event);
      const pending = await tx.eventRevision.findFirst({ where: { eventId, status: "PENDING" } });
      const picked = Object.fromEntries(Object.entries(pickOrganizerEventInput(input)).filter(([, value]) => value !== undefined)) as OrganizerEventDto;
      if (event.occurrences.length && picked.occurrences === undefined && ["startsAt", "endsAt", "isAllDay"].some(field => field in picked)) {
        throw new BadRequestException("Događaj koristi raspored termina; pošaljite cijeli raspored.");
      }
      const previous = pending?.baseFingerprint === fingerprint ? pending.proposed as EventContentDto : original;
      const merged: EventContentDto = { ...previous, ...picked };
      // A supplied category list also defines the primary category unless it
      // was explicitly provided. All categories remain server-validated.
      if (picked.categoryIds && picked.categoryId === undefined) merged.categoryId = picked.categoryIds[0];
      const ids = [...new Set(merged.categoryIds ?? [])];
      if (!merged.categoryId || !ids.length) throw new BadRequestException("Odaberite barem jednu kategoriju.");
      merged.categoryIds = [merged.categoryId, ...ids.filter(id => id !== merged.categoryId)];
      const categories = await tx.category.count({ where: { id: { in: merged.categoryIds } } });
      if (categories !== merged.categoryIds.length) throw new BadRequestException("Nepoznata kategorija.");
      if (picked.cityName?.trim() && picked.cityId === undefined) merged.cityId = null;
      if (picked.cityId) {
        const city = await tx.city.findUnique({ where: { id: picked.cityId } });
        if (!city) throw new BadRequestException("Nepoznat grad.");
        merged.cityName = city.name;
      }
      await this.events.previewRevisionLocation(merged, original, tx);
      for (const row of merged.occurrences?.length ? merged.occurrences : [merged]) {
        for (const date of [row.startsAt, row.endsAt]) {
          if (date && !/(?:Z|[+-]\d{2}:\d{2})$/i.test(date)) throw new BadRequestException("Vrijeme mora sadržavati vremensku zonu.");
        }
      }
      const proposed = this.events.normalizeRevisionContent(merged, event);
      if (!contentChanges(original, proposed).length) throw new BadRequestException("Nema izmjena za pregled.");
      if (pending && pending.baseFingerprint === fingerprint && stableJson(pending.proposed) === stableJson(proposed)) return { event, revision: pending, notify: false };
      const data = { organizerId, submittedByUserId: userId, original: original as Prisma.InputJsonObject, proposed: proposed as Prisma.InputJsonObject,
        baseUpdatedAt: event.updatedAt, baseFingerprint: fingerprint, submittedAt: new Date() };
      const revision = pending
        ? await tx.eventRevision.update({ where: { id: pending.id }, data: { ...data, version: { increment: 1 } } })
        : await tx.eventRevision.create({ data: { eventId, ...data } });
      return { event, revision, notify: true };
    });
    if (!result.revision) {
      await this.events.afterTransactionalUpdate(eventId, true);
      return result.event;
    }
    if (result.notify) {
      try {
        const organizer = await this.prisma.organizer.findUnique({ where: { id: organizerId }, select: { name: true } });
        await this.email.sendAdminEventRevision({ title: (result.revision.proposed as EventContentDto).title || "Događaj",
          organizerName: organizer?.name || "Organizator", reviewUrl: `${this.email.webUrl}/admin/event-revisions/${result.revision.id}`, webUrl: this.email.webUrl }, result.revision.eventId);
      } catch { this.logger.warn(`Revision notification failed revisionId=${result.revision.id}`); }
    }
    // Event remains the existing API response identity; clients can detect the
    // separate revision without mistaking its ID for the event's ID.
    return { ...result.event, revision: result.revision, pendingRevision: true };
  }

  async listPending(pageInput?: string) {
    const page = Math.max(1, Math.min(10000, Number(pageInput) || 1));
    const [items, total] = await this.prisma.$transaction([
      this.prisma.eventRevision.findMany({ where: { status: "PENDING" }, include: revisionInclude, orderBy: [{ submittedAt: "asc" }, { id: "asc" }], skip: (Math.floor(page) - 1) * 25, take: 25 }),
      this.prisma.eventRevision.count({ where: { status: "PENDING" } }),
    ]);
    return { items, total, page: Math.floor(page), pageCount: Math.ceil(total / 25) };
  }

  async detail(id: number, organizerId?: number) {
    const revision = await this.prisma.eventRevision.findFirst({ where: { id, ...(organizerId !== undefined ? { organizerId, event: { organizerId } } : {}) }, include: revisionInclude });
    if (!revision) throw new NotFoundException("Izmjene nisu pronađene.");
    const event = await this.prisma.event.findUnique({ where: { id: revision.eventId }, include: revisionEventInclude });
    if (!event) throw new NotFoundException("Događaj nije pronađen.");
    const original = revision.original as EventContentDto, proposed = revision.proposed as EventContentDto;
    const categoryIds = [...new Set([...(original.categoryIds ?? []), ...(proposed.categoryIds ?? [])])];
    const categories = await this.prisma.category.findMany({ where: { id: { in: categoryIds } }, select: { id: true, name: true } });
    return { ...revision, changes: contentChanges(original, proposed), current: eventContent(event),
      conflict: eventFingerprint(event) !== revision.baseFingerprint, categories };
  }

  async decide(id: number, adminId: number, version: number, status: "APPROVED" | "REJECTED", reason?: string) {
    const revision = await this.transaction(async tx => {
      const candidate = await tx.eventRevision.findUnique({ where: { id }, select: { eventId: true } });
      if (!candidate) throw new NotFoundException("Izmjene nisu pronađene.");
      await tx.$queryRaw`SELECT "id" FROM "Event" WHERE "id" = ${candidate.eventId} FOR UPDATE`;
      const current = await tx.eventRevision.findUnique({ where: { id } });
      if (!current || current.status !== "PENDING" || current.version !== version) throw new ConflictException("Prijedlog je promijenjen ili već obrađen. Osvježite stranicu.");
      if (status === "APPROVED") {
        const event = await tx.event.findUnique({ where: { id: current.eventId }, include: revisionEventInclude });
        if (!event || event.organizerId !== current.organizerId || eventFingerprint(event) !== current.baseFingerprint) {
          throw new ConflictException("Objavljena verzija je promijenjena. Organizator mora ponovno poslati izmjene prije odobrenja.");
        }
        // Allowlist again at approval; stored JSON can never supply ownership,
        // status, slug, featuring or other admin-controlled fields.
        const proposed = pickOrganizerEventInput(current.proposed as OrganizerEventDto);
        const changes = contentChanges(current.original as EventContentDto, proposed);
        const delta = pickOrganizerEventInput(Object.fromEntries(changes.map(change => [change.field, change.proposed])) as OrganizerEventDto);
        // Applying the entire snapshot would upsert an unchanged shared venue
        // even for a title-only edit. Write only the fields the admin reviewed.
        if (("cityId" in delta || "cityName" in delta) && proposed.venueName) delta.venueName = proposed.venueName;
        if (!delta.occurrences?.length) delete delta.occurrences;
        await this.events.updateEvent(current.eventId, delta, tx);
      }
      return tx.eventRevision.update({ where: { id }, data: { status, reviewedByUserId: adminId, reviewedAt: new Date(), rejectionReason: status === "REJECTED" ? reason?.trim() || null : null } });
    });
    if (status === "APPROVED") {
      // All public consumers share the events tag; taxonomy may be resolved
      // during approval, and must be invalidated only after commit too.
      await this.revalidate.revalidate("events");
      await this.revalidate.revalidate("taxonomy");
      await this.events.afterTransactionalUpdate(revision.eventId);
    }
    try {
      const user = revision.submittedByUserId ? await this.prisma.user.findFirst({ where: { id: revision.submittedByUserId, organizerId: revision.organizerId, role: "ORGANIZER" }, select: { email: true } }) : null;
      if (user) await this.email.sendEventRevisionDecision(user.email, { title: (revision.proposed as EventContentDto).title || "Događaj", approved: status === "APPROVED", reason: revision.rejectionReason || undefined, webUrl: this.email.webUrl }, revision.eventId);
    } catch { this.logger.warn(`Revision decision notification failed revisionId=${id}`); }
    return revision;
  }
}
