import type { SendEmailInput, SendEmailResult } from "../email.types";

export interface EmailProvider {
  send(input: SendEmailInput): Promise<SendEmailResult>;
}
