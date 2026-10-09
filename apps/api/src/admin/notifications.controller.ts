import { Body, Controller, Get, Header, Post, Query, UseGuards } from "@nestjs/common";
import { IsString, MaxLength } from "class-validator";
import { CurrentUser, Roles } from "../auth/auth.decorators";
import { AuthUser } from "../auth/auth.types";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { NotificationsService } from "./notifications.service";
class ReadNotificationDto { @IsString() @MaxLength(100) key!: string; }
@Controller("admin/notifications")
@UseGuards(JwtAuthGuard)
@Roles("ADMIN")
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}
  @Get() @Header("Cache-Control", "private, no-store") list(@CurrentUser() user: AuthUser, @Query("page") page?: string) { return this.notifications.list(user.id, page); }
  @Get("counts") @Header("Cache-Control", "private, no-store") counts(@CurrentUser() user: AuthUser) { return this.notifications.counts(user.id); }
  @Post("read-all") readAll(@CurrentUser() user: AuthUser) { return this.notifications.readAll(user.id); }
  @Post("read") read(@CurrentUser() user: AuthUser, @Body() dto: ReadNotificationDto) { return this.notifications.read(user.id, dto.key); }
}
