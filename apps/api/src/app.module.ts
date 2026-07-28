import { Controller, Get, Module } from "@nestjs/common";
import { ThrottlerModule } from "@nestjs/throttler";
import { ScheduleModule } from "@nestjs/schedule";
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
import { EmailService } from "./email/email.service";
import { ResendContactsService } from "./contacts/resend-contacts.service";
import { OrganizerClaimController } from "./organizer-claims/organizer-claim.controller";
import { OrganizerClaimService } from "./organizer-claims/organizer-claim.service";
import { ResendWebhookController } from "./webhooks/resend-webhook.controller";
import { MonitoredSourcesController } from "./monitored-sources/monitored-sources.controller";
import { MonitoredSourcesService } from "./monitored-sources/monitored-sources.service";

const jwtSecret = process.env.JWT_SECRET || "dev-secret-change-me";
if (process.env.NODE_ENV === "production" && jwtSecret === "dev-secret-change-me") {
  throw new Error("JWT_SECRET must be set to a non-default value in production");
}

@Controller("health")
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async health() {
    let db: "ok" | "error" = "ok";
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      db = "error";
    }
    return {
      ok: db === "ok",
      db,
      uptime: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
      env: process.env.NODE_ENV ?? "development",
    };
  }
}

@Module({
  imports: [
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 10 }]),
    ScheduleModule.forRoot(),
    JwtModule.register({
      global: true,
      secret: jwtSecret,
      signOptions: { expiresIn: "7d" }
    })
  ],
  controllers: [HealthController, AuthController, PublicFeedController, OrganizerController, AdminController, OrganizerClaimController, ResendWebhookController, MonitoredSourcesController],
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
    EventsService,
    EmailService,
    ResendContactsService,
    OrganizerClaimService,
    MonitoredSourcesService
  ]
})
export class AppModule {}
