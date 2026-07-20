import { Injectable, Logger } from "@nestjs/common";
import { loadEmailConfig, type EmailConfig } from "./email.config";
import type { EmailProvider } from "./providers/email-provider.interface";
import { ResendEmailProvider } from "./providers/resend-email.provider";
import { LogEmailProvider, maskEmail } from "./providers/log-email.provider";
import type { SendEmailInput, SendEmailResult } from "./email.types";
import { organizerWelcomeSubject, organizerWelcomeHtml, organizerWelcomeText, type OrganizerWelcomeData } from "./templates/organizer-welcome.template";
import { eventSubmittedSubject, eventSubmittedHtml, eventSubmittedText, type EventSubmittedData } from "./templates/event-submitted.template";
import { eventPublishedSubject, eventPublishedHtml, eventPublishedText, type EventPublishedData } from "./templates/event-published.template";
import { eventRejectedSubject, eventRejectedHtml, eventRejectedText, type EventRejectedData } from "./templates/event-rejected.template";
import { adminNewSubmissionSubject, adminNewSubmissionHtml, adminNewSubmissionText, type AdminNewSubmissionData } from "./templates/admin-new-submission.template";
import { passwordResetSubject, passwordResetHtml, passwordResetText, type PasswordResetData } from "./templates/password-reset.template";

/**
 * The only email entry point the rest of the app should use. Every send*
 * method catches its own delivery errors and logs structured metadata —
 * callers never need a try/catch, and a failed send never throws.
 */
@Injectable()
export class EmailService {
  private readonly logger = new Logger("EmailService");
  private readonly config: EmailConfig;
  private readonly provider: EmailProvider;

  constructor() {
    this.config = loadEmailConfig();
    this.provider = this.buildProvider();
  }

  private buildProvider(): EmailProvider {
    if (this.config.deliveryMode === "resend") {
      if (!this.config.resendApiKey) {
        this.logger.warn("EMAIL_DELIVERY_MODE=resend but RESEND_API_KEY is missing — falling back to log mode.");
        return new LogEmailProvider();
      }
      return new ResendEmailProvider(this.config.resendApiKey, `${this.config.fromName} <${this.config.fromAddress}>`);
    }
    return new LogEmailProvider();
  }

  get webUrl(): string {
    return this.config.publicWebUrl;
  }

  get adminNotificationEmail(): string {
    return this.config.adminNotificationEmail;
  }

  get passwordResetUrl(): string {
    return this.config.passwordResetUrl;
  }

  get passwordResetTokenTtlMinutes(): number {
    return this.config.passwordResetTokenTtlMinutes;
  }

  async sendOrganizerWelcome(to: string, data: OrganizerWelcomeData): Promise<void> {
    await this.dispatch({
      template: "organizer_welcome",
      to,
      subject: organizerWelcomeSubject(),
      html: organizerWelcomeHtml(data),
      text: organizerWelcomeText(data),
    });
  }

  async sendEventSubmitted(to: string, data: EventSubmittedData, relatedId?: number): Promise<void> {
    await this.dispatch({
      template: "event_submitted",
      to,
      subject: eventSubmittedSubject(data),
      html: eventSubmittedHtml(data),
      text: eventSubmittedText(data),
      relatedId,
    });
  }

  async sendEventPublished(to: string, data: EventPublishedData, relatedId?: number): Promise<void> {
    await this.dispatch({
      template: "event_published",
      to,
      subject: eventPublishedSubject(data),
      html: eventPublishedHtml(data),
      text: eventPublishedText(data),
      relatedId,
    });
  }

  async sendEventRejected(to: string, data: EventRejectedData, relatedId?: number): Promise<void> {
    await this.dispatch({
      template: "event_rejected",
      to,
      subject: eventRejectedSubject(data),
      html: eventRejectedHtml(data),
      text: eventRejectedText(data),
      relatedId,
    });
  }

  async sendAdminNewSubmission(data: AdminNewSubmissionData, relatedId?: number): Promise<void> {
    await this.dispatch({
      template: "admin_new_submission",
      to: this.config.adminNotificationEmail,
      subject: adminNewSubmissionSubject(data),
      html: adminNewSubmissionHtml(data),
      text: adminNewSubmissionText(data),
      relatedId,
    });
  }

  /** Throws on failure (unlike the other send* methods) — ForgotPassword needs
   *  to know whether delivery failed so it can delete the just-created reset
   *  token rather than leaving an unlimited-lifetime valid token behind. */
  async sendPasswordReset(to: string, data: PasswordResetData): Promise<SendEmailResult> {
    const input: SendEmailInput = {
      to,
      subject: passwordResetSubject(),
      html: passwordResetHtml(data),
      text: passwordResetText(data),
      replyTo: this.config.replyTo,
      tags: [
        { name: "template", value: "password_reset" },
        { name: "environment", value: process.env.NODE_ENV || "development" },
      ],
    };
    // Deliberately not routed through dispatch(): dispatch() swallows errors,
    // but the caller here (AuthService.forgotPassword) must know about a
    // failure so it can delete the newly created token instead of leaving an
    // unlimited-lifetime valid reset token in the database. The raw token
    // itself never appears in this method or in any log line — only the
    // already-built resetUrl (data.resetUrl) does, exactly as intended.
    try {
      const result = await this.provider.send(input);
      this.logger.log(`email sent template=password_reset to=${maskEmail(to)} provider=${result.provider}`);
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`email delivery failed template=password_reset to=${maskEmail(to)} provider=${this.config.deliveryMode} error=${message}`);
      throw err;
    }
  }

  /** Central send path: builds the Resend payload, sends, and logs structured
   *  metadata on both success and failure. Never throws — a delivery failure
   *  must never fail the business operation that triggered the email. */
  private async dispatch(params: {
    template: string;
    to: string;
    subject: string;
    html: string;
    text: string;
    relatedId?: number;
  }): Promise<SendEmailResult | undefined> {
    const input: SendEmailInput = {
      to: params.to,
      subject: params.subject,
      html: params.html,
      text: params.text,
      replyTo: this.config.replyTo,
      tags: [
        { name: "template", value: params.template },
        { name: "environment", value: process.env.NODE_ENV || "development" },
        ...(params.relatedId !== undefined ? [{ name: "event_id", value: String(params.relatedId) }] : []),
      ],
    };

    try {
      const result = await this.provider.send(input);
      this.logger.log(
        `email sent template=${params.template} to=${maskEmail(params.to)} relatedId=${params.relatedId ?? "-"} provider=${result.provider}`
      );
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `email delivery failed template=${params.template} to=${maskEmail(params.to)} relatedId=${params.relatedId ?? "-"} provider=${this.config.deliveryMode} error=${message}`
      );
      return undefined;
    }
  }
}
