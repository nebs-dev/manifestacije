import { Resend } from "resend";
import type { EmailProvider } from "./email-provider.interface";
import type { SendEmailInput, SendEmailResult } from "../email.types";
import { EmailDeliveryError } from "../email.types";

export class ResendEmailProvider implements EmailProvider {
  private readonly client: Resend;

  constructor(apiKey: string, private readonly from: string) {
    this.client = new BoundedResend(apiKey);
  }

  async send(input: SendEmailInput): Promise<SendEmailResult> {
    const { data, error } = await this.client.emails.send({
      from: this.from,
      to: input.to,
      subject: input.subject,
      html: input.html,
      text: input.text,
      replyTo: input.replyTo,
      tags: input.tags,
    }, { idempotencyKey: input.idempotencyKey });

    if (error) {
      // Don't leak Resend's internal error shape to callers/API clients — wrap it.
      throw new EmailDeliveryError("Resend email submission failed", error.statusCode && error.statusCode < 500 ? "rejected" : "unknown");
    }

    if (!data?.id) throw new EmailDeliveryError("Resend response has no message ID", "unknown");
    return { provider: "resend", messageId: data.id };
  }
}

/** Bound network waits without retrying an ambiguous send. The SDK forwards
 * fetchRequest options to fetch and returns a structured error on timeouts. */
class BoundedResend extends Resend {
  override fetchRequest<T>(path: string, options = {}) {
    return super.fetchRequest<T>(path, { ...options, signal: AbortSignal.timeout(15_000) });
  }
}
