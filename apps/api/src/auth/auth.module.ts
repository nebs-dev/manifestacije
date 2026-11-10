import { Module } from "@nestjs/common";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { EmailService } from "../email/email.service";
import { ResendContactsService } from "../contacts/resend-contacts.service";
import { OrganizerClaimService } from "../organizer-claims/organizer-claim.service";
import { RevalidateService } from "../admin/revalidate.service";

@Module({
  controllers: [AuthController],
  providers: [AuthService, EmailService, ResendContactsService, OrganizerClaimService, RevalidateService],
})
export class AuthModule {}
