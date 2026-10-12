import { BadRequestException, Controller, Get, Header, Query, UseGuards } from "@nestjs/common";
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
  list(@Query("userId") raw?: string) {
    // Parsed here: the global transforming ValidationPipe turns an absent
    // query value into NaN before ParseIntPipe's optional check sees it.
    if (raw === undefined) return this.tracking.list();
    const userId = /^\d+$/.test(raw) ? Number(raw) : NaN;
    if (!Number.isSafeInteger(userId) || userId < 1 || userId > 2147483647) throw new BadRequestException("Neispravan ID korisnika");
    return this.tracking.list(userId);
  }
}
