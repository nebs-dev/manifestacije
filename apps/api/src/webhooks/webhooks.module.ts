import { EmailTrackingService } from "../email/email-tracking.service";
import { Module } from "@nestjs/common";
import { ResendWebhookController } from "./resend-webhook.controller";
import { ResendContactsService } from "../contacts/resend-contacts.service";
import { PrismaService } from "../prisma/prisma.service";

@Module({ controllers: [ResendWebhookController], providers: [ResendContactsService, PrismaService, EmailTrackingService] })
export class WebhooksModule {}
