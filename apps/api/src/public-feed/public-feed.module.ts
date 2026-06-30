import { Module } from "@nestjs/common";
import { PublicFeedController } from "./public-feed.controller";
import { PublicFeedService } from "./public-feed.service";
@Module({ controllers: [PublicFeedController], providers: [PublicFeedService] })
export class PublicFeedModule {}
