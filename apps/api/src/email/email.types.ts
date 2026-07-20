export type EmailProviderName = "resend" | "log";

export interface SendEmailInput {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
  tags?: Array<{ name: string; value: string }>;
}

export interface SendEmailResult {
  provider: EmailProviderName;
  messageId?: string;
}

/** Non-fatal — thrown by providers, always caught by EmailService so callers never see it. */
export class EmailDeliveryError extends Error {
  constructor(message: string, readonly cause?: unknown) {
    super(message);
    this.name = "EmailDeliveryError";
  }
}
