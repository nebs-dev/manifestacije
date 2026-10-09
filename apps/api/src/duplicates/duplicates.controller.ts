import { Body, Controller, Post, UseGuards } from "@nestjs/common";
import { CurrentUser, Roles } from "../auth/auth.decorators";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { AuthUser } from "../auth/auth.types";
import { requireOrganizerId } from "../organizers/organizer.controller";
import { DuplicatesService } from "./duplicates.service";
import { DuplicateCheckDto } from "./duplicate-check.dto";

@Controller("admin/duplicates")
@UseGuards(JwtAuthGuard)
@Roles("ADMIN")
export class AdminDuplicateCheckController {
  constructor(private readonly duplicates: DuplicatesService) {}
  @Post("check") check(@Body() dto: DuplicateCheckDto) { return this.duplicates.check(dto); }
}

@Controller("organizer/duplicates")
@UseGuards(JwtAuthGuard)
@Roles("ORGANIZER")
export class OrganizerDuplicateCheckController {
  constructor(private readonly duplicates: DuplicatesService) {}
  @Post("check") check(@CurrentUser() user: AuthUser, @Body() dto: DuplicateCheckDto) { return this.duplicates.check(dto, requireOrganizerId(user)); }
}
