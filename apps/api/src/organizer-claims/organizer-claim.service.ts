import { RevalidateService } from "../admin/revalidate.service";
import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { OrganizerClaimStatus, OrganizerStatus, UserRole } from "@prisma/client";
import * as bcrypt from "bcryptjs";
import { PrismaService } from "../prisma/prisma.service";
import { generateResetToken, hashResetToken } from "../common/reset-token";
import { EmailService } from "../email/email.service";
import { formatHrDate } from "../email/format-date";
import { ResendContactsService } from "../contacts/resend-contacts.service";
import { RequestOrganizerClaimDto, RequestClaimByEmailDto, CompleteOrganizerClaimDto, VerifyOrganizerClaimDto } from "./organizer-claim.dto";

const GENERIC_REQUEST_MESSAGE = "Ako je moguće potvrditi zahtjev, poslali smo vam poveznicu na unesenu adresu.";
const INVALID_CLAIM_MESSAGE = "Poveznica za preuzimanje profila nije valjana ili je istekla.";

const UNRESOLVED_STATUSES: OrganizerClaimStatus[] = [
  OrganizerClaimStatus.PENDING,
  OrganizerClaimStatus.EMAIL_VERIFICATION_SENT,
  OrganizerClaimStatus.NEEDS_ADMIN_REVIEW,
];

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface BulkInviteStats {
  scanned: number;
  eligible: number;
  invited: number;
  activeInviteSkipped: number;
  missingEmail: number;
  alreadyClaimed: number;
  failed: number;
}

@Injectable()
export class OrganizerClaimService {
  private readonly logger = new Logger("OrganizerClaimService");

  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
    private readonly contacts: ResendContactsService,
    private readonly revalidate: RevalidateService
  ) {}

  /**
   * Always returns the same generic message regardless of whether the
   * organizer exists, whether the email matches, or whether it's already
   * claimed — this is the account/claim-enumeration defense, mirroring
   * AuthService.forgotPassword.
   */
  async requestClaim(dto: RequestOrganizerClaimDto): Promise<{ message: string }> {
    const email = this.normalizeEmail(dto.email);
    const organizer = await this.prisma.organizer.findUnique({
      where: { slug: dto.organizerSlug },
      include: { users: { select: { id: true }, take: 1 } },
    });

    if (!organizer) {
      return { message: GENERIC_REQUEST_MESSAGE };
    }

    // Whether an account already exists is the real "claimed" signal — NOT
    // OrganizerStatus, which admins can independently bump to VERIFIED/TRUSTED
    // (a trust badge) on an organizer that has never actually registered.
    const alreadyClaimed = organizer.users.length > 0;
    const exactEmailMatch = !!organizer.email && this.normalizeEmail(organizer.email) === email;

    if (!alreadyClaimed && exactEmailMatch) {
      await this.sendAutomaticClaim(organizer.id, organizer.name, email);
    } else {
      await this.flagForAdminReview(organizer.id, organizer.name, email);
    }

    return { message: GENERIC_REQUEST_MESSAGE };
  }

  /**
   * Same generic-response contract as requestClaim, but for the "am I
   * already on Manifestacije.hr?" unified entry point — the sender doesn't
   * know their organizer slug (e.g. a manually-sent outreach email to a
   * mixed list of already-listed and brand-new organizers), only their own
   * email. Searches across all organizers instead of one known-by-slug.
   */
  async requestClaimByEmail(dto: RequestClaimByEmailDto): Promise<{ message: string }> {
    const email = this.normalizeEmail(dto.email);
    const organizer = await this.prisma.organizer.findFirst({
      where: { email: { equals: email, mode: "insensitive" } },
      include: { users: { select: { id: true }, take: 1 } },
    });

    if (organizer) {
      if (organizer.users.length === 0) {
        await this.sendAutomaticClaim(organizer.id, organizer.name, email);
      } else {
        await this.flagForAdminReview(organizer.id, organizer.name, email);
      }
    }
    // No match at all: nothing to do — same generic response either way, so
    // this never reveals whether the email exists in our system.

    return { message: GENERIC_REQUEST_MESSAGE };
  }

  async verifyToken(dto: VerifyOrganizerClaimDto): Promise<{ valid: boolean; requiresPassword?: boolean; organizerName?: string }> {
    const claim = await this.findActiveClaimByToken(dto.token);
    if (!claim) return { valid: false };

    const [organizer, existingUser] = await Promise.all([
      this.prisma.organizer.findUnique({ where: { id: claim.organizerId } }),
      this.prisma.user.findUnique({ where: { email: claim.email } }),
    ]);
    if (!organizer) return { valid: false };

    return { valid: true, requiresPassword: !existingUser, organizerName: organizer.name };
  }

  async completeClaim(dto: CompleteOrganizerClaimDto): Promise<{ message: string }> {
    const claim = await this.findActiveClaimByToken(dto.token);
    if (!claim) throw new BadRequestException(INVALID_CLAIM_MESSAGE);

    const organizer = await this.prisma.organizer.findUnique({
      where: { id: claim.organizerId },
      include: { users: { select: { id: true }, take: 1 } },
    });
    if (!organizer || organizer.users.length > 0) {
      throw new BadRequestException(INVALID_CLAIM_MESSAGE);
    }

    const existingUser = await this.prisma.user.findUnique({ where: { email: claim.email } });

    if (existingUser) {
      if (existingUser.organizerId && existingUser.organizerId !== organizer.id) {
        throw new BadRequestException("Ovaj račun je već povezan s drugim organizatorom.");
      }
      if (existingUser.role === UserRole.ADMIN) {
        throw new BadRequestException(INVALID_CLAIM_MESSAGE);
      }
    } else if (!dto.name || !dto.password) {
      throw new BadRequestException("Unesite ime i lozinku.");
    }

    const passwordHash = existingUser ? undefined : await bcrypt.hash(dto.password!, 10);

    const user = await this.prisma.$transaction(async (tx) => {
      const claimedUser = existingUser
        ? await tx.user.update({ where: { id: existingUser.id }, data: { organizerId: organizer.id, role: UserRole.ORGANIZER } })
        : await tx.user.create({
            data: { email: claim.email, passwordHash: passwordHash!, name: dto.name!, role: UserRole.ORGANIZER, organizerId: organizer.id },
          });

      // Only bump UNCLAIMED → CLAIMED — never downgrade an organizer an
      // admin already marked VERIFIED/TRUSTED just because they're only now
      // getting around to actually claiming their account.
      if (organizer.status === OrganizerStatus.UNCLAIMED) {
        await tx.organizer.update({ where: { id: organizer.id }, data: { status: OrganizerStatus.CLAIMED } });
      }
      await tx.organizerClaim.update({ where: { id: claim.id }, data: { status: OrganizerClaimStatus.COMPLETED, completedAt: new Date() } });
      await tx.organizerClaim.updateMany({
        where: { organizerId: organizer.id, id: { not: claim.id }, status: { in: UNRESOLVED_STATUSES } },
        data: { status: OrganizerClaimStatus.EXPIRED, tokenHash: null },
      });

      return claimedUser;
    });

    if (organizer.status === OrganizerStatus.UNCLAIMED) await this.revalidate.revalidate("events");

    // Sync failure must never roll back a claim that already succeeded —
    // this runs after the transaction has committed.
    try {
      await this.contacts.syncClaimedOrganizer(user, organizer);
    } catch (err) {
      this.logger.error(`contacts sync failed trigger=profile_claim error=${err instanceof Error ? err.message : String(err)}`);
    }

    try {
      await this.email.sendAdminNewOrganizer(
        {
          organizerName: organizer.name,
          organizerEmail: claim.email,
          registeredAtLabel: formatHrDate(new Date()),
          adminOrganizersUrl: `${this.email.webUrl}/admin/organizers`,
          webUrl: this.email.webUrl,
        },
        organizer.id
      );
    } catch {
      // Admin notification failure must never roll back a completed claim.
    }

    return { message: "Profil je uspješno preuzet." };
  }

  listClaims() {
    return this.prisma.organizerClaim.findMany({
      include: { organizer: { select: { id: true, name: true, slug: true, email: true, websiteUrl: true, status: true } } },
      orderBy: { createdAt: "desc" },
    });
  }

  /**
   * Approval never transfers ownership by itself — it only (re)issues an
   * email-verification token to the submitted address. The recipient still
   * has to click the link and go through completeClaim, same as the
   * automatic path. Unlike the public request flow, failures here are
   * surfaced to the admin instead of swallowed — there's no enumeration
   * concern once an admin is already looking at this specific request.
   */
  async approveClaim(id: number): Promise<{ message: string }> {
    const claim = await this.prisma.organizerClaim.findUnique({ where: { id } });
    if (!claim) throw new NotFoundException("Zahtjev nije pronađen.");
    if (claim.status !== OrganizerClaimStatus.NEEDS_ADMIN_REVIEW) {
      throw new ConflictException("Zahtjev nije na čekanju.");
    }

    const organizer = await this.prisma.organizer.findUnique({
      where: { id: claim.organizerId },
      include: { users: { select: { id: true }, take: 1 } },
    });
    if (!organizer || organizer.users.length > 0) {
      throw new ConflictException("Organizator je već preuzet.");
    }

    await this.prisma.organizerClaim.updateMany({
      where: { organizerId: claim.organizerId, id: { not: claim.id }, status: { in: UNRESOLVED_STATUSES } },
      data: { status: OrganizerClaimStatus.EXPIRED, tokenHash: null },
    });

    const rawToken = generateResetToken();
    const tokenHash = hashResetToken(rawToken);
    const ttlMinutes = this.email.organizerClaimTokenTtlMinutes;
    const expiresAt = new Date(Date.now() + ttlMinutes * 60_000);

    await this.prisma.organizerClaim.update({
      where: { id: claim.id },
      data: { tokenHash, expiresAt, status: OrganizerClaimStatus.EMAIL_VERIFICATION_SENT, approvedAt: new Date() },
    });

    const claimUrl = `${this.email.organizerClaimUrl}?token=${encodeURIComponent(rawToken)}`;

    try {
      await this.email.sendOrganizerClaim(claim.email, { organizerName: organizer.name, claimUrl, ttlMinutes, webUrl: this.email.webUrl });
    } catch (err) {
      // Revert to NEEDS_ADMIN_REVIEW so the admin can see it failed and retry,
      // rather than leaving a valid-but-undelivered token sitting in the DB.
      await this.prisma.organizerClaim.update({
        where: { id: claim.id },
        data: { status: OrganizerClaimStatus.NEEDS_ADMIN_REVIEW, tokenHash: null, expiresAt: null, approvedAt: null },
      });
      this.logger.error(`organizer claim approval email delivery failed claimId=${claim.id} error=${err instanceof Error ? err.message : String(err)}`);
      throw new BadRequestException("Slanje emaila nije uspjelo. Pokušajte ponovo.");
    }

    return { message: "Poziv za preuzimanje profila poslan." };
  }

  async rejectClaim(id: number, internalReason?: string): Promise<{ message: string }> {
    const claim = await this.prisma.organizerClaim.findUnique({ where: { id } });
    if (!claim) throw new NotFoundException("Zahtjev nije pronađen.");

    await this.prisma.organizerClaim.update({
      where: { id },
      data: { status: OrganizerClaimStatus.REJECTED, rejectedAt: new Date(), internalReason },
    });

    return { message: "Zahtjev odbijen." };
  }

  /** Admin-initiated invite for an UNCLAIMED organizer, independent of any
   *  claim request — reuses the same token/email machinery as the public
   *  automatic path. Never touches Resend until the claim is completed. */
  async sendClaimInvite(organizerId: number): Promise<{ message: string }> {
    const organizer = await this.prisma.organizer.findUnique({
      where: { id: organizerId },
      include: { users: { select: { id: true }, take: 1 } },
    });
    if (!organizer) throw new NotFoundException("Organizator nije pronađen.");
    if (organizer.users.length > 0) throw new ConflictException("Organizator je već preuzet.");
    if (!organizer.email) throw new BadRequestException("Organizator nema email adresu.");

    await this.sendAutomaticClaim(organizer.id, organizer.name, this.normalizeEmail(organizer.email));

    return { message: "Poziv za preuzimanje profila poslan." };
  }

  /**
   * Bulk invites — deliberately never run automatically (deploy/seed); a
   * deliberate manual command only. Only sends invites; recipients are never
   * added to Resend Contacts here — that only happens once a claim completes.
   */
  async bulkInviteUnclaimedOrganizers(options?: { dryRun?: boolean; limit?: number }): Promise<BulkInviteStats> {
    const limit = options?.limit ?? 50;
    // Eligibility is "no linked User yet" — NOT OrganizerStatus, which admins
    // can independently bump to VERIFIED/TRUSTED (a trust badge) on an
    // organizer that has never actually registered.
    const organizers = await this.prisma.organizer.findMany({
      where: { users: { none: {} } },
      include: {
        users: { select: { id: true } },
        claims: { where: { status: OrganizerClaimStatus.EMAIL_VERIFICATION_SENT }, select: { id: true, expiresAt: true } },
      },
    });

    const stats: BulkInviteStats = {
      scanned: organizers.length,
      eligible: 0,
      invited: 0,
      activeInviteSkipped: 0,
      missingEmail: 0,
      alreadyClaimed: 0,
      failed: 0,
    };

    let sent = 0;
    const now = new Date();

    for (const organizer of organizers) {
      if (organizer.users.length > 0) {
        stats.alreadyClaimed++;
        continue;
      }
      if (!organizer.email || !EMAIL_PATTERN.test(organizer.email)) {
        stats.missingEmail++;
        continue;
      }
      const hasActiveInvite = organizer.claims.some((claim) => !claim.expiresAt || claim.expiresAt > now);
      if (hasActiveInvite) {
        stats.activeInviteSkipped++;
        continue;
      }

      stats.eligible++;
      if (sent >= limit) continue;

      if (options?.dryRun) {
        sent++;
        continue;
      }

      try {
        await this.sendClaimInvite(organizer.id);
        stats.invited++;
        sent++;
      } catch (err) {
        stats.failed++;
        this.logger.error(`bulk claim invite failed organizerId=${organizer.id} error=${err instanceof Error ? err.message : String(err)}`);
      }
    }

    return stats;
  }

  private async sendAutomaticClaim(organizerId: number, organizerName: string, email: string): Promise<void> {
    await this.prisma.organizerClaim.updateMany({
      where: { organizerId, status: { in: UNRESOLVED_STATUSES } },
      data: { status: OrganizerClaimStatus.EXPIRED, tokenHash: null },
    });

    const rawToken = generateResetToken();
    const tokenHash = hashResetToken(rawToken);
    const ttlMinutes = this.email.organizerClaimTokenTtlMinutes;
    const expiresAt = new Date(Date.now() + ttlMinutes * 60_000);

    const claim = await this.prisma.organizerClaim.create({
      data: { organizerId, email, tokenHash, status: OrganizerClaimStatus.EMAIL_VERIFICATION_SENT, expiresAt },
    });

    const claimUrl = `${this.email.organizerClaimUrl}?token=${encodeURIComponent(rawToken)}`;

    try {
      await this.email.sendOrganizerClaim(email, { organizerName, claimUrl, ttlMinutes, webUrl: this.email.webUrl });
    } catch {
      // Same strategy as AuthService.forgotPassword: delete the just-created
      // token rather than leaving a valid-but-undelivered one in the DB.
      await this.prisma.organizerClaim.delete({ where: { id: claim.id } }).catch(() => {});
      this.logger.error(`organizer claim email delivery failed organizerId=${organizerId}`);
    }
  }

  private async flagForAdminReview(organizerId: number, organizerName: string, submittedEmail: string): Promise<void> {
    await this.prisma.organizerClaim.create({
      data: { organizerId, email: submittedEmail, status: OrganizerClaimStatus.NEEDS_ADMIN_REVIEW },
    });

    try {
      await this.email.sendAdminNewSubmission({
        titleOrSource: organizerName,
        entityLabel: "profil",
        sourceTypeLabel: "Zahtjev za preuzimanje profila organizatora",
        adminReviewUrl: `${this.email.webUrl}/admin/organizer-claims`,
        webUrl: this.email.webUrl,
      });
    } catch {
      // EmailService.send* already catches provider errors; this guards against
      // an unexpected failure in the data prepared above so it can never bubble up.
    }
  }

  private async findActiveClaimByToken(token: string) {
    const tokenHash = hashResetToken(token);
    const claim = await this.prisma.organizerClaim.findUnique({ where: { tokenHash } });
    if (!claim || claim.status !== OrganizerClaimStatus.EMAIL_VERIFICATION_SENT) return null;
    if (claim.expiresAt && claim.expiresAt < new Date()) return null;
    return claim;
  }

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }
}
