import { RevalidateService } from "../admin/revalidate.service";
import { Module } from "@nestjs/common";
import { EventsService } from "./events.service";
@Module({ providers: [EventsService, RevalidateService] })
export class EventsModule {}
