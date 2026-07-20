import { Body, Controller, Delete, Get, Param, Post, Put, UploadedFile, UseGuards, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { UserRole } from "@prisma/client";
import { CurrentUser, Roles } from "../auth/auth.decorators";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { AuthUser } from "../auth/auth.types";
import { EventUpsertDto } from "../events/event.dto";
import { UploadsService } from "../admin/uploads.service";
import { OrganizerProfileDto, SubmitSourceDto } from "./organizer.dto";
import { OrganizerService } from "./organizer.service";

@Controller("organizer")
@UseGuards(JwtAuthGuard)
@Roles(UserRole.ORGANIZER)
export class OrganizerController {
  constructor(private readonly organizer: OrganizerService, private readonly uploads: UploadsService) {}

  @Get("profile")
  profile(@CurrentUser() user: AuthUser) {
    return this.organizer.profile(user.organizerId!);
  }

  @Put("profile")
  updateProfile(@CurrentUser() user: AuthUser, @Body() dto: OrganizerProfileDto) {
    return this.organizer.updateProfile(user.organizerId!, dto);
  }

  @Get("events")
  events(@CurrentUser() user: AuthUser) {
    return this.organizer.listEvents(user.organizerId!);
  }

  @Get("sources")
  sources(@CurrentUser() user: AuthUser) {
    return this.organizer.listSources(user.organizerId!);
  }

  @Post("events")
  createEvent(@CurrentUser() user: AuthUser, @Body() dto: EventUpsertDto) {
    return this.organizer.createEvent(user.organizerId!, dto, user.email, user.id);
  }

  @Put("events/:id")
  updateEvent(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() dto: EventUpsertDto) {
    return this.organizer.updateEvent(user.organizerId!, Number(id), dto);
  }

  @Delete("events/:id")
  deleteEvent(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.organizer.deleteEvent(user.organizerId!, Number(id));
  }

  @Post("events/submit-url")
  submitSource(@CurrentUser() user: AuthUser, @Body() dto: SubmitSourceDto) {
    return this.organizer.submitSource(user.organizerId!, dto, user.email, user.id);
  }

  @Post("uploads/event-image")
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: 5 * 1024 * 1024 } }))
  uploadEventImage(@UploadedFile() file: unknown) {
    return this.uploads.uploadEventImage(file as never);
  }
}
