import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { PrismaService } from "./prisma/prisma.service";
import { AuthController } from "./auth/auth.controller";
import { AuthService } from "./auth/auth.service";
import { PublicFeedController } from "./public-feed/public-feed.controller";
import { PublicFeedService } from "./public-feed/public-feed.service";
import { OrganizerController } from "./organizers/organizer.controller";
import { OrganizerService } from "./organizers/organizer.service";
import { AdminController } from "./admin/admin.controller";
import { AdminService } from "./admin/admin.service";
import { AiEventParserService } from "./ai-parser/ai-event-parser.service";
import { DuplicatesService } from "./duplicates/duplicates.service";
import { EventsService } from "./events/events.service";

@Module({
  imports: [
    JwtModule.register({
      global: true,
      secret: process.env.JWT_SECRET || "dev-secret-change-me",
      signOptions: { expiresIn: "7d" }
    })
  ],
  controllers: [AuthController, PublicFeedController, OrganizerController, AdminController],
  providers: [
    PrismaService,
    AuthService,
    PublicFeedService,
    OrganizerService,
    AdminService,
    AiEventParserService,
    DuplicatesService,
    EventsService
  ]
})
export class AppModule {}
