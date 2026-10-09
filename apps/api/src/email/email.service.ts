import { EmailTrackingService } from "./email-tracking.service";
import { adminAutoPublishedSubject, adminAutoPublishedHtml, adminAutoPublishedText, type AdminAutoPublishedData } from "./templates/admin-auto-published.template";
import { Injectable, Logger, Optional } from "@nestjs/common";
import { loadEmailConfig, type EmailConfig } from "./email.config";
import type { EmailProvider } from "./providers/email-provider.interface";
import { ResendEmailProvider } from "./providers/resend-email.provider";
import { LogEmailProvider } from "./providers/log-email.provider";
import { EmailDeliveryError } from "./email.types";
import type { SendEmailInput, SendEmailResult } from "./email.types";
import { organizerWelcomeSubject, organizerWelcomeHtml, organizerWelcomeText, type OrganizerWelcomeData } from "./templates/organizer-welcome.template";
import { eventSubmittedSubject, eventSubmittedHtml, eventSubmittedText, type EventSubmittedData } from "./templates/event-submitted.template";
import { eventPublishedSubject, eventPublishedHtml, eventPublishedText, type EventPublishedData } from "./templates/event-published.template";
import { eventRejectedSubject, eventRejectedHtml, eventRejectedText, type EventRejectedData } from "./templates/event-rejected.template";
import { adminNewSubmissionSubject, adminNewSubmissionHtml, adminNewSubmissionText, type AdminNewSubmissionData } from "./templates/admin-new-submission.template";
import { passwordResetSubject, passwordResetHtml, passwordResetText, type PasswordResetData } from "./templates/password-reset.template";
import { organizerClaimSubject, organizerClaimHtml, organizerClaimText, type OrganizerClaimData } from "./templates/organizer-claim.template";
import { adminNewOrganizerSubject, adminNewOrganizerHtml, adminNewOrganizerText, type AdminNewOrganizerData } from "./templates/admin-new-organizer.template";
import { adminEventRevisionHtml, adminEventRevisionText, eventRevisionDecisionHtml, eventRevisionDecisionText, type AdminEventRevisionData, type EventRevisionDecisionData } from "./templates/event-revision.template";

/**
 * The only email entry point the rest of the app should use. Every send*
 * method records transport metadata. Reset/claim sends throw on submission
 * failure; other sends preserve the underlying business operation.
 */
@Injectable()
export class EmailService {
  private readonly logger = new Logger("EmailService");
  private readonly config: EmailConfig;
  private readonly provider: EmailProvider;

  constructor(@Optional() private readonly tracking?: EmailTrackingService) {
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

  get organizerClaimUrl(): string {
    return this.config.organizerClaimUrl;
  }

  get organizerClaimTokenTtlMinutes(): number {
    return this.config.organizerClaimTokenTtlMinutes;
  }

  async sendOrganizerWelcome(to: string, data: OrganizerWelcomeData, userId?: number): Promise<void> {
    await this.dispatch({
      template: "organizer_welcome",
      userId,
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

  async sendAdminAutoPublished(data: AdminAutoPublishedData, relatedId: number): Promise<void> {
    await this.dispatch({ template: "admin_auto_published", to: this.config.adminNotificationEmail,
      subject: adminAutoPublishedSubject(data), html: adminAutoPublishedHtml(data), text: adminAutoPublishedText(data), relatedId });
  }

  async sendAdminNewOrganizer(data: AdminNewOrganizerData, relatedId?: number): Promise<void> {
    await this.dispatch({
      template: "admin_new_organizer",
      to: this.config.adminNotificationEmail,
      subject: adminNewOrganizerSubject(data),
      html: adminNewOrganizerHtml(data),
      text: adminNewOrganizerText(data),
      relatedId,
    });
  }

  async sendAdminEventRevision(data: AdminEventRevisionData, relatedId?: number): Promise<void> {
    await this.dispatch({ template: "admin_event_revision", to: this.config.adminNotificationEmail,
      subject: `Izmjene događaja čekaju pregled: ${data.title}`, html: adminEventRevisionHtml(data), text: adminEventRevisionText(data), relatedId });
  }

  async sendEventRevisionDecision(to: string, data: EventRevisionDecisionData, relatedId?: number): Promise<void> {
    await this.dispatch({ template: "event_revision_decision", to,
      subject: `Izmjene ${data.approved ? "odobrene" : "odbijene"}: ${data.title}`, html: eventRevisionDecisionHtml(data), text: eventRevisionDecisionText(data), relatedId });
  }

  /** Reset/claim callers receive a safe submission outcome for token cleanup. */
  async sendPasswordReset(to: string, data: PasswordResetData, userId?: number): Promise<SendEmailResult> {
    return this.submit({ template: "password_reset", to, userId, subject: passwordResetSubject(), html: passwordResetHtml(data), text: passwordResetText(data) });
  }

  async sendOrganizerClaim(to: string, data: OrganizerClaimData): Promise<SendEmailResult> {
    return this.submit({ template: "organizer_claim", to, subject: organizerClaimSubject(), html: organizerClaimHtml(data), text: organizerClaimText(data) });
  }

  private async dispatch(params: EmailParams): Promise<SendEmailResult | undefined> {
    try { return await this.submit(params); } catch { return undefined; }
  }

  private async submit(params: EmailParams): Promise<SendEmailResult> {
    let attempt;
    try {
      attempt = await this.tracking?.start(params.template, this.provider instanceof LogEmailProvider ? "log" : "resend", params.userId);
    } catch {
      this.logger.error(`email tracking unavailable template=${params.template}`);
      throw new EmailDeliveryError("Email tracking unavailable");
    }
    const input: SendEmailInput = {
      idempotencyKey: attempt?.id,
      to: params.to, subject: params.subject, html: params.html, text: params.text,
      replyTo: this.config.replyTo,
      tags: [
        { name: "template", value: params.template },
        { name: "environment", value: process.env.NODE_ENV || "development" },
        ...(params.relatedId !== undefined ? [{ name: "event_id", value: String(params.relatedId) }] : []),
      ],
    };
    let result: SendEmailResult;
    try {
      result = await this.provider.send(input);
    } catch (error) {
      if (attempt) await this.tracking!.fail(attempt.id, error instanceof EmailDeliveryError && error.outcome === "rejected" ? "submission_failed" : "submission_unknown").catch(() => this.logger.error("email tracking update failed"));
      // Provider errors may contain recipient addresses or request bodies. Never log them.
      this.logger.error(`email submission failed template=${params.template} attempt=${attempt?.id ?? "-"}`);
      throw new EmailDeliveryError("Email submission failed", error instanceof EmailDeliveryError ? error.outcome : "unknown");
    }
    if (attempt) {
      // Once accepted, a tracking outage must not invalidate a link already sent.
      await this.tracking!.submitted(attempt.id, result.provider, result.messageId)
        .catch(() => this.logger.error(`email tracking update failed attempt=${attempt.id}`));
    }
    this.logger.log(`email ${result.provider === "log" ? "logged" : "accepted"} template=${params.template} attempt=${attempt?.id ?? "-"} messageId=${result.messageId ?? "-"}`);
    return result;
  }
}

interface EmailParams {
  template: string;
  to: string;
  subject: string;
  html: string;
  text: string;
  relatedId?: number;
  userId?: number;
}
