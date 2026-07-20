import { Module } from "@nestjs/common";
import { OrganizerClaimController } from "./organizer-claim.controller";
import { OrganizerClaimService } from "./organizer-claim.service";
import { EmailService } from "../email/email.service";
import { ResendContactsService } from "../contacts/resend-contacts.service";

@Module({ controllers: [OrganizerClaimController], providers: [OrganizerClaimService, EmailService, ResendContactsService] })
export class OrganizerClaimsModule {}
