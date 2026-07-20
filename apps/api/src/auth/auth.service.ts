import { BadRequestException, Injectable, Logger, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { UserRole } from "@prisma/client";
import * as bcrypt from "bcryptjs";
import { PrismaService } from "../prisma/prisma.service";
import { slugify, uniqueSlug } from "../common/slug";
import { generateResetToken, hashResetToken } from "../common/reset-token";
import { EmailService } from "../email/email.service";
import { ResendContactsService } from "../contacts/resend-contacts.service";
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
    private readonly contacts: ResendContactsService
  ) {}

  async register(dto: RegisterDto) {
    const email = this.normalizeEmail(dto.email);
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing?.role === UserRole.ADMIN) throw new BadRequestException("Email is already used by an admin account");
    if (existing) throw new BadRequestException("Email already registered");
    const organizerName = dto.organizerName || dto.name;
    const organizerSlug = await uniqueSlug(organizerName, async (s) => !!(await this.prisma.organizer.findUnique({ where: { slug: s } })));
    const passwordHash = await bcrypt.hash(dto.password, 10);
    const organizer = await this.prisma.organizer.create({
      data: { name: organizerName, slug: organizerSlug, status: "CLAIMED", email }
    });
    const user = await this.prisma.user.create({
      data: { email, passwordHash, name: dto.name, role: UserRole.ORGANIZER, organizerId: organizer.id }
    });

    // EmailService.send* already catches provider errors internally and never
    // throws; this try/catch is a second guard so registration can never fail
    // even if that guarantee is ever broken.
    try {
      await this.email.sendOrganizerWelcome(email, { organizerName, webUrl: this.email.webUrl });
    } catch {
      // intentionally swallowed — see comment above
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
    const user = await this.prisma.user.findUnique({ where: { email: this.normalizeEmail(dto.email) } });
    if (!user || !(await bcrypt.compare(dto.password, user.passwordHash))) throw new UnauthorizedException("Invalid credentials");
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
   * response and take roughly the same amount of time.
   */
  async forgotPassword(dto: ForgotPasswordDto): Promise<{ message: string }> {
    const email = this.normalizeEmail(dto.email);
    const user = await this.prisma.user.findUnique({ where: { email } });

    if (!user) {
      // Do a comparable amount of async work to a real request so response
      // timing doesn't leak whether the account exists.
      await bcrypt.hash("decoy-password-for-timing-parity", 10);
      this.logger.log("forgot-password requested for unknown email");
      return { message: GENERIC_FORGOT_PASSWORD_MESSAGE };
    }

    // Repeated requests invalidate prior unused tokens for this user — only
    // the most recently requested link should ever work.
    await this.prisma.passwordResetToken.deleteMany({ where: { userId: user.id, usedAt: null } });

    const rawToken = generateResetToken();
    const tokenHash = hashResetToken(rawToken);
    const ttlMinutes = this.email.passwordResetTokenTtlMinutes;
    const expiresAt = new Date(Date.now() + ttlMinutes * 60_000);

    const resetToken = await this.prisma.passwordResetToken.create({
      data: { userId: user.id, tokenHash, expiresAt },
    });

    const resetUrl = `${this.email.passwordResetUrl}?token=${encodeURIComponent(rawToken)}`;

    try {
      await this.email.sendPasswordReset(user.email, { resetUrl, ttlMinutes, webUrl: this.email.webUrl });
    } catch {
      // Preferred strategy: if sending fails, delete the just-created token
      // rather than leaving a valid-but-undelivered token sitting in the DB.
      // The public response stays generic either way — email failure must
      // never reveal whether the account exists.
      await this.prisma.passwordResetToken.delete({ where: { id: resetToken.id } }).catch(() => {});
      this.logger.error(`password reset email delivery failed userId=${user.id}`);
    }

    return { message: GENERIC_FORGOT_PASSWORD_MESSAGE };
  }

  async resetPassword(dto: ResetPasswordDto): Promise<{ message: string }> {
    const tokenHash = hashResetToken(dto.token);
    const resetToken = await this.prisma.passwordResetToken.findUnique({ where: { tokenHash } });

    if (!resetToken || resetToken.usedAt || resetToken.expiresAt < new Date()) {
      throw new BadRequestException(INVALID_RESET_TOKEN_MESSAGE);
    }

    const passwordHash = await bcrypt.hash(dto.newPassword, 10);

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: resetToken.userId },
        data: {
          passwordHash,
          authVersion: { increment: 1 }, // invalidates every previously issued JWT
        },
      });
      await tx.passwordResetToken.update({
        where: { id: resetToken.id },
        data: { usedAt: new Date() },
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
