import { BadRequestException, Injectable } from "@nestjs/common";
import { Prisma, EmailDelivery } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

// These are transport states, never evidence that a person read the email.
const ranks: Record<string, number> = { "email.sent": 2, "email.delivery_delayed": 3,
  "email.delivered": 4, "email.failed": 5, "email.bounced": 6,
  "email.suppressed": 7, "email.complained": 8 };

@Injectable()
export class EmailTrackingService {
  constructor(private readonly prisma: PrismaService) {}

  start(template: string, provider: string, userId?: number) {
    return this.prisma.emailDelivery.create({ data: { template, provider, userId } });
  }

  fail(id: string, status: "submission_failed" | "submission_unknown" = "submission_failed") {
    return this.prisma.emailDelivery.update({ where: { id }, data: { status, statusRank: 1, updatedAt: new Date() } });
  }

  async submitted(id: string, provider: string, messageId?: string) {
    if (provider === "log") {
      await this.prisma.emailDelivery.update({ where: { id }, data: { status: "logged", provider } });
      return;
    }
    if (!messageId) throw new Error("Missing provider message ID");
    await this.prisma.$transaction(async (tx) => {
      await this.lock(tx, messageId);
      await tx.emailDelivery.update({ where: { id }, data: { provider, messageId, status: "accepted", statusRank: 1, acceptedAt: new Date() } });
      const event = await tx.emailDeliveryEvent.findFirst({ where: { messageId }, orderBy: [{ statusRank: "desc" }, { occurredAt: "desc" }] });
      if (event) await this.apply(tx, messageId, event.type, event.statusRank, event.occurredAt);
    });
  }

  async webhook(eventId: string, body: unknown) {
    const payload = body as { type?: unknown; created_at?: unknown; data?: { email_id?: unknown } };
    if (typeof payload?.type !== "string" || !Object.prototype.hasOwnProperty.call(ranks, payload.type)) return;
    const messageId = payload.data?.email_id;
    const occurredAt = typeof payload.created_at === "string" ? new Date(payload.created_at) : new Date(NaN);
    if (typeof messageId !== "string" || !/^[a-zA-Z0-9_-]{1,128}$/.test(messageId)
      || !eventId || eventId.length > 128 || !Number.isFinite(occurredAt.getTime())) throw new BadRequestException("Invalid email event");
    const type = payload.type, statusRank = ranks[type];
    await this.prisma.$transaction(async (tx) => {
      await this.lock(tx, messageId);
      // Store only the allowlisted transport metadata; never persist the payload.
      const inserted = await tx.emailDeliveryEvent.createMany({ data: { id: eventId, messageId, type, statusRank, occurredAt }, skipDuplicates: true });
      if (inserted.count) await this.apply(tx, messageId, type, statusRank, occurredAt);
    });
  }

  private async lock(tx: Prisma.TransactionClient, messageId: string) {
    // Coordinates an early webhook with the send response, including retries.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${messageId}, 73142))`;
  }

  private apply(tx: Prisma.TransactionClient, messageId: string, type: string, rank: number, at: Date) {
    return tx.emailDelivery.updateMany({ where: { messageId, OR: [{ statusRank: { lt: rank } }, { statusRank: rank, lastEventAt: { lt: at } }] },
      data: { status: type.slice(6), statusRank: rank, lastEventAt: at } });
  }

  async list(userId?: number): Promise<{ items: Omit<EmailDelivery, "statusRank">[] }> {
    const items = await this.prisma.emailDelivery.findMany({ where: { template: { in: ["password_reset", "organizer_welcome"] }, ...(userId ? { userId } : {}) }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 100 });
    return { items: items.map(({ statusRank: _rank, ...item }) => item) };
  }
}
