import { BadRequestException, Body, Controller, Headers, Post, Req, UnauthorizedException } from "@nestjs/common";
import { ResendContactsService, type ResendContactWebhookPayload } from "../contacts/resend-contacts.service";
import { verifyResendWebhookSignature } from "./verify-resend-signature";

interface RequestWithRawBody {
  rawBody?: Buffer;
}

@Controller("webhooks")
export class ResendWebhookController {
  constructor(private readonly contacts: ResendContactsService) {}

  @Post("resend")
  async handle(
    @Req() req: RequestWithRawBody,
    @Body() body: ResendContactWebhookPayload,
    @Headers("svix-id") svixId?: string,
    @Headers("svix-timestamp") svixTimestamp?: string,
    @Headers("svix-signature") svixSignature?: string
  ) {
    const secret = process.env.RESEND_WEBHOOK_SECRET;
    if (!secret) throw new UnauthorizedException();
    if (!req.rawBody) throw new BadRequestException();

    const valid = verifyResendWebhookSignature({ svixId, svixTimestamp, svixSignature, rawBody: req.rawBody, secret });
    if (!valid) throw new UnauthorizedException("Invalid signature");

    // Idempotent by construction — processing the same event twice converges
    // to the same row state, so there's nothing extra to do for retries.
    await this.contacts.processResendContactUpdate(body);

    return { received: true };
  }
}
