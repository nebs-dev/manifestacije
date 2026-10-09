import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

export type NotificationKind = "organizer" | "submission" | "revision" | "source" | "discovery" | "autoPublished";
type Notification = { key: string; kind: NotificationKind; entityId: number; createdAt: Date; title: string; href: string; requiresAction: boolean; readAt: Date | null };

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async counts(userId: number) {
    const rows = await this.prisma.$queryRaw<{ kind: NotificationKind; unread: number; pending: number }[]>`
      SELECT n."kind", COUNT(*) FILTER (WHERE r."key" IS NULL)::int AS unread,
        COUNT(*) FILTER (WHERE n."requiresAction")::int AS pending
      FROM "ActiveAdminNotification" n LEFT JOIN "AdminNotificationRead" r ON r."key" = n."key" AND r."userId" = ${userId}
      GROUP BY n."kind"`;
    const categories = Object.fromEntries((["organizer", "submission", "revision", "source", "discovery", "autoPublished"] as const)
      .map(kind => [kind, rows.find(row => row.kind === kind) || { kind, unread: 0, pending: 0 }]));
    return { categories, unread: rows.reduce((sum, row) => sum + row.unread, 0), pending: rows.reduce((sum, row) => sum + row.pending, 0),
      // Compatibility fields for existing consumers; revisions remain a workflow count.
      organizers: categories.organizer.unread, events: categories.submission.unread,
      sources: categories.source.unread + categories.discovery.unread, revisions: categories.revision.pending };
  }

  async list(userId: number, pageValue?: string) {
    const page = Number(pageValue || 1);
    if (!Number.isSafeInteger(page) || page < 1 || page > 10000) throw new BadRequestException("Neispravna stranica.");
    // Bounded list and counts from the same snapshot, no per-row queries.
    return this.prisma.$transaction(async tx => {
      const items = await tx.$queryRaw<Notification[]>`
        SELECT n.*, r."readAt" FROM "ActiveAdminNotification" n
        LEFT JOIN "AdminNotificationRead" r ON r."key" = n."key" AND r."userId" = ${userId}
        ORDER BY n."createdAt" DESC, n."key" DESC LIMIT 30 OFFSET ${(page - 1) * 30}`;
      const [count] = await tx.$queryRaw<{ total: number }[]>`SELECT COUNT(*)::int AS total FROM "ActiveAdminNotification"`;
      return { items, total: count.total, page, pageCount: Math.max(1, Math.ceil(count.total / 30)) };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
  }

  async read(userId: number, key: string) {
    if (!/^(notice:[1-9][0-9]*|revision:[1-9][0-9]*:[1-9][0-9]*)$/.test(key) || key.length > 100) throw new BadRequestException("Neispravna obavijest.");
    // A single INSERT SELECT validates eligibility and records the authenticated
    // admin only. Concurrent/repeated reads preserve the first receipt.
    const rows = await this.prisma.$queryRaw<{ key: string }[]>`
      INSERT INTO "AdminNotificationRead" ("userId", "key")
      SELECT ${userId}, n."key" FROM "ActiveAdminNotification" n WHERE n."key" = ${key}
      ON CONFLICT ("userId", "key") DO UPDATE SET "key" = EXCLUDED."key" RETURNING "key"`;
    if (!rows.length) throw new NotFoundException("Obavijest više nije aktivna.");
    return { ok: true };
  }

  async readAll(userId: number) {
    // Statement snapshot excludes arrivals after the click. Unique receipts
    // make racing individual/bulk actions idempotent without lost updates.
    await this.prisma.$executeRaw`
      INSERT INTO "AdminNotificationRead" ("userId", "key")
      SELECT ${userId}, n."key" FROM "ActiveAdminNotification" n ORDER BY n."key"
      ON CONFLICT ("userId", "key") DO NOTHING`;
    return { ok: true };
  }

  async readEntity(userId: number, kind: "event" | "source" | "organizer", id: number) {
    const kinds = kind === "event" ? ["submission", "autoPublished"] : kind === "source" ? ["source", "discovery"] : ["organizer"];
    await this.prisma.$executeRaw`
      INSERT INTO "AdminNotificationRead" ("userId", "key")
      SELECT ${userId}, n."key" FROM "ActiveAdminNotification" n
      WHERE n."entityId" = ${id} AND n."kind" IN (${Prisma.join(kinds)})
      ON CONFLICT ("userId", "key") DO NOTHING`;
  }
}
