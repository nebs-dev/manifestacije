import { Controller, Get, Module } from "@nestjs/common";
import { ThrottlerModule } from "@nestjs/throttler";
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
import { RevalidateService } from "./admin/revalidate.service";
import { AiEventParserService } from "./ai-parser/ai-event-parser.service";
import { DuplicatesService } from "./duplicates/duplicates.service";
import { EventsService } from "./events/events.service";
import { UploadsService } from "./admin/uploads.service";

const jwtSecret = process.env.JWT_SECRET || "dev-secret-change-me";
if (process.env.NODE_ENV === "production" && jwtSecret === "dev-secret-change-me") {
  throw new Error("JWT_SECRET must be set to a non-default value in production");
}

@Controller("health")
class HealthController {
  @Get()
  health() {
    return { ok: true };
  }
}

@Module({
  imports: [
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 10 }]),
    JwtModule.register({
      global: true,
      secret: jwtSecret,
      signOptions: { expiresIn: "7d" }
    })
  ],
  controllers: [HealthController, AuthController, PublicFeedController, OrganizerController, AdminController],
  providers: [
    PrismaService,
    AuthService,
    PublicFeedService,
    OrganizerService,
    AdminService,
    RevalidateService,
    UploadsService,
    AiEventParserService,
    DuplicatesService,
    EventsService
  ]
})
export class AppModule {}
