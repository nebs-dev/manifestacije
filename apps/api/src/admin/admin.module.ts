import { Module } from "@nestjs/common";
import { AdminController } from "./admin.controller";
import { AdminService } from "./admin.service";
import { UploadsService } from "./uploads.service";
import { RevalidateService } from "./revalidate.service";

@Module({ controllers: [AdminController], providers: [AdminService, UploadsService, RevalidateService] })
export class AdminModule {}
