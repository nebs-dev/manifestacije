import { EmailTrackingService } from "./email/email-tracking.service";
import { EmailTrackingController } from "./email/email-tracking.controller";
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
import { AdminDuplicateCheckController, OrganizerDuplicateCheckController } from "./duplicates/duplicates.controller";
import { DuplicatesService } from "./duplicates/duplicates.service";
import { EventsService } from "./events/events.service";
import { EventRevisionsService } from "./event-revisions/event-revisions.service";
import { AdminEventRevisionsController, OrganizerEventRevisionsController } from "./event-revisions/event-revisions.controller";
import { UploadsService } from "./admin/uploads.service";
import { EmailService } from "./email/email.service";
import { ResendContactsService } from "./contacts/resend-contacts.service";
import { OrganizerClaimController } from "./organizer-claims/organizer-claim.controller";
import { OrganizerClaimService } from "./organizer-claims/organizer-claim.service";
import { ResendWebhookController } from "./webhooks/resend-webhook.controller";
import { MonitoredSourcesController } from "./monitored-sources/monitored-sources.controller";
import { MonitoredSourcesService } from "./monitored-sources/monitored-sources.service";

import { NotificationsService } from "./admin/notifications.service";
import { NotificationsController } from "./admin/notifications.controller";

const jwtSecret = process.env.JWT_SECRET || "dev-secret-change-me";
if (process.env.NODE_ENV === "production" && jwtSecret === "dev-secret-change-me") {
  throw new Error("JWT_SECRET must be set to a non-default value in production");
}

@Controller("health")
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async health() {
    let emailTracking: "ready" | "unavailable" = "unavailable";
    let db: "ok" | "error" = "ok";
    let notifications: "ready" | "unavailable" = "unavailable";
    let eventRevisions: "ready" | "unavailable" = "unavailable";
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      db = "error";
    }
    if (db === "ok") {
      try {
        await this.prisma.$queryRaw`SELECT "id", "version", "baseFingerprint", "original", "proposed", "reviewedAt" FROM "EventRevision" LIMIT 0`;
        const rows = await this.prisma.$queryRaw<{ ready: boolean }[]>`SELECT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = current_schema() AND tablename = 'EventRevision' AND indexname = 'EventRevision_one_pending_per_event') AS ready`;
        if (rows[0]?.ready) eventRevisions = "ready";
      } catch { /* Read-only readiness check; never expose database details. */ }
    }
    if (db === "ok") {
      try {
        await this.prisma.$queryRaw`SELECT "key", "kind", "entityId" FROM "ActiveAdminNotification" LIMIT 0`;
        await this.prisma.$queryRaw`SELECT "userId", "key", "readAt" FROM "AdminNotificationRead" LIMIT 0`;
        const [row] = await this.prisma.$queryRaw<{ count: number }[]>`SELECT COUNT(*)::int AS count FROM pg_trigger WHERE tgname IN ('admin_notification_user', 'admin_notification_event', 'admin_notification_source') AND NOT tgisinternal AND tgenabled <> 'D'`;
        if (row.count === 3) notifications = "ready";
      } catch { /* Additive schema readiness, no user data returned. */ }
    }
    if (db === "ok") {
      try {
        await this.prisma.$queryRaw`SELECT "id", "messageId", "status", "userId" FROM "EmailDelivery" LIMIT 0`;
        await this.prisma.$queryRaw`SELECT "id", "messageId", "occurredAt" FROM "EmailDeliveryEvent" LIMIT 0`;
        emailTracking = "ready";
      } catch { /* Schema-only probe; never reads email records. */ }
    }
    return {
      emailTracking,
      notifications,
      ok: db === "ok" && eventRevisions === "ready" && notifications === "ready" && emailTracking === "ready",
      db,
      eventRevisions,
      uptime: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
      env: process.env.NODE_ENV ?? "development",
    };
  }
}

@Module({
  imports: [
    ThrottlerModule.forRoot({
      throttlers: [{ ttl: 60_000, limit: 10 }],
      errorMessage: "Previše zahtjeva. Pričekajte minutu pa pokušajte ponovno.",
    }),
    ScheduleModule.forRoot(),
    JwtModule.register({
      global: true,
      secret: jwtSecret,
      signOptions: { expiresIn: "7d" }
    })
  ],
  controllers: [EmailTrackingController, NotificationsController, AdminDuplicateCheckController, OrganizerDuplicateCheckController, HealthController, AuthController, PublicFeedController, OrganizerController, AdminController, OrganizerClaimController, ResendWebhookController, MonitoredSourcesController, AdminEventRevisionsController, OrganizerEventRevisionsController],
  providers: [
    PrismaService,
    AuthService,
    PublicFeedService,
    OrganizerService,
    AdminService,
    NotificationsService,
    RevalidateService,
    UploadsService,
    AiEventParserService,
    DuplicatesService,
    EventsService,
    EventRevisionsService,
    EmailService,
    EmailTrackingService,
    ResendContactsService,
    OrganizerClaimService,
    MonitoredSourcesService
  ]
})
export class AppModule {}
