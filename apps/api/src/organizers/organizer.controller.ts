import { Body, Controller, Delete, ForbiddenException, Get, Param, Post, Put, UploadedFile, UseGuards, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { UserRole } from "@prisma/client";
import { CurrentUser, Roles } from "../auth/auth.decorators";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { AuthUser } from "../auth/auth.types";
import { UploadsService } from "../admin/uploads.service";
import { OrganizerEventDto, OrganizerProfileDto, SubmitSourceDto } from "./organizer.dto";
import { OrganizerService } from "./organizer.service";

/** The organizer every request acts for. Never read from the body, and never
 *  null: an ORGANIZER user whose organizer link is missing (e.g. the
 *  organizer was deleted) would otherwise turn `where: { organizerId }` into
 *  `organizerId IS NULL` and match every organizer-less event and source. */
export function requireOrganizerId(user: AuthUser): number {
  const organizerId = user?.organizerId;
  if (typeof organizerId !== "number" || !Number.isInteger(organizerId) || organizerId <= 0) {
    throw new ForbiddenException("Račun nije povezan s organizatorom.");
  }
  return organizerId;
}

@Controller("organizer")
@UseGuards(JwtAuthGuard)
@Roles(UserRole.ORGANIZER)
export class OrganizerController {
  constructor(private readonly organizer: OrganizerService, private readonly uploads: UploadsService) {}

  @Get("profile")
  profile(@CurrentUser() user: AuthUser) {
    return this.organizer.profile(requireOrganizerId(user));
  }

  @Put("profile")
  updateProfile(@CurrentUser() user: AuthUser, @Body() dto: OrganizerProfileDto) {
    return this.organizer.updateProfile(requireOrganizerId(user), dto);
  }

  @Get("events")
  events(@CurrentUser() user: AuthUser) {
    return this.organizer.listEvents(requireOrganizerId(user));
  }

  @Get("sources")
  sources(@CurrentUser() user: AuthUser) {
    return this.organizer.listSources(requireOrganizerId(user));
  }

  @Post("events")
  createEvent(@CurrentUser() user: AuthUser, @Body() dto: OrganizerEventDto) {
    return this.organizer.createEvent(requireOrganizerId(user), dto, user.email, user.id);
  }

  @Put("events/:id")
  updateEvent(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() dto: OrganizerEventDto) {
    return this.organizer.updateEvent(requireOrganizerId(user), Number(id), dto);
  }

  @Delete("events/:id")
  deleteEvent(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.organizer.deleteEvent(requireOrganizerId(user), Number(id));
  }

  @Post("events/submit-url")
  submitSource(@CurrentUser() user: AuthUser, @Body() dto: SubmitSourceDto) {
    return this.organizer.submitSource(requireOrganizerId(user), dto, user.email, user.id);
  }

  @Post("uploads/event-image")
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: 5 * 1024 * 1024 } }))
  uploadEventImage(@CurrentUser() user: AuthUser, @UploadedFile() file: unknown) {
    requireOrganizerId(user);
    return this.uploads.uploadEventImage(file as never);
  }
}
