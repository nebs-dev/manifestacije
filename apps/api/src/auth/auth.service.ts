import { EmailDeliveryError } from "../email/email.types";
import { BadRequestException, ForbiddenException, Injectable, Logger, Optional, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { UserRole } from "@prisma/client";
import * as bcrypt from "bcryptjs";
import { PrismaService } from "../prisma/prisma.service";
import { slugify, uniqueSlug } from "../common/slug";
import { generateResetToken, hashResetToken } from "../common/reset-token";
import { EmailService } from "../email/email.service";
import { formatHrDate } from "../email/format-date";
import { ResendContactsService } from "../contacts/resend-contacts.service";
import { OrganizerClaimService } from "../organizer-claims/organizer-claim.service";
import { ForgotPasswordDto, LoginDto, RegisterDto, ResetPasswordDto } from "./auth.dto";

const GENERIC_FORGOT_PASSWORD_MESSAGE = "Ako račun s tom adresom postoji, poslali smo upute za promjenu lozinke.";
const INVALID_RESET_TOKEN_MESSAGE = "Poveznica za promjenu lozinke nije valjana ili je istekla.";

@Injectable()
export class AuthService {
  private readonly logger = new Logger("AuthService");

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly email: EmailService,
    private readonly contacts: ResendContactsService,
    // Optional so the many unit tests that build AuthService by hand keep
    // working; app.module provides it in every real runtime.
    @Optional() private readonly claims?: OrganizerClaimService
  ) {}

  async register(dto: RegisterDto) {
    const email = this.normalizeEmail(dto.email);
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) throw new BadRequestException("Ova je email adresa već registrirana. Prijavite se ili zatražite promjenu lozinke.");
    const organizerName = dto.organizerName || dto.name;
    const organizerSlug = await uniqueSlug(organizerName, async (s) => !!(await this.prisma.organizer.findUnique({ where: { slug: s } })));
    const passwordHash = await bcrypt.hash(dto.password, 10);
    // One transaction: a failed user insert (a racing registration on the same
    // email, say) must not leave behind an organizer with no account on it.
    // Such an orphan reads as "claimed" to an admin while its owner can
    // neither log in nor reset a password that was never set.
    const { organizer, user } = await this.prisma.$transaction(async (tx) => {
      const organizer = await tx.organizer.create({
        data: { name: organizerName, slug: organizerSlug, status: "CLAIMED", email }
      });
      const user = await tx.user.create({
        data: { email, passwordHash, name: dto.name, role: UserRole.ORGANIZER, organizerId: organizer.id }
      });
      return { organizer, user };
    });

    // EmailService.send* already catches provider errors internally and never
    // throws; this try/catch is a second guard so registration can never fail
    // even if that guarantee is ever broken.
    try {
      await this.email.sendOrganizerWelcome(email, { organizerName, webUrl: this.email.webUrl }, user.id);
    } catch {
      // intentionally swallowed — see comment above
    }

    try {
      await this.email.sendAdminNewOrganizer(
        {
          organizerName,
          organizerEmail: email,
          registeredAtLabel: formatHrDate(user.createdAt ?? new Date()),
          adminOrganizersUrl: `${this.email.webUrl}/admin/organizers`,
          webUrl: this.email.webUrl,
        },
        organizer.id
      );
    } catch {
      // Admin notification failure must never block registration.
    }

    // ResendContactsService guarantees this never throws; the try/catch here
    // is a second guard so registration can never fail even if that
    // guarantee is ever broken (same pattern as the welcome email above).
    try {
      await this.contacts.syncOrganizerRegistration(user, organizer);
    } catch {
      // intentionally swallowed — see comment above
    }

    return this.session(user);
  }

  async login(dto: LoginDto) {
    const email = this.normalizeEmail(dto.email);
    const user = await this.prisma.user.findUnique({ where: { email } });

    if (!user) {
      // No User account yet — if this email belongs to an Organizer nobody
      // has claimed, tell them exactly what to do instead of a generic
      // "wrong password" (there's no password to get wrong: no account
      // exists yet). This is a deliberate UX choice for organizer login,
      // not the anti-enumeration surface — that's forgotPassword above.
      //
      // "Nobody claimed it" means no linked User — NOT OrganizerStatus,
      // which an admin can bump to CLAIMED/VERIFIED/TRUSTED on an organizer
      // that never actually registered. Reading the status here used to turn
      // every such organizer into a dead end: generic wrong-password on
      // login, and nothing at all from forgot-password.
      const organizer = await this.prisma.organizer.findFirst({ where: { email: { equals: email, mode: "insensitive" }, users: { none: {} } } });
      if (organizer) {
        throw new ForbiddenException({
          message: "Ovaj organizator još nema postavljenu lozinku. Preuzmite svoj profil da biste je postavili.",
          code: "CLAIM_REQUIRED",
          organizerSlug: organizer.slug,
        });
      }
      throw new UnauthorizedException("Email ili lozinka nisu ispravni.");
    }

    if (!(await bcrypt.compare(dto.password, user.passwordHash))) throw new UnauthorizedException("Email ili lozinka nisu ispravni.");
    return this.session(user);
  }

  async me(userId: number) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true, role: true, organizerId: true, organizer: true }
    });
  }

  /**
   * Always returns the same generic message whether or not the email exists —
   * this is the account-enumeration defense. Every branch below (unknown
   * email, known email, email-send failure) must produce an identical
   * response. No claim is made about constant provider network latency.
   */
  async forgotPassword(dto: ForgotPasswordDto): Promise<{ message: string }> {
    const email = this.normalizeEmail(dto.email);
    const user = await this.prisma.user.findUnique({ where: { email } });

    if (!user) {
      // The address may still belong to an organizer nobody has claimed —
      // the people who most need this form. They have no password to reset,
      // so send them the claim link instead of nothing at all.
      const invited = this.claims ? await this.claims.inviteUnclaimedByEmail(email) : false;
      if (!invited) {
        // Do a comparable amount of async work to a real request so response
        // timing doesn't leak whether the account exists.
        await bcrypt.hash("decoy-password-for-timing-parity", 10);
      }
      this.logger.log(invited ? "forgot-password answered with an organizer claim invite" : "forgot-password requested for unknown email");
      return { message: GENERIC_FORGOT_PASSWORD_MESSAGE };
    }

    // Repeated requests invalidate prior unused tokens in the transaction below.
    const rawToken = generateResetToken();
    const tokenHash = hashResetToken(rawToken);
    const ttlMinutes = this.email.passwordResetTokenTtlMinutes;
    const expiresAt = new Date(Date.now() + ttlMinutes * 60_000);

    const resetToken = await this.prisma.$transaction(async (tx) => {
      // Serialize issue/consume/admin reset for this account, including concurrent requests.
      await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${user.id} FOR UPDATE`;
      await tx.passwordResetToken.deleteMany({ where: { userId: user.id, usedAt: null } });
      return tx.passwordResetToken.create({ data: { userId: user.id, tokenHash, expiresAt } });
    });

    const url = new URL(this.email.passwordResetUrl);
    // A fragment keeps the secret out of HTTP access logs and referrer URLs.
    url.hash = new URLSearchParams({ token: rawToken }).toString();
    const resetUrl = url.toString();

    try {
      await this.email.sendPasswordReset(user.email, { resetUrl, ttlMinutes, webUrl: this.email.webUrl }, user.id);
    } catch (error) {
      // Explicit rejection removes the new token. Every public response stays
      // generic, including provider and local tracking failures.
      // A lost response may follow provider acceptance. Keep that short-lived
      // link usable; do not automatically resend an ambiguous submission.
      if (!(error instanceof EmailDeliveryError && error.outcome === "unknown")) {
        await this.prisma.passwordResetToken.delete({ where: { id: resetToken.id } }).catch(() => {});
      }
      this.logger.error(`password reset email submission failed userId=${user.id}`);
    }

    return { message: GENERIC_FORGOT_PASSWORD_MESSAGE };
  }

  async resetPassword(dto: ResetPasswordDto): Promise<{ message: string }> {
    const tokenHash = hashResetToken(dto.token);
    const resetToken = await this.prisma.passwordResetToken.findUnique({ where: { tokenHash } });

    if (!resetToken || resetToken.usedAt || resetToken.expiresAt <= new Date()) {
      throw new BadRequestException(INVALID_RESET_TOKEN_MESSAGE);
    }

    const passwordHash = await bcrypt.hash(dto.newPassword, 10);

    await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${resetToken.userId} FOR UPDATE`;
      const consumed = await tx.passwordResetToken.updateMany({
        where: { id: resetToken.id, usedAt: null, expiresAt: { gt: new Date() } }, data: { usedAt: new Date() },
      });
      if (consumed.count !== 1) throw new BadRequestException(INVALID_RESET_TOKEN_MESSAGE);
      await tx.user.update({
        where: { id: resetToken.userId },
        data: {
          passwordHash,
          authVersion: { increment: 1 }, // invalidates every previously issued JWT
        },
      });
      // Invalidate any other still-unused tokens for this user (e.g. an older
      // token that somehow survived, or a race with a second forgot-password
      // request) so only this reset can ever be replayed.
      await tx.passwordResetToken.deleteMany({
        where: { userId: resetToken.userId, usedAt: null, id: { not: resetToken.id } },
      });
    });

    return { message: "Lozinka je uspješno promijenjena." };
  }

  private session(user: { id: number; email: string; name: string; role: UserRole; organizerId: number | null; authVersion: number }) {
    const token = this.jwt.sign({ id: user.id, email: user.email, role: user.role, organizerId: user.organizerId, authVersion: user.authVersion });
    return { token, user: { id: user.id, email: user.email, name: user.name, role: user.role, organizerId: user.organizerId } };
  }

  private normalizeEmail(email: string) {
    return email.trim().toLowerCase();
  }
}
