import { Module } from "@nestjs/common";
import { AdminController } from "./admin.controller";
import { AdminService } from "./admin.service";
import { UploadsService } from "./uploads.service";
import { RevalidateService } from "./revalidate.service";
import { EmailService } from "../email/email.service";

@Module({ controllers: [AdminController], providers: [AdminService, UploadsService, RevalidateService, EmailService] })
export class AdminModule {}
