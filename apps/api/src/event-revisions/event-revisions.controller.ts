import { Body, Controller, Get, Header, Param, Post, Query, UseGuards, Optional, NotFoundException } from "@nestjs/common";
import { IsInt, IsOptional, IsString, MaxLength, Min } from "class-validator";
import { CurrentUser, Roles } from "../auth/auth.decorators";
import { AuthUser } from "../auth/auth.types";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { requireOrganizerId } from "../organizers/organizer.controller";
import { EventRevisionsService } from "./event-revisions.service";

import { NotificationsService } from "../admin/notifications.service";

export class ReviewEventRevisionDto {
  @IsInt() @Min(1) version!: number;
  @IsOptional() @IsString() @MaxLength(2000) reason?: string;
}

@Controller("admin/event-revisions")
@UseGuards(JwtAuthGuard)
@Roles("ADMIN")
export class AdminEventRevisionsController {
  constructor(private readonly revisions: EventRevisionsService, @Optional() private readonly notifications?: NotificationsService) {}
  @Get() list(@Query("page") page?: string) { return this.revisions.listPending(page); }
  @Get(":id") @Header("Cache-Control", "private, no-store") async detail(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    const revision = await this.revisions.detail(Number(id));
    if (revision.status === "PENDING" && this.notifications) {
      // A proposal replaced during the read must remain unread.
      try { await this.notifications.read(user.id, `revision:${revision.id}:${revision.version}`); }
      catch (error) { if (!(error instanceof NotFoundException)) throw error; }
    }
    return revision;
  }
  @Post(":id/approve") approve(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() dto: ReviewEventRevisionDto) {
    return this.revisions.decide(Number(id), user.id, dto.version, "APPROVED");
  }
  @Post(":id/reject") reject(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() dto: ReviewEventRevisionDto) {
    return this.revisions.decide(Number(id), user.id, dto.version, "REJECTED", dto.reason);
  }
}

@Controller("organizer/event-revisions")
@UseGuards(JwtAuthGuard)
@Roles("ORGANIZER")
export class OrganizerEventRevisionsController {
  constructor(private readonly revisions: EventRevisionsService) {}
  @Get(":id") detail(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.revisions.detail(Number(id), requireOrganizerId(user));
  }
}
