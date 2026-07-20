import { Module } from "@nestjs/common";
import { OrganizerController } from "./organizer.controller";
import { OrganizerService } from "./organizer.service";
import { EmailService } from "../email/email.service";
import { ResendContactsService } from "../contacts/resend-contacts.service";
@Module({ controllers: [OrganizerController], providers: [OrganizerService, EmailService, ResendContactsService] })
export class OrganizersModule {}
