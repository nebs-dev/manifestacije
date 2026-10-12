import { Injectable, Logger } from "@nestjs/common";
import { Resend } from "resend";
import { EmailContact, EmailContactSource, EmailContactSyncStatus, OrganizerStatus, UserRole } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { loadEmailConfig } from "../email/email.config";
import { maskEmail } from "../email/providers/log-email.provider";

interface ContactsApiError {
  message: string;
  name?: string;
  statusCode?: number | null;
}

const PERMISSION_ERROR_NAMES = new Set(["restricted_api_key", "invalid_api_key", "missing_api_key"]);
const PERMISSION_DENIED_MESSAGE = "Resend API key has no Contacts access";

/** A sending-only key is rejected by every Contacts endpoint; retrying or falling back cannot succeed. */
function isPermissionError(error: ContactsApiError): boolean {
  return PERMISSION_ERROR_NAMES.has(error.name ?? "") || error.statusCode === 401 || error.statusCode === 403;
}

class ContactsPermissionError extends Error {}

/** RESEND_CONTACTS_SYNC=disabled|false|off|0 turns off Resend Contacts calls; anything else keeps them on. */
export function resendContactsSyncEnabled(value = process.env.RESEND_CONTACTS_SYNC): boolean {
  return !["disabled", "false", "off", "0"].includes((value ?? "").trim().toLowerCase());
}

/** Subset of the Resend SDK's Contacts API actually used here. */
interface ContactsClient {
  contacts: {
    create(payload: {
      email: string;
      unsubscribed?: boolean;
      firstName?: string;
      properties?: Record<string, string | number | null>;
    }): Promise<{ data: { id: string } | null; error: ContactsApiError | null }>;
    get(options: { email: string }): Promise<{
      data: { id: string; unsubscribed: boolean } | null;
      error: ContactsApiError | null;
    }>;
    update(options: {
      id: string;
      firstName?: string;
      properties?: Record<string, string | number | null>;
    }): Promise<{ data: { id: string } | null; error: ContactsApiError | null }>;
  };
}

export interface BackfillStats {
  scanned: number;
  eligible: number;
  created: number;
  updated: number;
  alreadySynced: number;
  skippedUnengaged: number;
  unsubscribedPreserved: number;
  failed: number;
}

export interface ResendContactWebhookPayload {
  type?: string;
  data?: { id?: string; email?: string; unsubscribed?: boolean };
}

interface UpsertContactInput {
  email: string;
  source: EmailContactSource;
  organizerId?: number;
  userId?: number;
  firstName?: string;
  organizerName?: string;
  organizerStatus?: string;
  registered?: boolean;
  city?: string;
}

/**
 * Resend Contacts sync. Every public method here is non-fatal by design: a
 * failure to reach Resend, or any bug in this class, must never fail the
 * registration/submission/claim operation that triggered it. Callers should
 * fire-and-await these without their own try/catch.
 */
@Injectable()
export class ResendContactsService {
  private readonly logger = new Logger("ResendContactsService");
  private readonly client: ContactsClient | null;
  // Set after Resend rejects the key for Contacts (e.g. a sending-only key),
  // so one deployment does not keep issuing calls that cannot succeed.
  private permissionDenied = false;

  constructor(private readonly prisma: PrismaService) {
    const config = loadEmailConfig();
    // Same gate as EmailService.buildProvider(): only touch the real Resend
    // API when explicitly in resend delivery mode, never just because a key
    // happens to be set (e.g. local dev keeping RESEND_API_KEY around while
    // EMAIL_DELIVERY_MODE=log).
    const enabled = resendContactsSyncEnabled();
    if (!enabled && config.deliveryMode === "resend") this.logger.log("Resend contact sync disabled (RESEND_CONTACTS_SYNC); contacts are kept locally only");
    this.client =
      enabled && config.deliveryMode === "resend" && config.resendApiKey
        ? (new Resend(config.resendApiKey) as unknown as ContactsClient)
        : null;
  }

  normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  async upsertEligibleContact(input: UpsertContactInput): Promise<EmailContact> {
    const email = this.normalizeEmail(input.email);
    const existing = await this.prisma.emailContact.findUnique({ where: { email } });

    const record = existing
      ? await this.prisma.emailContact.update({
          where: { email },
          data: {
            organizerId: existing.organizerId ?? input.organizerId,
            userId: existing.userId ?? input.userId,
          },
        })
      : await this.prisma.emailContact.create({
          data: {
            email,
            source: input.source,
            organizerId: input.organizerId,
            userId: input.userId,
          },
        });

    await this.syncToResend(record, input);

    return this.prisma.emailContact.findUniqueOrThrow({ where: { email } });
  }

  async syncOrganizerRegistration(
    user: { id: number; email: string; name?: string },
    organizer?: { id: number; name: string; status: string }
  ): Promise<void> {
    await this.guarded("registration", () =>
      this.upsertEligibleContact({
        email: user.email,
        source: EmailContactSource.REGISTRATION,
        organizerId: organizer?.id,
        userId: user.id,
        firstName: user.name,
        organizerName: organizer?.name,
        organizerStatus: organizer?.status,
        registered: true,
      })
    );
  }

  async syncEventSubmitter(
    email: string | undefined | null,
    source: typeof EmailContactSource.EVENT_SUBMISSION | typeof EmailContactSource.SOURCE_SUBMISSION,
    organizer?: { id: number; name: string; status: string } | null,
    userId?: number
  ): Promise<void> {
    if (!email) return;
    await this.guarded(source, () =>
      this.upsertEligibleContact({
        email,
        source,
        organizerId: organizer?.id,
        userId,
        organizerName: organizer?.name,
        organizerStatus: organizer?.status,
        registered: true,
      })
    );
  }

  async syncClaimedOrganizer(
    user: { id: number; email: string; name?: string },
    organizer: { id: number; name: string; status: string }
  ): Promise<void> {
    await this.guarded("profile_claim", () =>
      this.upsertEligibleContact({
        email: user.email,
        source: EmailContactSource.PROFILE_CLAIM,
        organizerId: organizer.id,
        userId: user.id,
        firstName: user.name,
        organizerName: organizer.name,
        organizerStatus: organizer.status,
        registered: true,
      })
    );
  }

  async retryFailedContact(idOrEmail: number | string): Promise<EmailContact | null> {
    const record =
      typeof idOrEmail === "number"
        ? await this.prisma.emailContact.findUnique({ where: { id: idOrEmail } })
        : await this.prisma.emailContact.findUnique({ where: { email: this.normalizeEmail(idOrEmail) } });

    if (!record) return null;

    await this.syncToResend(record, {
      organizerId: record.organizerId ?? undefined,
      userId: record.userId ?? undefined,
    });

    return this.prisma.emailContact.findUnique({ where: { id: record.id } });
  }

  /**
   * Scans every Organizer, only touching ones with real evidence of direct
   * engagement (a linked ORGANIZER-role User, or a CLAIMED/VERIFIED/TRUSTED
   * status) — never just "has events" or "has an email" (those exist for
   * admin/parser-imported organizers too, which this must never add).
   * Idempotent: safe to run repeatedly, never resubscribes anyone.
   */
  async backfillExistingEngagedOrganizers(options?: { dryRun?: boolean }): Promise<BackfillStats> {
    const organizers = await this.prisma.organizer.findMany({
      include: { users: { where: { role: UserRole.ORGANIZER }, select: { id: true, email: true } } },
    });

    const stats: BackfillStats = {
      scanned: organizers.length,
      eligible: 0,
      created: 0,
      updated: 0,
      alreadySynced: 0,
      skippedUnengaged: 0,
      unsubscribedPreserved: 0,
      failed: 0,
    };

    const engagedStatuses: OrganizerStatus[] = [OrganizerStatus.CLAIMED, OrganizerStatus.VERIFIED, OrganizerStatus.TRUSTED];
    const seenEmails = new Set<string>();

    for (const organizer of organizers) {
      const organizerUser = organizer.users[0];
      const engaged = Boolean(organizerUser) || engagedStatuses.includes(organizer.status);
      if (!engaged) {
        stats.skippedUnengaged++;
        continue;
      }
      stats.eligible++;

      const rawEmail = organizerUser?.email || organizer.email;
      if (!rawEmail) continue; // engaged, but nothing to contact

      const email = this.normalizeEmail(rawEmail);
      if (seenEmails.has(email)) continue; // same email backing more than one organizer record
      seenEmails.add(email);

      if (options?.dryRun) continue;

      const existing = await this.prisma.emailContact.findUnique({ where: { email } });
      if (existing && existing.syncStatus !== EmailContactSyncStatus.FAILED && existing.syncStatus !== EmailContactSyncStatus.PENDING) {
        // Already synced (or already known-unsubscribed) — skip the network
        // round trip entirely rather than re-upserting on every run.
        stats.alreadySynced++;
        if (existing.isUnsubscribed) stats.unsubscribedPreserved++;
        continue;
      }

      const result = await this.upsertEligibleContact({
        email,
        source: EmailContactSource.EXISTING_ENGAGED_ORGANIZER_BACKFILL,
        organizerId: organizer.id,
        userId: organizerUser?.id,
        organizerName: organizer.name,
        organizerStatus: organizer.status,
        registered: Boolean(organizerUser),
      });

      if (result.syncStatus === EmailContactSyncStatus.FAILED) stats.failed++;
      else if (existing) stats.updated++;
      else stats.created++;
      if (result.isUnsubscribed) stats.unsubscribedPreserved++;
    }

    return stats;
  }

  /**
   * Resend webhook handler for contact.updated/contact.deleted — mirrors
   * Resend's own state locally. Only ever sets isUnsubscribed from here or
   * from a fresh get() read (see syncToResend) — never from a trigger sync.
   * Idempotent: re-delivering the same event converges to the same row state.
   */
  async processResendContactUpdate(payload: ResendContactWebhookPayload): Promise<void> {
    const email = payload.data?.email ? this.normalizeEmail(payload.data.email) : undefined;
    if (!email) return;

    const existing = await this.prisma.emailContact.findUnique({ where: { email } });
    if (!existing) return; // not a contact we're tracking

    if (payload.type === "contact.deleted") {
      await this.prisma.emailContact.update({
        where: { email },
        data: { resendContactId: null, syncStatus: EmailContactSyncStatus.PENDING },
      });
      return;
    }

    if (payload.data?.unsubscribed === true) {
      await this.prisma.emailContact.update({
        where: { email },
        data: { isUnsubscribed: true, unsubscribedAt: new Date(), syncStatus: EmailContactSyncStatus.UNSUBSCRIBED },
      });
      return;
    }

    if (payload.data?.unsubscribed === false) {
      await this.prisma.emailContact.update({
        where: { email },
        data: { isUnsubscribed: false, unsubscribedAt: null, syncStatus: EmailContactSyncStatus.SYNCED },
      });
    }
  }

  /** Wraps a trigger method so a bug or DB error here can never bubble up into the caller's business flow. */
  private async guarded(trigger: string, fn: () => Promise<unknown>): Promise<void> {
    try {
      await fn();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`contacts sync failed trigger=${trigger}`);
    }
  }

  /** Never throws — always resolves the EmailContact row's syncStatus/syncError instead. */
  private async syncToResend(
    record: EmailContact,
    input: {
      firstName?: string;
      organizerName?: string;
      organizerStatus?: string;
      registered?: boolean;
      city?: string;
      organizerId?: number;
      userId?: number;
    }
  ): Promise<void> {
    if (!this.client) {
      this.logger.log(`contacts sync skipped (no Resend client) email=${maskEmail(record.email)}`);
      return;
    }
    if (this.permissionDenied) {
      await this.markFailed(record.email, PERMISSION_DENIED_MESSAGE, false);
      return;
    }

    const properties: Record<string, string | number | null> = { source: record.source };
    const organizerId = record.organizerId ?? input.organizerId;
    const userId = record.userId ?? input.userId;
    if (organizerId !== undefined && organizerId !== null) properties.organizerId = String(organizerId);
    if (input.organizerName) properties.organizerName = input.organizerName;
    if (input.organizerStatus) properties.organizerStatus = input.organizerStatus;
    if (userId !== undefined && userId !== null) properties.userId = String(userId);
    if (input.registered !== undefined) properties.registered = input.registered ? "true" : "false";
    if (input.city) properties.city = input.city;

    try {
      if (record.resendContactId) {
        const { error } = await this.client.contacts.update({
          id: record.resendContactId,
          firstName: input.firstName,
          properties,
        });
        if (error) throw this.toError(error);
        await this.markSynced(record.email, record.resendContactId);
        return;
      }

      const { data, error } = await this.client.contacts.create({
        email: record.email,
        unsubscribed: false,
        firstName: input.firstName,
        properties,
      });
      if (error || !data) throw error ? this.toError(error) : new Error("Resend contact create failed");
      await this.markSynced(record.email, data.id);
    } catch (createErr) {
      if (createErr instanceof ContactsPermissionError) {
        await this.markFailed(record.email, createErr.message);
        return;
      }
      // Contact may already exist in Resend (conflict) — fetch and update it
      // instead, without ever passing `unsubscribed` so their subscription
      // state is left exactly as Resend already has it.
      try {
        const { data, error } = await this.client.contacts.get({ email: record.email });
        if (error || !data) throw error ? this.toError(error) : new Error(String(createErr));
        const { error: updateError } = await this.client.contacts.update({
          id: data.id,
          firstName: input.firstName,
          properties,
        });
        if (updateError) throw this.toError(updateError);
        // This get() is a pure read of Resend's existing truth for a contact
        // we didn't know about yet — mirroring it locally is not the same as
        // an action that resubscribes them, so it's safe to record here.
        await this.markSynced(record.email, data.id, data.unsubscribed);
      } catch (fallbackErr) {
        const message = fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr);
        await this.markFailed(record.email, message);
      }
    }
  }

  /** mirrorUnsubscribed should only be passed from a fresh get() read of Resend's
   *  own state (never from a create/update we just issued) — see call sites. */
  private async markSynced(email: string, resendContactId: string, mirrorUnsubscribed?: boolean): Promise<void> {
    const current = await this.prisma.emailContact.findUnique({ where: { email } });
    const isUnsubscribed = mirrorUnsubscribed ?? current?.isUnsubscribed ?? false;
    await this.prisma.emailContact.update({
      where: { email },
      data: {
        resendContactId,
        isUnsubscribed,
        unsubscribedAt: isUnsubscribed ? (current?.unsubscribedAt ?? new Date()) : null,
        syncStatus: isUnsubscribed ? EmailContactSyncStatus.UNSUBSCRIBED : EmailContactSyncStatus.SYNCED,
        lastSyncedAt: new Date(),
        syncError: null,
      },
    });
  }

  /** Permission failures disable further Contacts calls for this process and are logged once. */
  private toError(error: ContactsApiError): Error {
    if (!isPermissionError(error)) return new Error(error.message);
    if (!this.permissionDenied) {
      this.permissionDenied = true;
      this.logger.warn(`${PERMISSION_DENIED_MESSAGE}; skipping further contact sync until restart. Set RESEND_CONTACTS_SYNC=disabled or use a key with Contacts access.`);
    }
    return new ContactsPermissionError(PERMISSION_DENIED_MESSAGE);
  }

  private async markFailed(email: string, syncError: string, log = true): Promise<void> {
    if (log) this.logger.error("contacts sync failed");
    await this.prisma.emailContact.update({
      where: { email },
      data: { syncStatus: EmailContactSyncStatus.FAILED, syncError: syncError.slice(0, 500) },
    });
  }
}
