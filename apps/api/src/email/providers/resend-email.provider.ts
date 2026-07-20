import { Resend } from "resend";
import type { EmailProvider } from "./email-provider.interface";
import type { SendEmailInput, SendEmailResult } from "../email.types";
import { EmailDeliveryError } from "../email.types";

export class ResendEmailProvider implements EmailProvider {
  private readonly client: Resend;

  constructor(apiKey: string, private readonly from: string) {
    this.client = new Resend(apiKey);
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
    });

    if (error) {
      // Don't leak Resend's internal error shape to callers/API clients — wrap it.
      throw new EmailDeliveryError(`Resend send failed: ${error.message}`, error);
    }

    return { provider: "resend", messageId: data?.id };
  }
}
