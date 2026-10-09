import { Body, Controller, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
import { IsInt, IsOptional, IsString, MaxLength, Min } from "class-validator";
import { CurrentUser, Roles } from "../auth/auth.decorators";
import { AuthUser } from "../auth/auth.types";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { requireOrganizerId } from "../organizers/organizer.controller";
import { EventRevisionsService } from "./event-revisions.service";

export class ReviewEventRevisionDto {
  @IsInt() @Min(1) version!: number;
  @IsOptional() @IsString() @MaxLength(2000) reason?: string;
}

@Controller("admin/event-revisions")
@UseGuards(JwtAuthGuard)
@Roles("ADMIN")
export class AdminEventRevisionsController {
  constructor(private readonly revisions: EventRevisionsService) {}
  @Get() list(@Query("page") page?: string) { return this.revisions.listPending(page); }
  @Get(":id") detail(@Param("id") id: string) { return this.revisions.detail(Number(id)); }
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
