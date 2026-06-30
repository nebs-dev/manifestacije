import { Module } from "@nestjs/common";
import { DuplicatesService } from "./duplicates.service";
@Module({ providers: [DuplicatesService] })
export class DuplicatesModule {}
