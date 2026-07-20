import { Logger } from "@nestjs/common";
import type { EmailProvider } from "./email-provider.interface";
import type { SendEmailInput, SendEmailResult } from "../email.types";

/** Used for local development and tests — logs intended email metadata, never sends. */
export class LogEmailProvider implements EmailProvider {
  private readonly logger = new Logger("LogEmailProvider");

  async send(input: SendEmailInput): Promise<SendEmailResult> {
    const recipients = Array.isArray(input.to) ? input.to : [input.to];
    this.logger.log(
      `[email:log] to=${recipients.map(maskEmail).join(",")} subject="${input.subject}" tags=${JSON.stringify(input.tags ?? [])}`
    );
    return { provider: "log" };
  }
}

/** Keeps the local part's first two chars, masks the rest — enough for log correlation without leaking full addresses. */
export function maskEmail(email: string): string {
  const at = email.indexOf("@");
  if (at <= 0) return "***";
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  const visible = local.slice(0, 2);
  return `${visible}${"*".repeat(Math.max(local.length - 2, 1))}@${domain}`;
}
