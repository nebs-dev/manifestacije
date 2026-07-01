import { Module } from "@nestjs/common";
import { AdminController } from "./admin.controller";
import { AdminService } from "./admin.service";
import { UploadsService } from "./uploads.service";

@Module({ controllers: [AdminController], providers: [AdminService, UploadsService] })
export class AdminModule {}
