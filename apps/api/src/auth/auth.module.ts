import { Module } from "@nestjs/common";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { EmailService } from "../email/email.service";
import { ResendContactsService } from "../contacts/resend-contacts.service";

@Module({ controllers: [AuthController], providers: [AuthService, EmailService, ResendContactsService] })
export class AuthModule {}
