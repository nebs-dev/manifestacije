import { BadRequestException, Controller, Get, Header, ParseIntPipe, Query, UseGuards } from "@nestjs/common";
import { UserRole } from "@prisma/client";
import { Roles } from "../auth/auth.decorators";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { EmailTrackingService } from "./email-tracking.service";

@Controller("admin/email-deliveries")
@UseGuards(JwtAuthGuard)
@Roles(UserRole.ADMIN)
export class EmailTrackingController {
  constructor(private readonly tracking: EmailTrackingService) {}
  @Get()
  @Header("Cache-Control", "private, no-store")
  list(@Query("userId", new ParseIntPipe({ optional: true })) userId?: number) {
    if (userId !== undefined && (!Number.isSafeInteger(userId) || userId < 1 || userId > 2147483647)) throw new BadRequestException("Neispravan ID korisnika");
    return this.tracking.list(userId);
  }
}
