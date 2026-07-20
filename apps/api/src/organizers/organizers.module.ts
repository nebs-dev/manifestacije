import { Module } from "@nestjs/common";
import { OrganizerController } from "./organizer.controller";
import { OrganizerService } from "./organizer.service";
import { EmailService } from "../email/email.service";
@Module({ controllers: [OrganizerController], providers: [OrganizerService, EmailService] })
export class OrganizersModule {}
